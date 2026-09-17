import { app, BrowserWindow, dialog, ipcMain, net, Notification, protocol, session, shell } from 'electron'
import electronUpdater from 'electron-updater'
import { existsSync } from 'node:fs'
import { copyFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
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
let virtualCameraBackpressure = false
let virtualCameraState = { phase: 'unsupported', installed: false, streaming: false, message: 'Доступно в Windows-версии' }

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
  headers.set('Cache-Control', 'no-cache')
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

function rendererUrl(query = '') {
  if (isDev) return `${process.env.VITE_DEV_SERVER_URL}${query}`
  return `${pathToFileURL(join(app.getAppPath(), 'dist/index.html')).toString()}${query}`
}

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 720,
    backgroundColor: '#f4edf2',
    title: 'SlayCam',
    frame: false,
    icon: join(app.getAppPath(), isDev ? 'public/brand-icon.png' : 'dist/brand-icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(app.getAppPath(), 'electron/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  })
  mainWindow.on('maximize', () => mainWindow?.webContents.send('window:maximized', true))
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('window:maximized', false))
  await mainWindow.loadURL(rendererUrl())
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

function startVirtualCamera(width, height, fps) {
  if (process.platform !== 'win32' || !virtualCameraFilesAvailable() || !virtualCameraInstalled()) return refreshVirtualCameraState()
  if (virtualCameraProcess) return virtualCameraState
  const safeWidth = Math.max(320, Math.min(1920, Math.round(Number(width) / 4) * 4))
  const safeHeight = Math.max(180, Math.min(1080, Math.round(Number(height) / 4) * 4))
  const safeFps = Math.max(10, Math.min(30, Math.round(Number(fps))))
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

app.whenReady().then(async () => {
  app.setAppUserModelId('by.grossmeister.slaycam')
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
  const buffer = Buffer.from(frame)
  virtualCameraBackpressure = !virtualCameraProcess.stdin.write(buffer)
})
