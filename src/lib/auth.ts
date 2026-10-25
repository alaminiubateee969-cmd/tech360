<<<<<<< HEAD
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'crypto'
import { db } from '@/lib/db'
import type { Session } from '@prisma/client'
import { cookies } from 'next/headers'
import { SESSION_COOKIE, SESSION_TTL_HOURS, CSRF_COOKIE } from '@/lib/constants'
export { hasRole, isSuperAdmin } from '@/lib/access-policy'

// ------------------------------------------------------------
// Password hashing — scrypt (no plaintext, constant-time compare)
// ------------------------------------------------------------
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `scrypt:${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, salt, hash] = stored.split(':')
    if (scheme !== 'scrypt' || !salt || !hash) return false
    const candidate = scryptSync(password, salt, 64)
    const expected = Buffer.from(hash, 'hex')
    return candidate.length === expected.length && timingSafeEqual(candidate, expected)
  } catch {
    return false
  }
}

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

// ------------------------------------------------------------
// Sessions — DB-backed, HttpOnly cookie, expiry, lockout
// ------------------------------------------------------------
export async function createSession(userId: string, ip?: string, userAgent?: string): Promise<Session> {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600 * 1000)
  return db.session.create({
    data: { token, userId, expiresAt, ip: ip ?? null, userAgent: userAgent ?? null },
  })
}

export type SessionWithUser = Session & { user: { id: string; email: string; name: string | null; role: string; title: string | null; isActive: boolean; mustChangePassword: boolean; twoFactorEnabled: boolean } }

export async function getSession(token: string | undefined | null): Promise<SessionWithUser | null> {
  if (!token) return null
  const session = await db.session.findUnique({ where: { token }, include: { user: true } })
  if (!session) return null
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => null)
    return null
  }
  if (!session.user.isActive) return null
  return session
}

export async function destroySession(token: string | undefined | null): Promise<void> {
  if (!token) return
  await db.session.deleteMany({ where: { token } }).catch(() => null)
}

export async function currentUser(): Promise<SessionWithUser['user'] | null> {
  const store = await cookies()
  const session = await getSession(store.get(SESSION_COOKIE)?.value)
  return session?.user ?? null
}

export function sessionTokenFromCookieStore(store: { get: (n: string) => { value: string } | undefined }) {
  return store.get(SESSION_COOKIE)?.value
}

// ------------------------------------------------------------
// CSRF — double-submit token validation for mutating requests
// ------------------------------------------------------------
export function makeCsrfToken(): string {
  return randomBytes(24).toString('hex')
}

export async function assertCsrf(req: Request): Promise<boolean> {
  const store = await cookies()
  const cookieToken = store.get(CSRF_COOKIE)?.value
  const headerToken = req.headers.get('x-csrf-token')
  if (!cookieToken || !headerToken) return false
  const a = Buffer.from(cookieToken)
  const b = Buffer.from(headerToken)
  return a.length === b.length && timingSafeEqual(a, b)
=======
import { NextRequest, NextResponse } from "next/server";
import { getServerSession as nextAuthGetServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

const SECRET = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || "dev-only-not-for-production";

declare module "next-auth" {
  interface Session { user: { id: string; email: string; name?: string | null; role: string } }
  interface User { id: string; email: string; name?: string | null; role: string }
}
declare module "next-auth/jwt" { interface JWT { id?: string; role?: string } }

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  secret: SECRET,
  pages: { signIn: "/" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" } },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await db.user.findUnique({ where: { email: credentials.email } });
        if (!user || !user.password) return null;
        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) return null;
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) { if (user) { token.id = user.id; token.role = user.role; } return token; },
    async session({ session, token }) { if (session.user) { session.user.id = token.id as string; session.user.role = token.role as string; } return session; },
  },
};

export async function getCurrentUser(req: NextRequest) {
  const session = await nextAuthGetServerSession(authOptions as any) as any;
  if (!session?.user) return null;
  return { id: session.user.id, email: session.user.email, name: session.user.name, role: session.user.role };
}

type AuthResult = { ok: true; session: { user: { id: string; email: string; name?: string | null; role: string } } } | { ok: false; response: NextResponse };

export async function requireAuth(req: NextRequest): Promise<AuthResult> {
  const user = await getCurrentUser(req);
  if (!user) return { ok: false, response: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
  return { ok: true, session: { user } };
}

export async function requireRole(roles: string[], req: NextRequest): Promise<AuthResult> {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth;
  if (!roles.includes(auth.session.user.role)) return { ok: false, response: NextResponse.json({ error: "Insufficient role" }, { status: 403 }) };
  return auth;
>>>>>>> upload/tech360-production-final
}
