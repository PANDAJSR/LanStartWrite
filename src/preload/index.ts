import { contextBridge, desktopCapturer, ipcRenderer, screen } from 'electron'

type CaptureOptions = { maxSide?: number }

function computeThumbnailSize(input: { width: number; height: number }, maxSide: number) {
  const maxInputSide = Math.max(input.width, input.height)
  if (maxInputSide <= maxSide) return { width: input.width, height: input.height }
  const scale = maxSide / maxInputSide
  return { width: Math.max(1, Math.round(input.width * scale)), height: Math.max(1, Math.round(input.height * scale)) }
}

contextBridge.exposeInMainWorld('hyperGlass', {
  captureDisplayThumbnail: async (options: CaptureOptions = {}) => {
    const bounds = {
      x: Math.round(globalThis.screenX),
      y: Math.round(globalThis.screenY),
      width: Math.round(globalThis.outerWidth),
      height: Math.round(globalThis.outerHeight)
    }
    const display = screen.getDisplayMatching(bounds)
    const maxSide = typeof options.maxSide === 'number' ? Math.max(32, Math.floor(options.maxSide)) : 320
    const thumbSize = computeThumbnailSize(display.size, maxSide)

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: thumbSize.width, height: thumbSize.height },
      fetchWindowIcons: false
    })

    let source = sources[0]
    const displayId = String(display.id)
    for (const s of sources) {
      const sid = String((s as any).display_id ?? (s as any).displayId ?? '')
      if (sid && sid === displayId) {
        source = s
        break
      }
    }

    if (!source) throw new Error('no_screen_source')
    const img = source.thumbnail
    return {
      dataUrl: img.toDataURL(),
      width: img.getSize().width,
      height: img.getSize().height,
      display: {
        id: display.id,
        scaleFactor: display.scaleFactor,
        bounds: display.bounds,
        size: display.size
      }
    }
  }
})

type BackendEventItem = {
  id: number
  type: string
  payload?: unknown
  ts: number
}

type Unsubscribe = () => void

contextBridge.exposeInMainWorld('lanstart', {
  postCommand: async (command: string, payload?: unknown) => {
    return await ipcRenderer.invoke('lanstart:postCommand', { command, payload })
  },
  getEvents: async (since: number) => {
    return await ipcRenderer.invoke('lanstart:getEvents', { since })
  },
  getKv: async (key: string) => {
    return await ipcRenderer.invoke('lanstart:getKv', { key })
  },
  putKv: async (key: string, value: unknown) => {
    return await ipcRenderer.invoke('lanstart:putKv', { key, value })
  },
  getUiState: async (windowId: string) => {
    return await ipcRenderer.invoke('lanstart:getUiState', { windowId })
  },
  putUiStateKey: async (windowId: string, key: string, value: unknown) => {
    return await ipcRenderer.invoke('lanstart:putUiStateKey', { windowId, key, value })
  },
  deleteUiStateKey: async (windowId: string, key: string) => {
    return await ipcRenderer.invoke('lanstart:deleteUiStateKey', { windowId, key })
  },
  onEvent: (listener: (event: BackendEventItem) => void): Unsubscribe => {
    const wrapped = (_evt: unknown, item: BackendEventItem) => listener(item)
    ipcRenderer.on('lanstart:backend-event', wrapped as any)
    return () => {
      ipcRenderer.removeListener('lanstart:backend-event', wrapped as any)
    }
  }
})
