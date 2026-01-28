import { BACKEND_URL } from '../utils/constants'

export type BackendEventItem = {
  id: number
  type: string
  payload?: unknown
  ts: number
}

export async function postCommand(command: string, payload?: unknown): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/commands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, payload })
  })

  if (!res.ok) throw new Error(`command_failed:${command}`)
}

export async function getEvents(since: number): Promise<{ items: BackendEventItem[]; latest: number }> {
  const res = await fetch(`${BACKEND_URL}/events?since=${since}`)
  const json = (await res.json()) as { ok: boolean; items: BackendEventItem[]; latest: number }
  if (!json.ok) throw new Error('events_failed')
  return { items: json.items, latest: json.latest }
}

export async function getKv<T>(key: string): Promise<T> {
  const res = await fetch(`${BACKEND_URL}/kv/${encodeURIComponent(key)}`)
  if (!res.ok) throw new Error('kv_not_found')
  const json = (await res.json()) as { ok: boolean; value: T }
  if (!json.ok) throw new Error('kv_failed')
  return json.value
}

export async function putKv<T>(key: string, value: T): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/kv/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value)
  })
  if (!res.ok) throw new Error('kv_put_failed')
}

