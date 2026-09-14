import { app, BrowserWindow, dialog, ipcMain, net, protocol, session, shell } from 'electron'
import { copyFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import crypto from 'node:crypto'

protocol.registerSchemesAsPrivileged([
  { scheme: 'slaycam-asset', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
  { scheme: 'slaycam-builtin', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
])

let mainWindow
let outputWindow
let latestFrame = ''

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL)
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
  await mkdir(mediaPath(), { recursive: true })
  protocol.handle('slaycam-asset', (request) => assetResponse(request, mediaPath()))
  protocol.handle('slaycam-builtin', (request) => assetResponse(request, builtinMediaPath()))
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media')
  })
  await createMainWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
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
