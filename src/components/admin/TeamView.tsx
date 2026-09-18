'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  BadgeCheck,
  KeyRound,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  UserRound,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'

import { api, ApiError, fmtDate, type TeamMember } from '@/lib/admin-client'
import { KpiCard, PageHeader, SectionCard, EmptyState } from './shared/cards'
import { StatusBadge } from './shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// ============================================================
// TEAM — console user & role management (SUPER_ADMIN).
// Real user records from /api/admin/team: create users with a
// one-time password, change roles, disable accounts, reset
// passwords. Every action here is audited server-side.
// ============================================================

const ROLE_ORDER = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'] as const

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    SUPER_ADMIN: { label: 'Super Admin', cls: 'border-red-500/40 bg-red-500/10 text-red-400' },
    ADMIN: { label: 'Admin', cls: 'border-[#009FE3]/40 bg-[#009FE3]/10 text-[#009FE3]' },
    MANAGER: { label: 'Manager', cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' },
    STAFF: { label: 'Staff', cls: 'border-slate-500/40 bg-slate-500/10 text-slate-400' },
  }
  const r = map[role] ?? { label: role, cls: 'border-slate-500/40 bg-slate-500/10 text-slate-400' }
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${r.cls}`}>
      {r.label}
    </span>
  )
}

function OneTimeSecret({ password, onDone, title = 'One-time password' }: { password: string; onDone: () => void; title?: string }) {
  return (
    <div className="space-y-3">
      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-300">
        <p className="flex items-center gap-1.5 font-semibold">
          <ShieldAlert className="size-4" aria-hidden="true" /> {title}
        </p>
        <p className="mt-1">
          Shown once — copy it now and share it with the user over a secure channel. The user must set
          their own password at first sign-in.
        </p>
      </div>
      <div className="flex items-center justify-center gap-2 rounded-md border border-slate-800 bg-slate-950/60 px-4 py-3">
        <code className="select-all break-all font-mono text-base font-semibold tracking-wider text-[#009FE3]">{password}</code>
      </div>
      <Button onClick={onDone} className="w-full" style={{ background: '#009FE3' }}>
        <BadgeCheck className="size-4" aria-hidden="true" /> I saved it — done
      </Button>
    </div>
  )
}

export function TeamView() {
  const [tick, setTick] = useState(0)
  const [busy, setBusy] = useState(false)
  const [users, setUsers] = useState<TeamMember[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [meEmail, setMeEmail] = useState<string | null>(null)

  // create dialog state
  const [createOpen, setCreateOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState<string>('STAFF')
  const [newTitle, setNewTitle] = useState('')
  const [createdPassword, setCreatedPassword] = useState<string | null>(null)

  // reset password state
  const [resetTarget, setResetTarget] = useState<TeamMember | null>(null)
  const [resetPassword, setResetPassword] = useState<string | null>(null)

  // role change state
  const [roleTarget, setRoleTarget] = useState<TeamMember | null>(null)
  const [roleValue, setRoleValue] = useState<string>('STAFF')

  useEffect(() => {
    api
      .me()
      .then((r) => setMeEmail(r.user?.email ?? null))
      .catch(() => setMeEmail(null))
  }, [])

  useEffect(() => {
    let active = true
    api
      .team
      .list()
      .then((r) => {
        if (active) {
          setUsers(r.users ?? [])
          setError(null)
        }
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load team')
      })
    return () => {
      active = false
    }
  }, [tick])

  const refresh = () => setTick((t) => t + 1)

  async function createUser() {
    if (busy) return
    setBusy(true)
    try {
      const r = await api.team.create({ email: newEmail.trim(), name: newName.trim(), role: newRole, title: newTitle.trim() })
      if (!r.ok) throw new Error(r.error ?? 'Create failed')
      setCreatedPassword(r.tempPassword ?? '')
      toast.success(`User ${newEmail.trim()} created`)
      setNewEmail('')
      setNewName('')
      setNewTitle('')
      setNewRole('STAFF')
      refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create user')
    } finally {
      setBusy(false)
    }
  }

  async function resetPasswordFor(u: TeamMember) {
    if (busy) return
    setBusy(true)
    try {
      const r = await api.team.update(u.id, { action: 'reset_password' })
      if (!r.ok) throw new Error(r.error ?? 'Reset failed')
      setResetTarget(u)
      setResetPassword(r.tempPassword ?? '')
      refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to reset password')
    } finally {
      setBusy(false)
    }
  }

  async function changeRole(u: TeamMember, role: string) {
    if (busy) return
    setBusy(true)
    try {
      const r = await api.team.update(u.id, { role })
      if (!r.ok) throw new Error(r.error ?? 'Role change failed')
      toast.success(`${u.email} is now ${role}`)
      setRoleTarget(null)
      refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to change role')
    } finally {
      setBusy(false)
    }
  }

  async function toggleActive(u: TeamMember) {
    if (busy) return
    setBusy(true)
    try {
      const r = await api.team.update(u.id, { isActive: !u.isActive })
      if (!r.ok) throw new Error(r.error ?? 'Update failed')
      toast.success(u.isActive ? `${u.email} disabled — sessions revoked` : `${u.email} re-enabled`)
      refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update account')
    } finally {
      setBusy(false)
    }
  }

  const stats = useMemo(() => {
    const list = users ?? []
    return {
      total: list.length,
      active: list.filter((u) => u.isActive).length,
      admins: list.filter((u) => u.role === 'SUPER_ADMIN' || u.role === 'ADMIN').length,
      with2fa: list.filter((u) => u.twoFactorEnabled).length,
    }
  }, [users])

  return (
    <div className="space-y-4">
      <PageHeader
        title="Team"
        description="Console accounts, roles, and access. Create staff, reset passwords, and enforce two-factor — every action is audited."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={refresh} disabled={busy} className="gap-1.5 border-slate-800 bg-slate-900 text-slate-300 hover:text-slate-100">
              <RefreshCw className="size-3.5" aria-hidden="true" /> Refresh
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5" style={{ background: '#009FE3' }}>
              <Plus className="size-3.5" aria-hidden="true" /> Add user
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="TEAM MEMBERS" value={stats.total} icon={Users} sub="Console accounts" />
        <KpiCard label="ACTIVE" value={stats.active} icon={BadgeCheck} tone="green" sub="Can sign in" />
        <KpiCard label="ADMINS" value={stats.admins} icon={UserCog} tone="amber" sub="ADMIN or SUPER_ADMIN" />
        <KpiCard label="2FA ENROLLED" value={stats.with2fa} icon={ShieldCheck} tone="accent" sub="TOTP enabled" />
      </div>

      <SectionCard
        title="Console accounts"
        description="Real User records — scrypt password hashes, DB-backed sessions, per-role route permissions."
        contentClassName="p-0"
      >
        {error ? (
          <EmptyState icon={ShieldAlert} title="Failed to load team" description={error} />
        ) : users === null ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading team…
          </div>
        ) : users.length === 0 ? (
          <EmptyState icon={Users} title="No console users yet" description="Add your first team member to get started." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                  <th scope="col" className="px-4 py-2.5 font-semibold">User</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Role</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Security</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Last sign-in</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-[11px] font-bold text-[#009FE3]" aria-hidden="true">
                          {(u.name ?? u.email).charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-200">{u.name ?? u.email.split('@')[0]}</p>
                          <p className="truncate text-[11px] text-slate-500">{u.email}</p>
                          {u.title ? <p className="truncate text-[10px] text-slate-600">{u.title}</p> : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={u.isActive ? 'ACTIVE' : 'DISABLED'} />
                      {u.lockedUntil && new Date(u.lockedUntil) > new Date() ? (
                        <p className="mt-1 text-[10px] text-amber-500">Locked until {fmtDate(u.lockedUntil)}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex w-fit items-center gap-1 text-[11px] font-medium ${u.twoFactorEnabled ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {u.twoFactorEnabled ? <ShieldCheck className="size-3.5" aria-hidden="true" /> : <Lock className="size-3.5" aria-hidden="true" />}
                          {u.twoFactorEnabled ? 'TOTP enabled' : 'No 2FA'}
                        </span>
                        {u.mustChangePassword ? (
                          <span className="text-[10px] text-amber-500">Password change pending</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-slate-400">
                      {u.lastLoginAt ? fmtDate(u.lastLoginAt) : <span className="text-slate-600">Never</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 border-slate-700 bg-slate-900 px-2 text-[11px] text-slate-300 hover:text-slate-100"
                          onClick={() => {
                            setRoleTarget(u)
                            setRoleValue(u.role)
                          }}
                          disabled={busy}
                        >
                          <UserCog className="size-3.5" aria-hidden="true" /> Role
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 border-slate-700 bg-slate-900 px-2 text-[11px] text-slate-300 hover:text-slate-100"
                          onClick={() => void resetPasswordFor(u)}
                          disabled={busy}
                        >
                          <KeyRound className="size-3.5" aria-hidden="true" /> Reset password
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className={`h-7 border-slate-700 bg-slate-900 px-2 text-[11px] ${u.isActive ? 'text-red-400 hover:text-red-300' : 'text-emerald-400 hover:text-emerald-300'}`}
                          onClick={() => void toggleActive(u)}
                          disabled={busy || u.email === meEmail}
                          title={u.email === meEmail ? 'You cannot disable your own account' : undefined}
                        >
                          {u.isActive ? 'Disable' : 'Enable'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* ---- create user dialog ---- */}
      <Dialog open={createOpen} onOpenChange={(o) => {
        setCreateOpen(o)
        if (!o) setCreatedPassword(null)
      }}>
        <DialogContent className="border-slate-800 bg-slate-900 text-slate-200 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserRound className="size-4 text-[#009FE3]" aria-hidden="true" />
              {createdPassword ? 'User created' : 'Add console user'}
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              {createdPassword
                ? 'Share the one-time password securely — the user must choose their own at first sign-in.'
                : 'Creates a real User record with a one-time password and forced password rotation.'}
            </DialogDescription>
          </DialogHeader>

          {createdPassword ? (
            <OneTimeSecret password={createdPassword} onDone={() => { setCreateOpen(false); setCreatedPassword(null) }} />
          ) : (
            <div className="space-y-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="team-email" className="text-xs text-slate-400">Email *</Label>
                <Input
                  id="team-email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="name@bdtech360.com"
                  className="h-9 border-slate-800 bg-slate-950/60 text-slate-200"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="team-name" className="text-xs text-slate-400">Full name</Label>
                  <Input
                    id="team-name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Full name"
                    className="h-9 border-slate-800 bg-slate-950/60 text-slate-200"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="team-title" className="text-xs text-slate-400">Job title</Label>
                  <Input
                    id="team-title"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. CRM Manager"
                    className="h-9 border-slate-800 bg-slate-950/60 text-slate-200"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Role *</Label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger className="h-9 border-slate-800 bg-slate-950/60 text-slate-200" aria-label="Role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
                    {ROLE_ORDER.map((r) => (
                      <SelectItem key={r} value={r} className="focus:bg-slate-800">
                        {r === 'SUPER_ADMIN' ? 'Super Admin — full control incl. settings & team' :
                         r === 'ADMIN' ? 'Admin — full operations incl. AI runs' :
                         r === 'MANAGER' ? 'Manager — CRM, finance, reports, content' :
                         'Staff — leads, clients, chat, meetings'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] leading-relaxed text-slate-600">
                  Route permissions are enforced server-side for every role; the sidebar adapts automatically.
                </p>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setCreateOpen(false)} className="border-slate-800 bg-slate-900 text-slate-300">
                  Cancel
                </Button>
                <Button onClick={() => void createUser()} disabled={busy || !newEmail.trim()} style={{ background: '#009FE3' }}>
                  {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
                  Create user
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ---- reset password result ---- */}
      <Dialog open={resetTarget !== null} onOpenChange={(o) => { if (!o) { setResetTarget(null); setResetPassword(null) } }}>
        <DialogContent className="border-slate-800 bg-slate-900 text-slate-200 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="size-4 text-[#009FE3]" aria-hidden="true" />
              Password reset — {resetTarget?.email}
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              All active sessions were revoked. The account must set a new password at next sign-in.
            </DialogDescription>
          </DialogHeader>
          {resetPassword ? (
            <OneTimeSecret
              password={resetPassword}
              title="New one-time password"
              onDone={() => { setResetTarget(null); setResetPassword(null) }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ---- role change dialog ---- */}
      <Dialog open={roleTarget !== null} onOpenChange={(o) => { if (!o) setRoleTarget(null) }}>
        <DialogContent className="border-slate-800 bg-slate-900 text-slate-200 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="size-4 text-[#009FE3]" aria-hidden="true" />
              Change role — {roleTarget?.email}
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              Applies immediately to every API route this user touches.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={roleValue} onValueChange={setRoleValue}>
              <SelectTrigger className="h-9 border-slate-800 bg-slate-950/60 text-slate-200" aria-label="New role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
                {ROLE_ORDER.map((r) => (
                  <SelectItem key={r} value={r} className="focus:bg-slate-800">{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {roleTarget && roleTarget.role === 'SUPER_ADMIN' && roleValue !== 'SUPER_ADMIN' ? (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-300">
                Safety rail: the last active Super Admin cannot be demoted, and you cannot demote yourself.
              </p>
            ) : null}
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setRoleTarget(null)} className="border-slate-800 bg-slate-900 text-slate-300">
                Cancel
              </Button>
              <Button onClick={() => roleTarget && void changeRole(roleTarget, roleValue)} disabled={busy || !roleTarget || roleValue === roleTarget.role} style={{ background: '#009FE3' }}>
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                Apply role
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
