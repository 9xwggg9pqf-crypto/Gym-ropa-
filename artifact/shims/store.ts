// Almacén privado por persona en la base de datos del artefacto:
// data/users/<id>/profile y data/users/<id>/app/<colección>/<doc>.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { cap, userId } from './runtime'

export async function profileDoc() {
  const [db, id] = await Promise.all([cap<any>('db'), userId()])
  if (!db || !id) return null
  return db.doc(`data/users/${id}/profile`)
}

export async function coll(name: string) {
  const [db, id] = await Promise.all([cap<any>('db'), userId()])
  if (!db || !id) throw new Error('not_configured')
  return db.doc(`data/users/${id}/app`).collection(name)
}

export function newId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`
}

export async function listAll<T>(name: string): Promise<T[]> {
  const c = await coll(name)
  const snap = await c.limit(1000).get()
  return snap.docs.map((d: any) => ({ ...(d.data() as object), id: d.id }) as T)
}

export async function getOne<T>(name: string, id: string): Promise<T | null> {
  const c = await coll(name)
  const s = await c.doc(id).get()
  return s.exists ? ({ ...(s.data() as object), id: s.id } as T) : null
}

/** Documentos sin `undefined` (no es JSON válido). */
export function clean<T>(o: T): T {
  return JSON.parse(JSON.stringify(o)) as T
}

export async function insertOne<T extends Record<string, unknown>>(name: string, row: T): Promise<T & { id: string }> {
  const c = await coll(name)
  const id = (row.id as string) || newId()
  const body = clean({ ...row, id, created_at: (row.created_at as string) ?? new Date().toISOString() })
  await c.doc(id).set(body)
  return body as T & { id: string }
}

export async function patchOne<T>(name: string, id: string, patch: Partial<T>): Promise<T | null> {
  const c = await coll(name)
  const ref = c.doc(id)
  const s = await ref.get()
  if (!s.exists) return null
  const body = clean({ ...(s.data() as object), ...patch, id, updated_at: new Date().toISOString() })
  await ref.set(body)
  return body as T
}

export async function removeOne(name: string, id: string) {
  const c = await coll(name)
  await c.doc(id).delete()
}
