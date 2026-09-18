import { cookies } from 'next/headers'
import { getSession } from '@/lib/auth'
import { SESSION_COOKIE } from '@/lib/constants'

export const dynamic = 'force-dynamic'

export async function GET() {
  const store = await cookies()
  const session = await getSession(store.get(SESSION_COOKIE)?.value)
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 })
  return Response.json({
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
      title: session.user.title,
      mustChangePassword: session.user.mustChangePassword,
      twoFactorEnabled: session.user.twoFactorEnabled,
    },
  })
}
