import { Level } from 'level'

export type LeavelDb = Level<string, unknown>

export function openLeavelDb(dbPath: string): LeavelDb {
  return new Level<string, unknown>(dbPath, { valueEncoding: 'json' })
}

export async function getValue<T = unknown>(db: LeavelDb, key: string): Promise<T> {
  return (await db.get(key)) as T
}

export async function putValue<T = unknown>(db: LeavelDb, key: string, value: T): Promise<void> {
  await db.put(key, value as unknown)
}

export async function deleteValue(db: LeavelDb, key: string): Promise<void> {
  await db.del(key)
}

