import { app, BrowserWindow, dialog, ipcMain, net, Notification, protocol, session, shell } from 'electron'
import electronUpdater from 'electron-updater'
import { copyFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import crypto from 'node:crypto'

const { autoUpdater } = electronUpdater

protocol.registerSchemesAsPrivileged([
  { scheme: 'slaycam-asset', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
  { scheme: 'slaycam-builtin', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
])

let mainWindow
let outputWindow
let latestFrame = ''
let updateCheckTimer
let updateDemoTimer
let currentCheckIsAutomatic = false
let notifiedAvailableVersion = ''
let notifiedDownloadedVersion = ''
let updaterState = { phase: 'idle', currentVersion: app.getVersion() }

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL)
const isUpdateDemo = isDev && process.env.SLAYCAM_UPDATE_DEMO === '1'
const updatesSupported = () => app.isPackaged && process.platform === 'win32'
const configPath = () => join(app.getPath('userData'), 'slaycam.config.json')
const mediaPath = () => join(app.getPath('userData'), 'media')
const builtinMediaPath = () => join(app.getAppPath(), isDev ? 'public' : 'dist', 'default-memes')

const mediaMimeTypes = new Map([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.webm', 'video/webm'],
  ['.mp4', 'video/mp4'],
  ['.mov', 'video/quicktime'],
])

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
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(app.getAppPath(), 'electron/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
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

function demoAvailableState() {
  return {
    phase: 'available',
    currentVersion: '0.1.0',
    version: '0.1.1',
    releaseName: 'SlayCam 0.1.1',
    notes: 'GIF больше не зацикливаются от одного жеста, а движения ловятся точнее.',
    automatic: false,
    percent: 0,
    message: '',
    demo: true,
  }
}

function downloadDemoUpdate() {
  if (updateDemoTimer) clearInterval(updateDemoTimer)
  const steps = [6, 14, 25, 39, 52, 68, 81, 92, 100]
  let step = 0
  sendUpdaterState({ ...updaterState, phase: 'downloading', percent: 0, automatic: false, demo: true })
  updateDemoTimer = setInterval(() => {
    const percent = steps[step++]
    if (percent < 100) {
      sendUpdaterState({ ...updaterState, phase: 'downloading', percent, demo: true })
      return
    }
    clearInterval(updateDemoTimer)
    updateDemoTimer = undefined
    sendUpdaterState({ ...updaterState, phase: 'downloaded', percent: 100, demo: true })
  }, 650)
  return updaterState
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
    sendUpdaterState({ ...updaterState, phase: 'checking', automatic: false, demo: true })
    setTimeout(() => sendUpdaterState(demoAvailableState()), 900)
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

function setupAutoUpdater() {
  if (isUpdateDemo) {
    setTimeout(() => sendUpdaterState(demoAvailableState()), 700)
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

async function createOutputWindow() {
  if (outputWindow && !outputWindow.isDestroyed()) {
    outputWindow.show()
    outputWindow.focus()
    return
  }
  outputWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 640,
    minHeight: 360,
    backgroundColor: '#000000',
    title: 'SlayCam Output',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(app.getAppPath(), 'electron/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  await outputWindow.loadURL(rendererUrl('?output=1'))
  mainWindow?.webContents.send('output:state', true)
  if (latestFrame) outputWindow.webContents.send('output:frame', latestFrame)
  outputWindow.on('closed', () => {
    outputWindow = undefined
    mainWindow?.webContents.send('output:state', false)
  })
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
  setupAutoUpdater()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  if (updateCheckTimer) clearInterval(updateCheckTimer)
  if (updateDemoTimer) clearInterval(updateDemoTimer)
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

ipcMain.handle('media:import', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Добавить медиа в SlayCam',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Изображения и видео', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'webm', 'mp4', 'mov'] },
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
      type: ['.webm', '.mp4', '.mov'].includes(extension) ? 'video' : 'image',
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

ipcMain.handle('output:open', async () => {
  await createOutputWindow()
  return true
})

ipcMain.handle('output:close', async () => {
  outputWindow?.close()
  return true
})

ipcMain.on('output:frame', (_event, frame) => {
  latestFrame = frame
  if (outputWindow && !outputWindow.isDestroyed()) outputWindow.webContents.send('output:frame', frame)
})

ipcMain.handle('external:open', async (_event, url) => {
  if (typeof url !== 'string' || !url.startsWith('https://')) return false
  await shell.openExternal(url)
  return true
})

ipcMain.handle('updater:get-state', () => updaterState)
ipcMain.handle('updater:check', () => checkForUpdates(false))
ipcMain.handle('updater:download', async () => {
  if (isUpdateDemo && updaterState.phase === 'available') return downloadDemoUpdate()
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
    sendUpdaterState({ phase: 'not-available', currentVersion: updaterState.version ?? '0.1.1', demo: true })
    return true
  }
  if (!updatesSupported() || updaterState.phase !== 'downloaded') return false
  setImmediate(() => autoUpdater.quitAndInstall(false, true))
  return true
})
