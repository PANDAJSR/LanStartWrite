import { BrowserWindow, app, screen } from 'electron'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { platform } from 'node:process'

let backendProcess: ChildProcessWithoutNullStreams | undefined

const BACKEND_PORT = 3131
const BACKEND_STDIO_PREFIX = '__LANSTART__'
const WINDOW_ID_FLOATING_TOOLBAR = '浮动工具栏'
const WINDOW_TITLE_FLOATING_TOOLBAR = '浮动工具栏'
const WINDOW_ID_TOOLBAR_SUBWINDOW = 'toolbar-subwindow'

let floatingToolbarWindow: BrowserWindow | undefined
const toolbarSubwindows = new Map<
  string,
  {
    win: BrowserWindow
    placement: 'top' | 'bottom'
    effectivePlacement: 'top' | 'bottom'
    width: number
    height: number
    animationTimer?: NodeJS.Timeout
  }
>()
let scheduledRepositionTimer: NodeJS.Timeout | undefined

function getDevServerUrl(): string | undefined {
  const url = process.env.VITE_DEV_SERVER_URL
  if (url) return url
  if (!app.isPackaged) return 'http://localhost:5173/'
  return undefined
}

function wireWindowDebug(win: BrowserWindow, name: string): void {
  win.webContents.on('did-fail-load', (_e, errorCode, errorDescription, validatedURL) => {
    process.stderr.write(`[${name}] did-fail-load ${errorCode} ${errorDescription} ${validatedURL}\n`)
  })
  win.webContents.on('render-process-gone', (_e, details) => {
    process.stderr.write(`[${name}] render-process-gone ${details.reason} ${details.exitCode}\n`)
  })
  win.webContents.on('unresponsive', () => {
    process.stderr.write(`[${name}] unresponsive\n`)
  })
  win.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    process.stdout.write(`[${name}] console(${level}) ${sourceId}:${line} ${message}\n`)
  })
}

function applyWindowsBackdrop(win: BrowserWindow): void {
  // Windows 11: DWM backdrop (Mica/Acrylic) needs a non-transparent window surface.
  if (process.platform !== 'win32') return
  const setMaterial = (win as any).setBackgroundMaterial as undefined | ((m: string) => void)
  if (typeof setMaterial === 'function') {
    try {
      setMaterial('mica')
      return
    } catch {}
    try {
      setMaterial('acrylic')
      return
    } catch {}
  }
}

function createFloatingToolbarWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 360,
    height: 160,
    frame: false,
    transparent: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    title: WINDOW_TITLE_FLOATING_TOOLBAR,
    backgroundColor: '#00000000',
    backgroundMaterial: 'mica',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  applyWindowsBackdrop(win)
  win.setAlwaysOnTop(true, 'floating')
  wireWindowDebug(win, 'floating-toolbar')
  win.on('move', scheduleRepositionToolbarSubwindows)
  win.on('resize', scheduleRepositionToolbarSubwindows)
  win.on('show', scheduleRepositionToolbarSubwindows)
  win.on('hide', () => {
    for (const item of toolbarSubwindows.values()) {
      if (item.win.isDestroyed()) continue
      item.win.hide()
    }
  })

  const devUrl = getDevServerUrl()
  if (devUrl) {
    win.loadURL(`${devUrl}?window=${encodeURIComponent(WINDOW_ID_FLOATING_TOOLBAR)}`)
    if (process.env.LANSTART_OPEN_DEVTOOLS === '1') win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { query: { window: WINDOW_ID_FLOATING_TOOLBAR } })
  }

  return win
}

function createChildWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 420,
    height: 260,
    resizable: true,
    title: 'LanStart Window',
    backgroundColor: '#00000000',
    backgroundMaterial: 'mica',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  applyWindowsBackdrop(win)
  wireWindowDebug(win, 'child-window')
  const devUrl = getDevServerUrl()
  if (devUrl) {
    win.loadURL(`${devUrl}?window=child`)
    if (process.env.LANSTART_OPEN_DEVTOOLS === '1') win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { query: { window: 'child' } })
  }

  return win
}

function scheduleRepositionToolbarSubwindows() {
  if (scheduledRepositionTimer) return
  scheduledRepositionTimer = setTimeout(() => {
    scheduledRepositionTimer = undefined
    repositionToolbarSubwindows()
  }, 0)
}

type Bounds = { x: number; y: number; width: number; height: number }
type WorkArea = { x: number; y: number; width: number; height: number }

function stopToolbarSubwindowAnimation(item: { animationTimer?: NodeJS.Timeout }) {
  if (!item.animationTimer) return
  clearTimeout(item.animationTimer)
  item.animationTimer = undefined
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

function easeOutBack(t: number) {
  const c1 = 1.08
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

function animateToolbarSubwindowTo(item: { win: BrowserWindow; animationTimer?: NodeJS.Timeout }, to: Bounds, atEdge: boolean) {
  stopToolbarSubwindowAnimation(item)
  const from = item.win.getBounds()
  if (from.x === to.x && from.y === to.y && from.width === to.width && from.height === to.height) return

  const dx = to.x - from.x
  const dy = to.y - from.y
  const dist = Math.hypot(dx, dy)
  const durationMs = Math.max(140, Math.min(240, Math.round(140 + dist * 0.18)))
  const startAt = Date.now()
  const ease = atEdge ? easeOutCubic : easeOutBack

  const tick = () => {
    item.animationTimer = undefined
    if (item.win.isDestroyed()) return
    const now = Date.now()
    const t = Math.max(0, Math.min(1, (now - startAt) / durationMs))
    const k = ease(t)
    const next: Bounds = {
      x: Math.round(from.x + (to.x - from.x) * k),
      y: Math.round(from.y + (to.y - from.y) * k),
      width: Math.round(from.width + (to.width - from.width) * k),
      height: Math.round(from.height + (to.height - from.height) * k)
    }
    item.win.setBounds(next, false)
    if (t >= 1) return
    item.animationTimer = setTimeout(tick, 16)
  }

  item.animationTimer = setTimeout(tick, 0)
}

function computeToolbarSubwindowBounds(
  item: { effectivePlacement: 'top' | 'bottom'; width: number; height: number },
  ownerBounds: Bounds,
  workArea: WorkArea
) {
  const gap = 10
  const widthLimit = Math.max(360, workArea.width - 20)
  const width = Math.max(360, Math.min(widthLimit, Math.round(item.width)))
  const heightLimit = Math.max(60, workArea.height - 20)
  const height = Math.max(60, Math.min(heightLimit, Math.round(item.height)))

  let x = ownerBounds.x
  let y =
    item.effectivePlacement === 'bottom'
      ? ownerBounds.y + ownerBounds.height + gap
      : ownerBounds.y - height - gap

  const xMax = workArea.x + workArea.width - width
  x = Math.max(workArea.x, Math.min(xMax, x))

  const yMax = workArea.y + workArea.height - height
  if (y < workArea.y || y > yMax) {
    item.effectivePlacement = item.effectivePlacement === 'bottom' ? 'top' : 'bottom'
    y =
      item.effectivePlacement === 'bottom'
        ? ownerBounds.y + ownerBounds.height + gap
        : ownerBounds.y - height - gap
    y = Math.max(workArea.y, Math.min(yMax, y))
  }

  const xi = Math.round(x)
  const yi = Math.round(y)
  return {
    bounds: { x: xi, y: yi, width, height },
    atEdge: xi === workArea.x || xi === xMax || yi === workArea.y || yi === yMax
  }
}

function repositionToolbarSubwindows() {
  const owner = floatingToolbarWindow
  if (!owner || owner.isDestroyed()) return
  const ownerBounds = owner.getBounds()
  const display = screen.getDisplayMatching(ownerBounds)
  const workArea = display.workArea

  for (const item of toolbarSubwindows.values()) {
    const win = item.win
    if (win.isDestroyed() || !win.isVisible()) continue
    const { bounds, atEdge } = computeToolbarSubwindowBounds(item, ownerBounds, workArea)
    animateToolbarSubwindowTo(item, bounds, atEdge)
  }
}

function getOrCreateToolbarSubwindow(kind: string, placement: 'top' | 'bottom'): BrowserWindow {
  const existing = toolbarSubwindows.get(kind)
  if (existing && !existing.win.isDestroyed()) {
    existing.placement = placement
    return existing.win
  }

  const owner = floatingToolbarWindow
  if (!owner || owner.isDestroyed()) throw new Error('toolbar_owner_missing')

  const ownerBounds = owner.getBounds()

  const win = new BrowserWindow({
    width: 360,
    height: 220,
    frame: false,
    transparent: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    parent: owner,
    title: `二级菜单-${kind}`,
    backgroundColor: '#00000000',
    backgroundMaterial: 'mica',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  applyWindowsBackdrop(win)
  win.setAlwaysOnTop(true, 'floating')
  wireWindowDebug(win, `subwindow-${kind}`)

  const devUrl = getDevServerUrl()
  if (devUrl) {
    win.loadURL(
      `${devUrl}?window=${encodeURIComponent(WINDOW_ID_TOOLBAR_SUBWINDOW)}&kind=${encodeURIComponent(kind)}`
    )
    if (process.env.LANSTART_OPEN_DEVTOOLS === '1') win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), {
      query: { window: WINDOW_ID_TOOLBAR_SUBWINDOW, kind }
    })
  }

  win.on('closed', () => {
    const item = toolbarSubwindows.get(kind)
    if (item) stopToolbarSubwindowAnimation(item)
    toolbarSubwindows.delete(kind)
  })

  toolbarSubwindows.set(kind, {
    win,
    placement,
    effectivePlacement: placement,
    width: Math.max(360, ownerBounds.width),
    height: 220
  })
  scheduleRepositionToolbarSubwindows()
  return win
}

function closeOtherToolbarSubwindows(exceptKind: string) {
  for (const [kind, item] of toolbarSubwindows.entries()) {
    if (kind === exceptKind) continue
    const win = item.win
    if (win.isDestroyed()) continue
    stopToolbarSubwindowAnimation(item)
    if (win.isVisible()) win.hide()
  }
}

function toggleToolbarSubwindow(kind: string, placement: 'top' | 'bottom') {
  const win = getOrCreateToolbarSubwindow(kind, placement)
  const item = toolbarSubwindows.get(kind)
  if (!item) return

  item.placement = placement

  if (win.isVisible()) {
    win.hide()
    return
  }

  item.effectivePlacement = placement
  closeOtherToolbarSubwindows(kind)
  const owner = floatingToolbarWindow
  if (owner && !owner.isDestroyed()) {
    const ownerBounds = owner.getBounds()
    const display = screen.getDisplayMatching(ownerBounds)
    const { bounds } = computeToolbarSubwindowBounds(item, ownerBounds, display.workArea)
    win.setBounds(bounds, false)
  }
  scheduleRepositionToolbarSubwindows()
  win.showInactive()
}

function setToolbarSubwindowHeight(kind: string, height: number) {
  const item = toolbarSubwindows.get(kind)
  if (!item || item.win.isDestroyed()) return
  item.height = height
  scheduleRepositionToolbarSubwindows()
}

function setToolbarSubwindowBounds(kind: string, bounds: { width: number; height: number }) {
  const item = toolbarSubwindows.get(kind)
  if (!item || item.win.isDestroyed()) return
  item.width = bounds.width
  item.height = bounds.height
  scheduleRepositionToolbarSubwindows()
}

function sendToBackend(message: unknown): void {
  if (!backendProcess?.stdin.writable) return
  backendProcess.stdin.write(`${JSON.stringify(message)}\n`)
}

function handleBackendControlMessage(message: any): void {
  if (!message || typeof message !== 'object') return

  if (message.type === 'CREATE_WINDOW') {
    const win = createChildWindow()
    win.once('ready-to-show', () => win.show())
    sendToBackend({ type: 'WINDOW_CREATED', window: 'child' })
    return
  }

  if (message.type === 'TOGGLE_SUBWINDOW') {
    const kind = String((message as any).kind ?? '')
    const placementRaw = String((message as any).placement ?? '')
    const placement = placementRaw === 'top' ? 'top' : placementRaw === 'bottom' ? 'bottom' : undefined
    if (!kind || !placement) return
    try {
      toggleToolbarSubwindow(kind, placement)
    } catch {
      return
    }
    return
  }

  if (message.type === 'SET_SUBWINDOW_HEIGHT') {
    const kind = String((message as any).kind ?? '')
    const height = Number((message as any).height)
    if (!kind || !Number.isFinite(height)) return
    setToolbarSubwindowHeight(kind, height)
    return
  }

  if (message.type === 'SET_SUBWINDOW_BOUNDS') {
    const kind = String((message as any).kind ?? '')
    const width = Number((message as any).width)
    const height = Number((message as any).height)
    if (!kind || !Number.isFinite(width) || !Number.isFinite(height)) return
    setToolbarSubwindowBounds(kind, { width, height })
    return
  }

  if (message.type === 'SET_TOOLBAR_ALWAYS_ON_TOP') {
    const value = Boolean(message.value)
    floatingToolbarWindow?.setAlwaysOnTop(value, 'floating')
    for (const item of toolbarSubwindows.values()) {
      if (item.win.isDestroyed()) continue
      item.win.setAlwaysOnTop(value, 'floating')
    }
    return
  }

  if (message.type === 'SET_TOOLBAR_BOUNDS') {
    const width = Number(message.width)
    const height = Number(message.height)
    if (!Number.isFinite(width) || !Number.isFinite(height)) return
    const win = floatingToolbarWindow
    if (!win) return
    const bounds = win.getBounds()
    const nextWidth = Math.max(1, Math.min(1200, Math.round(width)))
    const nextHeight = Math.max(1, Math.min(600, Math.round(height)))
    win.setBounds({ ...bounds, width: nextWidth, height: nextHeight }, false)
    scheduleRepositionToolbarSubwindows()
    return
  }

  if (message.type === 'QUIT_APP') {
    app.quit()
    return
  }
}

function wireBackendStdout(stdout: NodeJS.ReadableStream): void {
  let buffer = ''
  stdout.on('data', (chunk) => {
    buffer += chunk.toString('utf8')
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith(BACKEND_STDIO_PREFIX)) {
        if (trimmed) process.stdout.write(`${trimmed}\n`)
        continue
      }
      const jsonText = trimmed.slice(BACKEND_STDIO_PREFIX.length)
      try {
        const msg = JSON.parse(jsonText)
        handleBackendControlMessage(msg)
      } catch {
        continue
      }
    }
  })
}

function startBackend(): void {
  const dbPath = join(app.getPath('userData'), 'leveldb')
  const env = {
    ...process.env,
    LANSTART_BACKEND_PORT: String(BACKEND_PORT),
    LANSTART_DB_PATH: dbPath
  }

  const isDev = Boolean(getDevServerUrl())
  const projectRoot = process.cwd()

  if (isDev) {
    const backendEntry = join(projectRoot, 'src/elysia/index.ts')
    const tsxCliMjs = join(projectRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs')
    if (existsSync(tsxCliMjs)) {
      backendProcess = spawn(process.execPath, [tsxCliMjs, backendEntry], {
        cwd: projectRoot,
        env: { ...env, ELECTRON_RUN_AS_NODE: '1' },
        stdio: ['pipe', 'pipe', 'pipe']
      })
    } else {
      const localTsxBin =
        platform === 'win32'
          ? join(projectRoot, 'node_modules', '.bin', 'tsx.cmd')
          : join(projectRoot, 'node_modules', '.bin', 'tsx')
      const tsxBin = existsSync(localTsxBin) ? localTsxBin : 'tsx'

      if (platform === 'win32' && tsxBin.toLowerCase().endsWith('.cmd')) {
        const comspec = process.env.comspec ?? 'cmd.exe'
        const cmdLine = `""${tsxBin}" "${backendEntry}""`
        backendProcess = spawn(comspec, ['/d', '/s', '/c', cmdLine], {
          cwd: projectRoot,
          env,
          stdio: ['pipe', 'pipe', 'pipe']
        })
      } else {
        backendProcess = spawn(tsxBin, [backendEntry], {
          cwd: projectRoot,
          env,
          stdio: ['pipe', 'pipe', 'pipe']
        })
      }
    }
  } else {
    const backendEntry = join(__dirname, '..', 'elysia', 'index.js')
    backendProcess = spawn(process.execPath, [backendEntry], {
      cwd: join(__dirname, '..'),
      env: { ...env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: ['pipe', 'pipe', 'pipe']
    })
  }

  backendProcess.on('exit', () => {
    backendProcess = undefined
  })

  wireBackendStdout(backendProcess.stdout)

  backendProcess.stderr.on('data', (chunk) => {
    process.stderr.write(chunk)
  })
}

app
  .whenReady()
  .then(() => {
    try {
      startBackend()
    } catch (e) {
      process.stderr.write(String(e))
    }
    const win = createFloatingToolbarWindow()
    floatingToolbarWindow = win
    win.once('ready-to-show', () => win.show())

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        floatingToolbarWindow = createFloatingToolbarWindow()
      }
    })
  })
  .catch((e) => {
    process.stderr.write(String(e))
  })

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  if (backendProcess && !backendProcess.killed) backendProcess.kill()
})
