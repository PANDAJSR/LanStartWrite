import { Elysia, t } from 'elysia'
import { node } from '@elysiajs/node'
import { createInterface } from 'node:readline'
import { deleteByPrefix, deleteValue, getValue, openLeavelDb, putValue } from '../LeavelDB'

type EventItem = {
  id: number
  type: string
  payload?: unknown
  ts: number
}

const port = Number(process.env.LANSTART_BACKEND_PORT ?? 3131)
const dbPath = process.env.LANSTART_DB_PATH ?? './leveldb'
const transport = String(process.env.LANSTART_BACKEND_TRANSPORT ?? 'http')

const db = openLeavelDb(dbPath)

let nextEventId = 1
const events: EventItem[] = []
const MAX_EVENTS = 200

function emitEvent(type: string, payload?: unknown): EventItem {
  const item: EventItem = { id: nextEventId++, type, payload, ts: Date.now() }
  events.push(item)
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS)
  requestMain({ type: 'BACKEND_EVENT', event: item })
  return item
}

function requestMain(message: unknown): void {
  process.stdout.write(`__LANSTART__${JSON.stringify(message)}\n`)
}

const uiState = new Map<string, Record<string, unknown>>()
const runtimeWindows = new Map<string, unknown>()
const runtimeProcesses = new Map<string, unknown>()

function getOrInitUiState(windowId: string): Record<string, unknown> {
  const existing = uiState.get(windowId)
  if (existing) return existing
  const created: Record<string, unknown> = {}
  uiState.set(windowId, created)
  return created
}

function cleanupMonitoringData(): void {
  uiState.clear()
  runtimeWindows.clear()
  runtimeProcesses.clear()
  events.splice(0, events.length)
  nextEventId = 1
}

async function cleanupLegacyPersistedMonitoringData(): Promise<void> {
  await deleteByPrefix(db, 'ev:')
  await deleteByPrefix(db, 'ui:state:')
  await deleteByPrefix(db, 'runtime:window:')
  await deleteByPrefix(db, 'runtime:process:')
}

type CommandResult = { ok: true } | { ok: false; error: string }

function coerceString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

async function handleCommand(command: string, payload: unknown): Promise<CommandResult> {
  emitEvent('COMMAND', { command, payload })

  const dot = command.indexOf('.')
  if (dot > 0) {
    const scope = command.slice(0, dot)
    const action = command.slice(dot + 1)

    if (scope === 'win') {
      if (action === 'createWindow') {
        requestMain({ type: 'CREATE_WINDOW' })
        return { ok: true }
      }

      if (action === 'toggleSubwindow') {
        const kind = coerceString((payload as any)?.kind)
        const placementRaw = coerceString((payload as any)?.placement)
        const placement = placementRaw === 'top' ? 'top' : placementRaw === 'bottom' ? 'bottom' : undefined
        if (!kind || !placement) return { ok: false, error: 'BAD_SUBWINDOW' }
        requestMain({ type: 'TOGGLE_SUBWINDOW', kind, placement })
        return { ok: true }
      }

      if (action === 'setSubwindowHeight') {
        const kind = coerceString((payload as any)?.kind)
        const height = Number((payload as any)?.height)
        if (!kind || !Number.isFinite(height)) return { ok: false, error: 'BAD_SUBWINDOW_HEIGHT' }
        requestMain({ type: 'SET_SUBWINDOW_HEIGHT', kind, height })
        return { ok: true }
      }

      if (action === 'setSubwindowBounds') {
        const kind = coerceString((payload as any)?.kind)
        const width = Number((payload as any)?.width)
        const height = Number((payload as any)?.height)
        if (!kind || !Number.isFinite(width) || !Number.isFinite(height)) return { ok: false, error: 'BAD_SUBWINDOW_BOUNDS' }
        requestMain({ type: 'SET_SUBWINDOW_BOUNDS', kind, width, height })
        return { ok: true }
      }

      if (action === 'setToolbarAlwaysOnTop') {
        const value = Boolean((payload as any)?.value)
        requestMain({ type: 'SET_TOOLBAR_ALWAYS_ON_TOP', value })
        return { ok: true }
      }

      if (action === 'setToolbarBounds') {
        const width = Number((payload as any)?.width)
        const height = Number((payload as any)?.height)
        if (!Number.isFinite(width) || !Number.isFinite(height)) return { ok: false, error: 'BAD_BOUNDS' }
        requestMain({ type: 'SET_TOOLBAR_BOUNDS', width, height })
        return { ok: true }
      }

      if (action === 'quit') {
        requestMain({ type: 'QUIT_APP' })
        return { ok: true }
      }

      return { ok: false, error: 'UNKNOWN_COMMAND' }
    }

    if (scope === 'qt') {
      requestMain({ type: 'QT_COMMAND', action, payload })
      emitEvent('QT_COMMAND', { action, payload })
      return { ok: true }
    }

    if (scope === 'fs' || scope === 'img') {
      return { ok: false, error: 'NOT_IMPLEMENTED' }
    }

    return { ok: false, error: 'UNKNOWN_COMMAND' }
  }

  if (command === 'create-window') {
    requestMain({ type: 'CREATE_WINDOW' })
    return { ok: true }
  }

  if (command === 'toggle-subwindow') {
    const kind = coerceString((payload as any)?.kind)
    const placementRaw = coerceString((payload as any)?.placement)
    const placement = placementRaw === 'top' ? 'top' : placementRaw === 'bottom' ? 'bottom' : undefined
    if (!kind || !placement) return { ok: false, error: 'BAD_SUBWINDOW' }
    requestMain({ type: 'TOGGLE_SUBWINDOW', kind, placement })
    return { ok: true }
  }

  if (command === 'set-subwindow-height') {
    const kind = coerceString((payload as any)?.kind)
    const height = Number((payload as any)?.height)
    if (!kind || !Number.isFinite(height)) return { ok: false, error: 'BAD_SUBWINDOW_HEIGHT' }
    requestMain({ type: 'SET_SUBWINDOW_HEIGHT', kind, height })
    return { ok: true }
  }

  if (command === 'set-subwindow-bounds') {
    const kind = coerceString((payload as any)?.kind)
    const width = Number((payload as any)?.width)
    const height = Number((payload as any)?.height)
    if (!kind || !Number.isFinite(width) || !Number.isFinite(height)) return { ok: false, error: 'BAD_SUBWINDOW_BOUNDS' }
    requestMain({ type: 'SET_SUBWINDOW_BOUNDS', kind, width, height })
    return { ok: true }
  }

  if (command === 'set-toolbar-always-on-top') {
    const value = Boolean((payload as any)?.value)
    requestMain({ type: 'SET_TOOLBAR_ALWAYS_ON_TOP', value })
    return { ok: true }
  }

  if (command === 'set-toolbar-bounds') {
    const width = Number((payload as any)?.width)
    const height = Number((payload as any)?.height)
    if (!Number.isFinite(width) || !Number.isFinite(height)) return { ok: false, error: 'BAD_BOUNDS' }
    requestMain({ type: 'SET_TOOLBAR_BOUNDS', width, height })
    return { ok: true }
  }

  if (command === 'quit') {
    requestMain({ type: 'QUIT_APP' })
    return { ok: true }
  }

  return { ok: false, error: 'UNKNOWN_COMMAND' }
}

const stdin = createInterface({ input: process.stdin, crlfDelay: Infinity })
stdin.on('line', (line) => {
  const trimmed = line.trim()
  if (!trimmed) return
  try {
    const msg = JSON.parse(trimmed)
    const type = String((msg as any)?.type ?? '')

    if (type === 'RPC_REQUEST') {
      const id = Number((msg as any)?.id)
      const method = String((msg as any)?.method ?? '')
      const params = (msg as any)?.params as any
      if (!Number.isFinite(id) || !method) return

      void (async () => {
        try {
          if (method === 'postCommand') {
            const command = coerceString(params?.command)
            const payload = params?.payload as unknown
            if (!command) throw new Error('BAD_COMMAND')
            const res = await handleCommand(command, payload)
            if (!res.ok) throw new Error(res.error)
            requestMain({ type: 'RPC_RESPONSE', id, ok: true, result: null })
            return
          }

          if (method === 'getEvents') {
            const since = Number(params?.since ?? 0)
            const items = events.filter((e) => e.id > since)
            requestMain({ type: 'RPC_RESPONSE', id, ok: true, result: { items, latest: events.at(-1)?.id ?? since } })
            return
          }

          if (method === 'getKv') {
            const key = coerceString(params?.key)
            if (!key) throw new Error('BAD_KEY')
            try {
              const value = await getValue(db, key)
              emitEvent('KV_GET', { key })
              requestMain({ type: 'RPC_RESPONSE', id, ok: true, result: value })
              return
            } catch {
              throw new Error('kv_not_found')
            }
          }

          if (method === 'putKv') {
            const key = coerceString(params?.key)
            if (!key) throw new Error('BAD_KEY')
            await putValue(db, key, params?.value)
            emitEvent('KV_PUT', { key })
            requestMain({ type: 'RPC_RESPONSE', id, ok: true, result: null })
            return
          }

          if (method === 'getUiState') {
            const windowId = coerceString(params?.windowId)
            if (!windowId) throw new Error('BAD_WINDOW_ID')
            const state = getOrInitUiState(windowId)
            emitEvent('UI_STATE_GET', { windowId })
            requestMain({ type: 'RPC_RESPONSE', id, ok: true, result: state })
            return
          }

          if (method === 'putUiStateKey') {
            const windowId = coerceString(params?.windowId)
            const key = coerceString(params?.key)
            if (!windowId || !key) throw new Error('BAD_UI_STATE_KEY')
            const state = getOrInitUiState(windowId)
            state[key] = params?.value
            emitEvent('UI_STATE_PUT', { windowId, key, value: params?.value })
            requestMain({ type: 'RPC_RESPONSE', id, ok: true, result: null })
            return
          }

          if (method === 'deleteUiStateKey') {
            const windowId = coerceString(params?.windowId)
            const key = coerceString(params?.key)
            if (!windowId || !key) throw new Error('BAD_UI_STATE_KEY')
            const state = getOrInitUiState(windowId)
            delete state[key]
            emitEvent('UI_STATE_DEL', { windowId, key })
            requestMain({ type: 'RPC_RESPONSE', id, ok: true, result: null })
            return
          }

          throw new Error('UNKNOWN_METHOD')
        } catch (e) {
          requestMain({ type: 'RPC_RESPONSE', id, ok: false, error: String(e) })
        }
      })()
      return
    }

    if (type === 'CLEANUP_RUNTIME') {
      cleanupMonitoringData()
      emitEvent('CLEANUP_RUNTIME')
      return
    }

    if (type === 'WINDOW_STATUS') {
      const windowId = String((msg as any)?.windowId ?? '')
      if (windowId) {
        runtimeWindows.set(windowId, msg as unknown)
        emitEvent('WINDOW_STATUS', msg)
        return
      }
    }

    if (type === 'PROCESS_STATUS') {
      const name = String((msg as any)?.name ?? '')
      if (name) {
        runtimeProcesses.set(name, msg as unknown)
        emitEvent('PROCESS_STATUS', msg)
        return
      }
    }

    emitEvent('MAIN_MESSAGE', msg)
  } catch {
    return
  }
})

const api = new Elysia({ adapter: node() })
  .onRequest(({ request, set }) => {
    set.headers['Access-Control-Allow-Origin'] = '*'
    set.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS'
    set.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    if (request.method === 'OPTIONS') {
      set.status = 204
      return ''
    }
  })
  .get('/health', () => ({ ok: true, port }))
  .get(
    '/kv/:key',
    async ({ params, set }) => {
      try {
        const value = await getValue(db, params.key)
        emitEvent('KV_GET', { key: params.key })
        return { ok: true, key: params.key, value }
      } catch {
        set.status = 404
        return { ok: false, key: params.key, error: 'NOT_FOUND' }
      }
    },
    { params: t.Object({ key: t.String() }) }
  )
  .put(
    '/kv/:key',
    async ({ params, body }) => {
      await putValue(db, params.key, body)
      emitEvent('KV_PUT', { key: params.key })
      return { ok: true, key: params.key }
    },
    { params: t.Object({ key: t.String() }), body: t.Any() }
  )
  .delete(
    '/kv/:key',
    async ({ params }) => {
      await deleteValue(db, params.key)
      emitEvent('KV_DEL', { key: params.key })
      return { ok: true, key: params.key }
    },
    { params: t.Object({ key: t.String() }) }
  )
  .get(
    '/ui-state/:windowId',
    async ({ params }) => {
      const state = getOrInitUiState(params.windowId)
      emitEvent('UI_STATE_GET', { windowId: params.windowId })
      return { ok: true, windowId: params.windowId, state }
    },
    { params: t.Object({ windowId: t.String() }) }
  )
  .put(
    '/ui-state/:windowId/:key',
    async ({ params, body }) => {
      const state = getOrInitUiState(params.windowId)
      state[params.key] = body
      emitEvent('UI_STATE_PUT', { windowId: params.windowId, key: params.key, value: body })
      return { ok: true, windowId: params.windowId, key: params.key }
    },
    { params: t.Object({ windowId: t.String(), key: t.String() }), body: t.Any() }
  )
  .delete(
    '/ui-state/:windowId/:key',
    async ({ params }) => {
      const state = getOrInitUiState(params.windowId)
      delete state[params.key]
      emitEvent('UI_STATE_DEL', { windowId: params.windowId, key: params.key })
      return { ok: true, windowId: params.windowId, key: params.key }
    },
    { params: t.Object({ windowId: t.String(), key: t.String() }) }
  )
  .get('/runtime/windows', async () => {
    const out: Record<string, unknown> = Object.create(null) as Record<string, unknown>
    for (const [id, value] of runtimeWindows.entries()) out[id] = value
    emitEvent('RUNTIME_WINDOWS_GET')
    return { ok: true, windows: out }
  })
  .get('/runtime/processes', async () => {
    const out: Record<string, unknown> = Object.create(null) as Record<string, unknown>
    for (const [id, value] of runtimeProcesses.entries()) out[id] = value
    emitEvent('RUNTIME_PROCESSES_GET')
    return { ok: true, processes: out }
  })
  .post(
    '/commands',
    async ({ body, set }) => {
      const { command, payload } = body
      const res = await handleCommand(command, payload)
      if (!res.ok) set.status = 400
      return res
    },
    {
      body: t.Object({
        command: t.String(),
        payload: t.Optional(t.Any())
      })
    }
  )
  .get(
    '/events',
    async ({ query }) => {
      const since = Number(query.since ?? 0)
      const items = events.filter((e) => e.id > since)
      return { ok: true, items, latest: events.at(-1)?.id ?? since }
    },
    { query: t.Object({ since: t.Optional(t.String()) }) }
  )

async function bootstrap(): Promise<void> {
  try {
    await cleanupLegacyPersistedMonitoringData()
  } catch {}

  if (transport !== 'stdio') {
    api.listen({ hostname: '127.0.0.1', port })
    emitEvent('BACKEND_STARTED', { transport, port, dbPath })
    console.log(`[backend] listening on http://127.0.0.1:${port}`)
    return
  }

  emitEvent('BACKEND_STARTED', { transport, dbPath })
}

bootstrap().catch((e) => {
  process.stderr.write(String(e))
})
