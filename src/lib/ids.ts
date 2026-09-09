import { db } from '@/lib/db'
import { randomBytes } from 'crypto'

// ------------------------------------------------------------
// Collision-safe sequential human IDs: TECH-2026-000001
// ------------------------------------------------------------
export async function nextClientId(): Promise<string> {
  const year = new Date().getFullYear()
  for (let attempt = 0; attempt < 5; attempt++) {
    const count = await db.client.count()
    const seq = String(count + 1 + attempt).padStart(6, '0')
    const candidate = `TECH-${year}-${seq}`
    const exists = await db.client.findUnique({ where: { clientId: candidate }, select: { id: true } })
    if (!exists) return candidate
  }
  // last resort: random suffix, still unique via DB constraint
  return `TECH-${year}-${randomBytes(3).toString('hex').toUpperCase()}`
}

export async function nextProjectCode(): Promise<string> {
  const year = new Date().getFullYear()
  for (let attempt = 0; attempt < 5; attempt++) {
    const count = await db.project.count()
    const seq = String(count + 1 + attempt).padStart(4, '0')
    const candidate = `PRJ-${year}-${seq}`
    const exists = await db.project.findUnique({ where: { code: candidate }, select: { id: true } })
    if (!exists) return candidate
  }
  return `PRJ-${year}-${randomBytes(3).toString('hex').toUpperCase()}`
}

export async function nextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear()
  for (let attempt = 0; attempt < 5; attempt++) {
    const count = await db.invoice.count()
    const seq = String(count + 1 + attempt).padStart(4, '0')
    const candidate = `INV-${year}-${seq}`
    const exists = await db.invoice.findUnique({ where: { number: candidate }, select: { id: true } })
    if (!exists) return candidate
  }
  return `INV-${year}-${randomBytes(3).toString('hex').toUpperCase()}`
}

export function publicToken(): string {
  return randomBytes(16).toString('hex')
}
