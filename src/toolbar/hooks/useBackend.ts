import { BACKEND_URL } from '../utils/constants'

export type BackendEventItem = {
  id: number
  type: string
  payload?: unknown
  ts: number
}

declare global {
  interface Window {
    lanstart?: {
      postCommand: (command: string, payload?: unknown) => Promise<unknown>
      getEvents: (since: number) => Promise<{ items: BackendEventItem[]; latest: number }>
      getKv: <T = unknown>(key: string) => Promise<T>
      putKv: (key: string, value: unknown) => Promise<void>
      getUiState: (windowId: string) => Promise<Record<string, unknown>>
      putUiStateKey: (windowId: string, key: string, value: unknown) => Promise<void>
      deleteUiStateKey: (windowId: string, key: string) => Promise<void>
      onEvent?: (listener: (event: BackendEventItem) => void) => () => void
    }
  }
}

let suppressCommandErrors = false

export function markQuitting(): void {
  suppressCommandErrors = true
}

export async function postCommand(command: string, payload?: unknown): Promise<void> {
  try {
    if (window.lanstart?.postCommand) {
      await window.lanstart.postCommand(command, payload)
      return
    }

    const res = await fetch(`${BACKEND_URL}/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, payload })
    })

    if (!res.ok) throw new Error(`command_failed:${command}`)
  } catch (e) {
    if (command === 'quit' || suppressCommandErrors) return
    throw e
  }
}

export async function getEvents(since: number): Promise<{ items: BackendEventItem[]; latest: number }> {
  if (window.lanstart?.getEvents) return await window.lanstart.getEvents(since)
  const res = await fetch(`${BACKEND_URL}/events?since=${since}`)
  const json = (await res.json()) as { ok: boolean; items: BackendEventItem[]; latest: number }
  if (!json.ok) throw new Error('events_failed')
  return { items: json.items, latest: json.latest }
}

export async function getKv<T>(key: string): Promise<T> {
  if (window.lanstart?.getKv) return await window.lanstart.getKv<T>(key)
  const res = await fetch(`${BACKEND_URL}/kv/${encodeURIComponent(key)}`)
  if (!res.ok) throw new Error('kv_not_found')
  const json = (await res.json()) as { ok: boolean; value: T }
  if (!json.ok) throw new Error('kv_failed')
  return json.value
}

export async function putKv<T>(key: string, value: T): Promise<void> {
  if (window.lanstart?.putKv) {
    await window.lanstart.putKv(key, value)
    return
  }
  const res = await fetch(`${BACKEND_URL}/kv/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value)
  })
  if (!res.ok) throw new Error('kv_put_failed')
}

export async function getUiState(windowId: string): Promise<Record<string, unknown>> {
  if (window.lanstart?.getUiState) return await window.lanstart.getUiState(windowId)
  const res = await fetch(`${BACKEND_URL}/ui-state/${encodeURIComponent(windowId)}`)
  const json = (await res.json()) as { ok: boolean; state?: Record<string, unknown> }
  if (!json.ok) throw new Error('ui_state_failed')
  return json.state ?? {}
}

export async function putUiStateKey(windowId: string, key: string, value: unknown): Promise<void> {
  if (window.lanstart?.putUiStateKey) {
    await window.lanstart.putUiStateKey(windowId, key, value)
    return
  }
  const res = await fetch(`${BACKEND_URL}/ui-state/${encodeURIComponent(windowId)}/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value)
  })
  if (!res.ok) throw new Error('ui_state_put_failed')
}

export async function deleteUiStateKey(windowId: string, key: string): Promise<void> {
  if (window.lanstart?.deleteUiStateKey) {
    await window.lanstart.deleteUiStateKey(windowId, key)
    return
  }
  const res = await fetch(`${BACKEND_URL}/ui-state/${encodeURIComponent(windowId)}/${encodeURIComponent(key)}`, {
    method: 'DELETE'
  })
  if (!res.ok) throw new Error('ui_state_del_failed')
}
