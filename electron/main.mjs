import { app, BrowserWindow, dialog, ipcMain, net, Notification, protocol, session, shell } from 'electron'
import electronUpdater from 'electron-updater'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { appendFile, copyFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { spawn, spawnSync } from 'node:child_process'
import { basename, extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import crypto from 'node:crypto'

const { autoUpdater } = electronUpdater

protocol.registerSchemesAsPrivileged([
  { scheme: 'slaycam-asset', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
  { scheme: 'slaycam-builtin', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
])

let mainWindow
let updateCheckTimer
let updateDemo
let currentCheckIsAutomatic = false
let notifiedAvailableVersion = ''
let notifiedDownloadedVersion = ''
let updaterState = { phase: 'idle', currentVersion: app.getVersion() }
let virtualCameraProcess
let virtualCameraFormat = { width: 0, height: 0, fps: 0, bytes: 0 }
let virtualCameraBackpressure = false
let virtualCameraState = { phase: 'unsupported', installed: false, streaming: false, message: 'Доступно в Windows-версии' }
let rendererReady = false
let rendererReadyTimer
let rendererRevealTimer
let rendererPaintTimer
let rendererPainted = false
let appExiting = false

const isDev = !app.isPackaged && Boolean(process.env.VITE_DEV_SERVER_URL)
const isUpdateDemo = isDev && process.env.SLAYCAM_UPDATE_DEMO === '1'
const updatesSupported = () => app.isPackaged && process.platform === 'win32'
const configPath = () => join(app.getPath('userData'), 'slaycam.config.json')
const mediaPath = () => join(app.getPath('userData'), 'media')
const builtinMediaPath = () => join(app.getAppPath(), isDev ? 'public' : 'dist', 'default-memes')
const virtualCameraRoot = () => app.isPackaged ? join(process.resourcesPath, 'virtual-camera') : join(app.getAppPath(), 'native-dist', 'virtual-camera')
const virtualCameraDll = (arch = 'x64') => join(virtualCameraRoot(), arch, 'slaycam-virtualcam.dll')
const virtualCameraHost = () => join(virtualCameraRoot(), 'x64', 'slaycam-vcam-host.exe')
const VIRTUAL_CAMERA_CLSID = '{2BB0606F-077B-4B5D-9515-A3E16BACE7AA}'
const appLogPath = () => join(app.getPath('userData'), 'slaycam.log')

async function writeAppLog(scope, details) {
  try {
    const message = typeof details === 'string' ? details : JSON.stringify(details)
    await appendFile(appLogPath(), `[${new Date().toISOString()}] ${scope}: ${message}\n`, 'utf8')
  } catch {
    // Logging must never become another startup failure.
  }
}

const startupStatePath = () => join(app.getPath('userData'), 'slaycam.startup.json')

function readStartupState() {
  try {
    const stored = JSON.parse(readFileSync(startupStatePath(), 'utf8'))
    return {
      failedAttempts: Number(stored.failedAttempts) || 0,
      softwareRendering: Boolean(stored.softwareRendering),
      skipPaintWatchdog: Boolean(stored.skipPaintWatchdog),
    }
  } catch {
    return { failedAttempts: 0, softwareRendering: false, skipPaintWatchdog: false }
  }
}

function writeStartupState(state) {
  try {
    mkdirSync(app.getPath('userData'), { recursive: true })
    writeFileSync(startupStatePath(), JSON.stringify(state), 'utf8')
  } catch {
    // A missing marker only costs us the next self-repair, never the launch.
  }
}

// Two launches in a row that never painted the interface mean the GPU path is broken
// on this machine, so the third one draws in software instead of showing an empty window.
const previousStartup = readStartupState()
const softwareRendering = previousStartup.softwareRendering
  || previousStartup.failedAttempts >= 2
  || process.argv.includes('--slaycam-software-rendering')

if (softwareRendering) {
  app.disableHardwareAcceleration()
  app.commandLine.appendSwitch('disable-gpu-compositing')
}

let startupState = {
  failedAttempts: previousStartup.failedAttempts + 1,
  softwareRendering,
  skipPaintWatchdog: previousStartup.skipPaintWatchdog,
}
writeStartupState(startupState)

function saveStartupState(patch) {
  startupState = { ...startupState, ...patch }
  writeStartupState(startupState)
}

const mediaMimeTypes = new Map([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.webm', 'video/webm'],
  ['.mp4', 'video/mp4'],
  ['.mov', 'video/quicktime'],
  ['.mp3', 'audio/mpeg'],
  ['.wav', 'audio/wav'],
])

const importFilters = {
  visual: [{ name: 'Картинки и видео', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'webm', 'mp4', 'mov'] }],
  background: [{ name: 'Фон: картинка или видео', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'webm', 'mp4', 'mov'] }],
  audio: [{ name: 'Звуки', extensions: ['mp3', 'wav'] }],
  all: [{ name: 'Медиа SlayCam', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'webm', 'mp4', 'mov', 'mp3', 'wav'] }],
}

async function assetResponse(request, folder) {
  const requested = basename(decodeURIComponent(new URL(request.url).pathname))
  const response = await net.fetch(pathToFileURL(join(folder, requested)).toString())
  const headers = new Headers(response.headers)
  headers.set('Content-Type', mediaMimeTypes.get(extname(requested).toLowerCase()) ?? 'application/octet-stream')
  headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  headers.set('Access-Control-Allow-Origin', '*')
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

function rendererUrl(query = '') {
  if (isDev) return `${process.env.VITE_DEV_SERVER_URL}${query}`
  return `${pathToFileURL(join(app.getAppPath(), 'dist/index.html')).toString()}${query}`
}

async function createMainWindow() {
  rendererReady = false
  rendererPainted = false
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 720,
    backgroundColor: '#f4edf2',
    title: 'SlayCam',
    show: false,
    ...(process.platform === 'win32'
      ? {
          titleBarStyle: 'hidden',
          titleBarOverlay: { color: '#f8e8f1', symbolColor: '#76224f', height: 42 },
        }
      : { frame: false }),
    icon: join(app.getAppPath(), isDev ? 'public/brand-icon.png' : 'dist/brand-icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(app.getAppPath(), 'electron/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: false,
    },
  })
  mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    void writeAppLog('preload-error', `${preloadPath}: ${error?.stack || error}`)
  })
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    void writeAppLog('did-fail-load', `${errorCode} ${errorDescription} ${validatedURL}`)
  })
  mainWindow.webContents.on('render-process-gone', async (_event, details) => {
    void writeAppLog('render-process-gone', details)
    if (appExiting || !mainWindow || mainWindow.isDestroyed()) return
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'SlayCam остановился',
      message: 'Интерфейс SlayCam неожиданно закрылся.',
      detail: 'Перезапусти приложение. Если это повторится, SlayCam сохранит технический журнал для следующего исправления.',
      buttons: ['Перезапустить', 'Закрыть'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    })
    if (result.response === 0) {
      app.relaunch()
      app.exit(0)
    } else {
      mainWindow.close()
    }
  })
  mainWindow.on('maximize', () => mainWindow?.webContents.send('window:maximized', true))
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('window:maximized', false))
  await mainWindow.loadURL(rendererUrl())
  rendererRevealTimer = setTimeout(() => {
    if (rendererReady || !mainWindow || mainWindow.isDestroyed()) return
    void writeAppLog('startup-slow', 'Renderer stayed silent for 4 seconds, showing the window anyway')
    mainWindow.show()
  }, 4000)
  rendererReadyTimer = setTimeout(async () => {
    if (rendererReady || !mainWindow || mainWindow.isDestroyed()) return
    void writeAppLog('startup-timeout', `Renderer did not report ready within 10 seconds (softwareRendering=${softwareRendering})`)
    mainWindow.show()
    const actions = softwareRendering ? ['restart', 'reset', 'close'] : ['restart', 'software', 'reset', 'close']
    const labels = {
      restart: 'Перезапустить',
      software: 'Запустить без ускорения',
      reset: 'Сбросить настройки',
      close: 'Закрыть',
    }
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'SlayCam не загрузился',
      message: 'Интерфейс не успел запуститься.',
      detail: softwareRendering
        ? 'Можно перезапустить SlayCam или сбросить только настройки. Медиафайлы останутся на месте.'
        : 'Попробуйте запуск без графического ускорения. Он помогает на компьютерах со старым видеодрайвером. Можно также сбросить только настройки, медиафайлы останутся на месте.',
      buttons: actions.map((action) => labels[action]),
      defaultId: 0,
      cancelId: actions.indexOf('close'),
      noLink: true,
    })
    const action = actions[result.response] ?? 'close'
    if (action === 'software') {
      saveStartupState({ failedAttempts: 0, softwareRendering: true })
      void writeAppLog('software-rendering', 'Enabled by the user from the startup dialog')
      app.relaunch()
      app.exit(0)
    } else if (action === 'restart') {
      app.relaunch()
      app.exit(0)
    } else if (action === 'reset') {
      await resetStoredConfig()
      app.relaunch()
      app.exit(0)
    } else {
      mainWindow.close()
    }
  }, 10000)
}

// The interface mounted but no frame ever reached the screen: on Windows that is almost always
// a broken GPU driver, so retry once in software rendering instead of leaving an empty window.
async function handleMissingFirstFrame() {
  if (appExiting || rendererPainted || !mainWindow || mainWindow.isDestroyed()) return
  // A minimized window legitimately stops painting, so wait for it to come back before judging.
  if (!mainWindow.isVisible() || mainWindow.isMinimized()) {
    rendererPaintTimer = setTimeout(() => void handleMissingFirstFrame(), 6000)
    return
  }
  void writeAppLog('paint-timeout', `No frame within 6 seconds (softwareRendering=${softwareRendering})`)
  if (!softwareRendering) {
    saveStartupState({ failedAttempts: 0, softwareRendering: true })
    void writeAppLog('software-rendering', 'Enabled automatically, restarting once')
    app.relaunch()
    app.exit(0)
    return
  }
  // Software rendering did not help either, so stop guessing and never nag about it again.
  saveStartupState({ failedAttempts: 0, softwareRendering: false, skipPaintWatchdog: true })
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title: 'SlayCam рисует окно не полностью',
    message: 'Окно SlayCam осталось пустым.',
    detail: `Скорее всего дело в видеодрайвере компьютера: помогает его обновление. Журнал запуска лежит здесь: ${appLogPath()}`,
    buttons: ['Понятно', 'Закрыть SlayCam'],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  })
  if (result.response === 1) mainWindow.close()
}

async function resetStoredConfig() {
  const currentPath = configPath()
  if (!existsSync(currentPath)) return true
  const backupPath = `${currentPath}.backup-${Date.now()}`
  await rename(currentPath, backupPath)
  void writeAppLog('config-reset', `Previous settings moved to ${basename(backupPath)}`)
  return true
}

function releaseNotesText(notes) {
  if (typeof notes === 'string') return notes.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 280)
  if (!Array.isArray(notes)) return ''
  return notes.map((item) => typeof item?.note === 'string' ? item.note : '').join(' ').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 280)
}

function sendUpdaterState(next) {
  const currentVersion = next.demo ? (next.currentVersion ?? updaterState.currentVersion ?? app.getVersion()) : app.getVersion()
  updaterState = { ...updaterState, ...next, currentVersion }
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('updater:state', updaterState)
  return updaterState
}

function virtualCameraFilesAvailable() {
  return existsSync(virtualCameraDll('x64')) && existsSync(virtualCameraHost())
}

function virtualCameraInstalled() {
  if (process.platform !== 'win32') return false
  const result = spawnSync('reg.exe', ['query', `HKCR\\CLSID\\${VIRTUAL_CAMERA_CLSID}\\InprocServer32`], { windowsHide: true, encoding: 'utf8' })
  return result.status === 0
}

function sendVirtualCameraState(next = {}) {
  virtualCameraState = { ...virtualCameraState, ...next }
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('virtual-camera:state', virtualCameraState)
  return virtualCameraState
}

function refreshVirtualCameraState() {
  if (process.platform !== 'win32') return sendVirtualCameraState({ phase: 'unsupported', installed: false, streaming: false, message: 'Доступно в Windows-версии' })
  if (!virtualCameraFilesAvailable()) return sendVirtualCameraState({ phase: 'unavailable', installed: false, streaming: false, message: 'Компонент камеры не вошёл в эту сборку' })
  if (virtualCameraProcess) return sendVirtualCameraState({ phase: 'streaming', installed: true, streaming: true, message: 'Выбери SlayCam в приложении для звонка' })
  const installed = virtualCameraInstalled()
  return sendVirtualCameraState({ phase: installed ? 'ready' : 'not-installed', installed, streaming: false, message: installed ? 'Готова для Discord, Meet и Zoom' : 'Нужна разовая установка' })
}

function psQuote(value) {
  return `'${String(value).replaceAll("'", "''")}'`
}

async function registerVirtualCamera(register) {
  if (process.platform !== 'win32' || !virtualCameraFilesAvailable()) return refreshVirtualCameraState()
  sendVirtualCameraState({ phase: 'installing', message: register ? 'Windows попросит разрешение на установку' : 'Удаляем камеру из Windows' })
  const registerArgs = register ? `${psQuote('/s')}, ` : `${psQuote('/s')}, ${psQuote('/u')}, `
  const dll64 = psQuote(virtualCameraDll('x64'))
  const dll32Path = virtualCameraDll('x86')
  const commands = [
    `$p = Start-Process -FilePath \"$env:WINDIR\\System32\\regsvr32.exe\" -ArgumentList ${registerArgs}${dll64} -Verb RunAs -Wait -PassThru`,
    'if ($p.ExitCode -ne 0) { exit $p.ExitCode }',
  ]
  if (existsSync(dll32Path)) {
    commands.push(`$p = Start-Process -FilePath \"$env:WINDIR\\SysWOW64\\regsvr32.exe\" -ArgumentList ${registerArgs}${psQuote(dll32Path)} -Verb RunAs -Wait -PassThru`)
    commands.push('if ($p.ExitCode -ne 0) { exit $p.ExitCode }')
  }
  const encoded = Buffer.from(commands.join('; '), 'utf16le').toString('base64')
  const exitCode = await new Promise((resolve) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], { windowsHide: true })
    child.once('error', () => resolve(1))
    child.once('exit', (code) => resolve(code ?? 1))
  })
  if (exitCode !== 0) return sendVirtualCameraState({ phase: 'error', installed: virtualCameraInstalled(), streaming: false, message: 'Установка отменена или Windows не дала доступ' })
  return refreshVirtualCameraState()
}

function stopVirtualCamera() {
  if (!virtualCameraProcess) return refreshVirtualCameraState()
  sendVirtualCameraState({ phase: 'stopping', message: 'Останавливаем вывод' })
  const child = virtualCameraProcess
  virtualCameraProcess = undefined
  virtualCameraBackpressure = false
  child.stdin.end()
  setTimeout(() => { if (!child.killed) child.kill() }, 800)
  return sendVirtualCameraState({ phase: 'ready', installed: true, streaming: false, message: 'Готова для Discord, Meet и Zoom' })
}

function awaitProcessExit(child) {
  if (child.exitCode !== null || child.signalCode) return Promise.resolve()
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, 1500)
    child.once('exit', () => {
      clearTimeout(timer)
      resolve()
    })
  })
}

async function startVirtualCamera(width, height, fps) {
  if (process.platform !== 'win32' || !virtualCameraFilesAvailable() || !virtualCameraInstalled()) return refreshVirtualCameraState()
  const safeWidth = Math.max(320, Math.min(1920, Math.round(Number(width) / 4) * 4))
  const safeHeight = Math.max(180, Math.min(1080, Math.round(Number(height) / 4) * 4))
  const safeFps = Math.max(10, Math.min(30, Math.round(Number(fps))))
  if (virtualCameraProcess) {
    const sameFormat = virtualCameraFormat.width === safeWidth
      && virtualCameraFormat.height === safeHeight
      && virtualCameraFormat.fps === safeFps
    if (sameFormat) return virtualCameraState
    // The running camera was created for the previous frame size. Feeding it the new one
    // would repeat the picture across the frame, so it is rebuilt for the new format.
    void writeAppLog('virtual-camera', `Restarting for ${safeWidth}x${safeHeight}@${safeFps} (was ${virtualCameraFormat.width}x${virtualCameraFormat.height}@${virtualCameraFormat.fps})`)
    const previous = virtualCameraProcess
    stopVirtualCamera()
    await awaitProcessExit(previous)
  }
  virtualCameraFormat = { width: safeWidth, height: safeHeight, fps: safeFps, bytes: safeWidth * safeHeight * 4 }
  sendVirtualCameraState({ phase: 'starting', installed: true, streaming: false, message: 'Запускаем вывод' })
  const child = spawn(virtualCameraHost(), [virtualCameraDll('x64'), String(safeWidth), String(safeHeight), String(safeFps)], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
  virtualCameraProcess = child
  child.stdout.setEncoding('utf8')
  child.stdout.on('data', (chunk) => {
    if (String(chunk).includes('READY')) sendVirtualCameraState({ phase: 'streaming', installed: true, streaming: true, message: 'Выбери SlayCam в приложении для звонка' })
  })
  child.once('error', (error) => {
    virtualCameraProcess = undefined
    sendVirtualCameraState({ phase: 'error', installed: true, streaming: false, message: error.message || 'Не удалось запустить вывод' })
  })
  child.once('exit', (code) => {
    if (virtualCameraProcess === child) virtualCameraProcess = undefined
    if (virtualCameraState.phase !== 'stopping') sendVirtualCameraState({ phase: code === 0 ? 'ready' : 'error', installed: true, streaming: false, message: code === 0 ? 'Вывод остановлен' : 'Компонент камеры завершился с ошибкой' })
  })
  child.stdin.on('drain', () => { virtualCameraBackpressure = false })
  return virtualCameraState
}

function showUpdateNotification(title, body) {
  if (!Notification.isSupported()) return
  const notification = new Notification({
    title,
    body,
    icon: join(app.getAppPath(), isDev ? 'public/brand-icon.png' : 'dist/brand-icon.png'),
  })
  notification.on('click', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })
  notification.show()
}

async function checkForUpdates(automatic = false) {
  if (isUpdateDemo) {
    updateDemo?.check()
    return updaterState
  }
  if (!updatesSupported()) {
    return sendUpdaterState({
      phase: 'unsupported',
      message: isDev ? 'Проверка обновлений работает в установленной Windows-версии.' : 'Автообновления доступны в Windows-версии SlayCam.',
    })
  }
  if (['checking', 'downloading'].includes(updaterState.phase)) return updaterState
  currentCheckIsAutomatic = automatic
  try {
    await autoUpdater.checkForUpdates()
  } catch (error) {
    sendUpdaterState({ phase: 'error', message: error instanceof Error ? error.message : 'Не получилось проверить обновление.' })
  }
  return updaterState
}

async function setupAutoUpdater() {
  if (isUpdateDemo) {
    const { createUpdateDemo } = await import('./update-demo.mjs')
    updateDemo = createUpdateDemo(sendUpdaterState)
    updateDemo.setup()
    return
  }
  if (!updatesSupported()) {
    sendUpdaterState({ phase: 'unsupported' })
    return
  }

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowDowngrade = false

  autoUpdater.on('checking-for-update', () => sendUpdaterState({ phase: 'checking', automatic: currentCheckIsAutomatic, message: '' }))
  autoUpdater.on('update-available', (info) => {
    sendUpdaterState({
      phase: 'available',
      version: info.version,
      releaseName: info.releaseName ?? '',
      notes: releaseNotesText(info.releaseNotes),
      automatic: currentCheckIsAutomatic,
      percent: 0,
      message: '',
    })
    if (notifiedAvailableVersion !== info.version) {
      notifiedAvailableVersion = info.version
      showUpdateNotification('Свежий SlayCam', `Версия ${info.version} готова к загрузке.`)
    }
  })
  autoUpdater.on('update-not-available', () => sendUpdaterState({ phase: 'not-available', automatic: currentCheckIsAutomatic, message: '' }))
  autoUpdater.on('download-progress', (progress) => sendUpdaterState({
    phase: 'downloading',
    percent: Math.max(0, Math.min(100, progress.percent)),
    transferred: progress.transferred,
    total: progress.total,
    message: '',
  }))
  autoUpdater.on('update-downloaded', (info) => {
    sendUpdaterState({ phase: 'downloaded', version: info.version, percent: 100, message: '' })
    if (notifiedDownloadedVersion !== info.version) {
      notifiedDownloadedVersion = info.version
      showUpdateNotification('Обновление скачано', 'Файлы готовы. Перезапусти SlayCam и сияй дальше.')
    }
  })
  autoUpdater.on('error', (error) => sendUpdaterState({ phase: 'error', message: error.message || 'Не получилось обновить SlayCam.' }))

  setTimeout(() => void checkForUpdates(true), 5000)
  updateCheckTimer = setInterval(() => void checkForUpdates(true), 4 * 60 * 60 * 1000)
}

app.on('child-process-gone', (_event, details) => {
  void writeAppLog('child-process-gone', details)
})

app.whenReady().then(async () => {
  app.setAppUserModelId('by.grossmeister.slaycam')
  void writeAppLog('startup', `SlayCam ${app.getVersion()} on ${process.platform} ${process.arch}, softwareRendering=${softwareRendering}, attempt=${previousStartup.failedAttempts + 1}`)
  await mkdir(mediaPath(), { recursive: true })
  protocol.handle('slaycam-asset', (request) => assetResponse(request, mediaPath()))
  protocol.handle('slaycam-builtin', (request) => assetResponse(request, builtinMediaPath()))
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media')
  })
  await createMainWindow()
  refreshVirtualCameraState()
  await setupAutoUpdater()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  appExiting = true
  if (rendererReadyTimer) clearTimeout(rendererReadyTimer)
  if (rendererRevealTimer) clearTimeout(rendererRevealTimer)
  if (rendererPaintTimer) clearTimeout(rendererPaintTimer)
  if (updateCheckTimer) clearInterval(updateCheckTimer)
  updateDemo?.dispose()
  stopVirtualCamera()
})

ipcMain.handle('config:load', async () => {
  try {
    return JSON.parse(await readFile(configPath(), 'utf8'))
  } catch {
    return null
  }
})

ipcMain.handle('config:save', async (_event, config) => {
  const tempPath = `${configPath()}.tmp`
  await writeFile(tempPath, JSON.stringify(config, null, 2), 'utf8')
  await rename(tempPath, configPath())
  return true
})

ipcMain.handle('config:reset', async () => {
  try {
    await resetStoredConfig()
    setImmediate(() => {
      app.relaunch()
      app.exit(0)
    })
    return true
  } catch (error) {
    void writeAppLog('config-reset-error', error?.stack || error)
    return false
  }
})

ipcMain.handle('media:import', async (_event, kind = 'all') => {
  const safeKind = Object.hasOwn(importFilters, kind) ? kind : 'all'
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Добавить медиа в SlayCam',
    properties: ['openFile', 'multiSelections'],
    filters: [
      ...importFilters[safeKind],
      { name: 'Все файлы', extensions: ['*'] },
    ],
  })
  if (result.canceled) return []
  const imported = []
  for (const source of result.filePaths) {
    const id = crypto.randomUUID()
    const extension = extname(source).toLowerCase()
    const storedName = `${id}${extension}`
    await copyFile(source, join(mediaPath(), storedName))
    imported.push({
      id,
      name: basename(source),
      type: ['.mp3', '.wav'].includes(extension) ? 'audio' : ['.webm', '.mp4', '.mov'].includes(extension) ? 'video' : 'image',
      extension,
      src: `slaycam-asset://media/${storedName}`,
      storedName,
      createdAt: new Date().toISOString(),
    })
  }
  return imported
})

ipcMain.handle('media:remove', async (_event, storedName) => {
  if (typeof storedName !== 'string' || basename(storedName) !== storedName) return false
  await rm(join(mediaPath(), storedName), { force: true })
  return true
})

ipcMain.handle('external:open', async (_event, url) => {
  if (typeof url !== 'string' || !url.startsWith('https://')) return false
  await shell.openExternal(url)
  return true
})

function senderWindow(event) {
  return BrowserWindow.fromWebContents(event.sender)
}

ipcMain.on('renderer:mounted', (event) => {
  const window = senderWindow(event)
  if (!window || window !== mainWindow) return
  rendererReady = true
  if (rendererReadyTimer) clearTimeout(rendererReadyTimer)
  if (rendererRevealTimer) clearTimeout(rendererRevealTimer)
  window.show()
  window.focus()
  void writeAppLog('renderer-mounted', `SlayCam ${app.getVersion()} on ${process.platform}, softwareRendering=${softwareRendering}`)
  if (!startupState.skipPaintWatchdog) rendererPaintTimer = setTimeout(() => void handleMissingFirstFrame(), 6000)
})

ipcMain.on('renderer:painted', (event) => {
  const window = senderWindow(event)
  if (!window || window !== mainWindow || rendererPainted) return
  rendererPainted = true
  if (rendererPaintTimer) clearTimeout(rendererPaintTimer)
  saveStartupState({ failedAttempts: 0 })
  void writeAppLog('renderer-painted', 'The first frame reached the screen')
})

ipcMain.on('renderer:performance', (_event, details) => {
  void writeAppLog('performance', String(details || '').slice(0, 400))
})

ipcMain.on('renderer:error', (_event, details) => {
  void writeAppLog('renderer-error', String(details || '').slice(0, 12000))
})

ipcMain.handle('app:show-log', async () => {
  const path = appLogPath()
  if (!existsSync(path)) await writeAppLog('log-requested', 'The user opened the startup log')
  shell.showItemInFolder(path)
  return true
})

ipcMain.handle('app:restart', () => {
  setImmediate(() => {
    app.relaunch()
    app.exit(0)
  })
  return true
})

ipcMain.handle('window:minimize', (event) => {
  senderWindow(event)?.minimize()
  return true
})
ipcMain.handle('window:toggle-maximize', (event) => {
  const window = senderWindow(event)
  if (!window) return false
  if (window.isMaximized()) window.unmaximize()
  else window.maximize()
  return window.isMaximized()
})
ipcMain.handle('window:is-maximized', (event) => senderWindow(event)?.isMaximized() ?? false)
ipcMain.handle('window:close', (event) => {
  senderWindow(event)?.close()
  return true
})

ipcMain.handle('updater:get-state', () => updaterState)
ipcMain.handle('updater:check', () => checkForUpdates(false))
ipcMain.handle('updater:download', async () => {
  if (isUpdateDemo && updaterState.phase === 'available') {
    updateDemo?.download(updaterState)
    return updaterState
  }
  if (!updatesSupported() || updaterState.phase !== 'available') return updaterState
  currentCheckIsAutomatic = false
  sendUpdaterState({ phase: 'downloading', percent: 0, automatic: false, message: '' })
  try {
    await autoUpdater.downloadUpdate()
  } catch (error) {
    sendUpdaterState({ phase: 'error', message: error instanceof Error ? error.message : 'Не получилось скачать обновление.' })
  }
  return updaterState
})
ipcMain.handle('updater:install', () => {
  if (isUpdateDemo && updaterState.phase === 'downloaded') {
    updateDemo?.install(updaterState)
    return true
  }
  if (!updatesSupported() || updaterState.phase !== 'downloaded') return false
  setImmediate(() => autoUpdater.quitAndInstall(false, true))
  return true
})

ipcMain.handle('virtual-camera:get-state', () => refreshVirtualCameraState())
ipcMain.handle('virtual-camera:install', () => registerVirtualCamera(true))
ipcMain.handle('virtual-camera:uninstall', () => registerVirtualCamera(false))
ipcMain.handle('virtual-camera:start', (_event, width, height, fps) => startVirtualCamera(width, height, fps))
ipcMain.handle('virtual-camera:stop', () => stopVirtualCamera())
ipcMain.on('virtual-camera:frame', (_event, frame) => {
  if (!virtualCameraProcess || !virtualCameraState.streaming || virtualCameraBackpressure) return
  // A frame of the wrong size belongs to a format the running camera no longer uses,
  // and passing it on would shift every following frame.
  if (frame.byteLength !== virtualCameraFormat.bytes) return
  const buffer = Buffer.from(frame)
  virtualCameraBackpressure = !virtualCameraProcess.stdin.write(buffer)
})
