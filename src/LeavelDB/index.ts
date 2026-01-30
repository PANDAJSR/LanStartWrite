import { Level } from 'level'

export type LeavelDb = Level<string, unknown>

export function openLeavelDb(dbPath: string): LeavelDb {
  return new Level<string, unknown>(dbPath, { valueEncoding: 'json' })
}

export async function getValue<T = unknown>(db: LeavelDb, key: string): Promise<T> {
  return (await db.get(key)) as T
}

export async function getValueOrUndefined<T = unknown>(db: LeavelDb, key: string): Promise<T | undefined> {
  try {
    return (await db.get(key)) as T
  } catch {
    return undefined
  }
}

export async function putValue<T = unknown>(db: LeavelDb, key: string, value: T): Promise<void> {
  await db.put(key, value as unknown)
}

export async function deleteValue(db: LeavelDb, key: string): Promise<void> {
  await db.del(key)
}

export async function listEntriesByPrefix<T = unknown>(
  db: LeavelDb,
  prefix: string,
  options?: { limit?: number }
): Promise<Array<{ key: string; value: T }>> {
  const limit = Math.max(1, Math.min(50_000, Math.floor(options?.limit ?? 1000)))
  const out: Array<{ key: string; value: T }> = []
  const lt = `${prefix}\uffff`

  for await (const [key, value] of db.iterator({ gte: prefix, lt })) {
    out.push({ key: String(key), value: value as T })
    if (out.length >= limit) break
  }

  return out
}

export async function listKeysByPrefix(db: LeavelDb, prefix: string, options?: { limit?: number }): Promise<string[]> {
  const limit = Math.max(1, Math.min(50_000, Math.floor(options?.limit ?? 1000)))
  const out: string[] = []
  const lt = `${prefix}\uffff`

  for await (const key of db.keys({ gte: prefix, lt })) {
    out.push(String(key))
    if (out.length >= limit) break
  }

  return out
}

export async function deleteByPrefix(db: LeavelDb, prefix: string, options?: { limit?: number }): Promise<number> {
  const limit = Math.max(1, Math.min(500_000, Math.floor(options?.limit ?? 100_000)))
  const lt = `${prefix}\uffff`
  const batchSize = 200
  let deleted = 0
  let ops: Array<{ type: 'del'; key: string }> = []

  for await (const key of db.keys({ gte: prefix, lt })) {
    ops.push({ type: 'del', key: String(key) })
    deleted += 1
    if (deleted >= limit) break
    if (ops.length >= batchSize) {
      await db.batch(ops as any)
      ops = []
    }
  }

  if (ops.length) await db.batch(ops as any)
  return deleted
}
