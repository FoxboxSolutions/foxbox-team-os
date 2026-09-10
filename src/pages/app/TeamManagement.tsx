import { useState, useMemo, useEffect, useCallback } from 'react'
import { Search, MoreHorizontal, Shield, ShieldOff, Ban, Unlock, Trash2, UserCheck, ChevronDown, Plus, X, Copy, Check, Send, RotateCcw, Mail, Loader2 } from 'lucide-react'
import { useAppState } from '@/stores/AppState'
import { UserAvatar } from '@/components/auth/UserAvatar'
import { getRoleDisplayName, getStatusDisplayName, getStatusColor } from '@/lib/auth'
import { api } from '@/lib/api'
import type { AuthUser, AuthRole, AccountStatus, TeamInvitation, TeamMemberWithStats } from '@/types'

type InviteRole = 'agent' | 'admin'

const INVITE_ROLE_META: Record<InviteRole, { label: string; tagline: string; detail: string }> = {
  agent: {
    label: 'Agent',
    tagline: 'Team member',
    detail: 'Commission-based confirmation role — 150 DA per confirmed order.',
  },
  admin: {
    label: 'Admin',
    tagline: 'Full administrative role',
    detail: 'Full access to everything, including member management.',
  },
}

function displayRole(role: string): string {
  if (role === 'confirmator') return 'Agent'
  if (role === 'administrator') return 'Admin'
  return getRoleDisplayName(role as AuthRole)
}

function formatDA(n: number): string {
  return `${(Number(n) || 0).toLocaleString('en-US')} DA`
}

export function TeamManagement() {
  const { authUser, updateUserRole, blockUser, unblockUser, banUser, unbanUser, deleteUser } = useAppState()
  const isAdmin = authUser?.role === 'administrator'

  const [search, setSearch] = useState('')
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [editingRole, setEditingRole] = useState<string | null>(null)

  const [members, setMembers] = useState<TeamMemberWithStats[]>([])
  const [membersLoading, setMembersLoading] = useState(true)
  const [actionError, setActionError] = useState<string | null>(null)

  const [invitations, setInvitations] = useState<TeamInvitation[]>([])
  const [invitesLoading, setInvitesLoading] = useState(false)

  const [showAddModal, setShowAddModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<InviteRole>('agent')
  const [inviteSending, setInviteSending] = useState(false)
  const [inviteFormError, setInviteFormError] = useState<string | null>(null)
  const [inviteResult, setInviteResult] = useState<{ inviteUrl?: string; emailSent: boolean; emailError?: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const loadMembers = useCallback(async () => {
    const rows = await api.getTeamMembers()
    setMembers((rows as unknown as TeamMemberWithStats[]).map(r => ({
      ...(r as unknown as AuthUser),
      confirmedCount: Number((r as unknown as Record<string, unknown>).confirmedCount ?? 0),
      totalEarned: Number((r as unknown as Record<string, unknown>).totalEarned ?? 0),
    })))
  }, [])

  const loadInvitations = useCallback(async () => {
    const rows = await api.getInvitations()
    setInvitations(rows as unknown as TeamInvitation[])
  }, [])

  useEffect(() => {
    if (!isAdmin) { setMembersLoading(false); return }
    let cancelled = false
    setMembersLoading(true)
    setActionError(null)
    Promise.all([
      loadMembers(),
      (async () => { setInvitesLoading(true); try { await loadInvitations() } finally { if (!cancelled) setInvitesLoading(false) } })(),
    ])
      .catch((err) => { if (!cancelled) setActionError(err instanceof Error ? err.message : 'Failed to load team.') })
      .finally(() => { if (!cancelled) setMembersLoading(false) })
    return () => { cancelled = true }
  }, [isAdmin, loadMembers, loadInvitations])

  const reloadAll = useCallback(async () => {
    await Promise.all([loadMembers(), loadInvitations()])
  }, [loadMembers, loadInvitations])

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return members
    const q = search.toLowerCase()
    return members.filter(u =>
      (u.fullName || '').toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    )
  }, [members, search])

  const pendingInvites = useMemo(
    () => invitations.filter(i => i.status === 'pending' || i.status === 'expired'),
    [invitations]
  )

  const runAction = useCallback(async (fn: () => Promise<unknown> | void) => {
    setActionError(null)
    try {
      await fn()
      await reloadAll()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed.')
    }
  }, [reloadAll])

  const handleRoleChange = (userId: string, newRole: AuthRole) => {
    if (!authUser) return
    setEditingRole(null)
    setOpenMenu(null)
    void runAction(() => updateUserRole(userId, newRole, authUser.fullName))
  }

  const handleBlock = (userId: string) => {
    setOpenMenu(null)
    void runAction(() => blockUser(userId))
  }

  const handleUnblock = (userId: string) => {
    setOpenMenu(null)
    void runAction(() => unblockUser(userId))
  }

  const handleBan = (userId: string) => {
    setOpenMenu(null)
    void runAction(() => banUser(userId))
  }

  const handleUnban = (userId: string) => {
    setOpenMenu(null)
    void runAction(() => unbanUser(userId))
  }

  const handleDelete = async (userId: string) => {
    setActionError(null)
    const success = await deleteUser(userId)
    if (!success) {
      setActionError('Cannot delete this user (the last active administrator is protected).')
    } else {
      await reloadAll().catch(() => {})
    }
    setConfirmDelete(null)
    setOpenMenu(null)
  }

  const isLastAdmin = (user: TeamMemberWithStats) => {
    if (user.role !== 'administrator') return false
    const activeAdmins = members.filter(u => u.role === 'administrator' && u.status === 'approved' && u.id !== user.id)
    return activeAdmins.length === 0
  }

  const openAddModal = () => {
    setInviteEmail('')
    setInviteRole('agent')
    setInviteFormError(null)
    setInviteResult(null)
    setCopied(false)
    setShowAddModal(true)
  }

  const handleInviteSubmit = async () => {
    const email = inviteEmail.trim().toLowerCase()
    if (!email) { setInviteFormError('Email is required.'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { setInviteFormError('Please enter a valid email address.'); return }
    setInviteSending(true)
    setInviteFormError(null)
    setInviteResult(null)
    try {
      const res = await api.createInvitation({ email, role: inviteRole })
      setInviteResult({
        inviteUrl: res.invitation.inviteUrl as string | undefined,
        emailSent: res.emailSent,
        emailError: res.emailError,
      })
      await loadInvitations().catch(() => {})
    } catch (err) {
      setInviteFormError(err instanceof Error ? err.message : 'Could not send the invitation.')
    } finally {
      setInviteSending(false)
    }
  }

  const handleResend = async (id: string) => {
    setActionError(null)
    try {
      await api.resendInvitation(id)
      await loadInvitations()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not resend the invitation.')
    }
  }

  const handleRevoke = async (id: string) => {
    setActionError(null)
    try {
      await api.revokeInvitation(id)
      await loadInvitations()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not revoke the invitation.')
    }
  }

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setActionError('Could not copy to clipboard.')
    }
  }

  if (!isAdmin) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-serif font-bold text-text-primary">Team Members</h1>
        <p className="text-sm text-text-muted mt-2">Only administrators can manage team members.</p>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-serif font-bold text-text-primary">Team Members</h1>
          <p className="text-sm text-text-muted mt-1">{members.length} users registered</p>
        </div>
        <button onClick={openAddModal} className="btn-primary">
          <Plus className="w-4 h-4" />
          Add Member
        </button>
      </div>

      {actionError && (
        <div className="mb-6 p-3 rounded-xl bg-danger/10 border border-danger/20">
          <p className="text-sm text-danger">{actionError}</p>
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search by name, email, or role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field w-full pl-10"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="glass-card rounded-xl overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-6 py-4 text-xs font-semibold text-text-muted uppercase tracking-wider">User</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Role</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Commission</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Joined</th>
                <th className="text-right px-6 py-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {membersLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Loader2 className="w-5 h-5 animate-spin text-gold mx-auto mb-2" />
                    <p className="text-sm text-text-muted">Loading members...</p>
                  </td>
                </tr>
              ) : filteredUsers.map((user) => (
                <tr key={user.id} className="border-b border-border hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={user.fullName || user.email} avatar={user.avatar} size="sm" />
                      <div>
                        <p className="text-sm font-medium text-text-primary">{user.fullName || '—'}</p>
                        <p className="text-xs text-text-muted">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {editingRole === user.id ? (
                      <div className="flex items-center gap-2">
                        <select
                          defaultValue={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value as AuthRole)}
                          className="input-field text-xs py-1 px-2"
                          autoFocus
                        >
                          <option value="administrator">Admin</option>
                          <option value="confirmator">Agent</option>
                          <option value="mediabuyer">Mediabuyer</option>
                        </select>
                        <button onClick={() => setEditingRole(null)} className="text-xs text-text-muted hover:text-text-secondary">Cancel</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingRole(user.id)}
                        className="text-sm text-gold hover:text-gold-light transition-colors flex items-center gap-1"
                      >
                        {displayRole(user.role)}
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-medium ${getStatusColor(user.status as AccountStatus)}`}>
                      {user.status === 'pending' ? 'Pending invitation' : getStatusDisplayName(user.status as AccountStatus)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-text-primary">{formatDA(user.totalEarned)}</p>
                    <p className="text-[11px] text-text-muted">{user.confirmedCount} confirmed</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs text-text-muted">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2 relative">
                      {user.id !== authUser?.id && (
                        <>
                          {(user.status === 'approved' || user.status === 'pending') && !isLastAdmin(user) && (
                            <>
                              <button
                                onClick={() => handleBlock(user.id)}
                                className="p-1.5 rounded-lg hover:bg-warning/10 text-warning transition-colors"
                                title="Block user"
                              >
                                <ShieldOff className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleBan(user.id)}
                                className="p-1.5 rounded-lg hover:bg-danger/10 text-danger transition-colors"
                                title="Ban user"
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {user.status === 'blocked' && (
                            <button
                              onClick={() => handleUnblock(user.id)}
                              className="p-1.5 rounded-lg hover:bg-success/10 text-success transition-colors"
                              title="Unblock user"
                            >
                              <Unlock className="w-4 h-4" />
                            </button>
                          )}
                          {user.status === 'banned' && (
                            <button
                              onClick={() => handleUnban(user.id)}
                              className="p-1.5 rounded-lg hover:bg-success/10 text-success transition-colors"
                              title="Unban user"
                            >
                              <UserCheck className="w-4 h-4" />
                            </button>
                          )}
                          {!isLastAdmin(user) && (
                            <div className="relative">
                              <button
                                onClick={() => setOpenMenu(openMenu === user.id ? null : user.id)}
                                className="p-1.5 rounded-lg hover:bg-white/[0.05] text-text-muted transition-colors"
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </button>
                              {openMenu === user.id && (
                                <div className="absolute right-0 top-8 w-48 bg-charcoal border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
                                  <button
                                    onClick={() => { setEditingRole(user.id); setOpenMenu(null) }}
                                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-text-primary hover:bg-white/[0.03] transition-colors"
                                  >
                                    <Shield className="w-4 h-4 text-text-muted" />
                                    Change Role
                                  </button>
                                  {confirmDelete === user.id ? (
                                    <div className="px-4 py-3 border-t border-border">
                                      <p className="text-xs text-danger mb-2">Delete this user permanently?</p>
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => handleDelete(user.id)}
                                          className="text-xs px-3 py-1 rounded bg-danger text-white hover:bg-danger/80"
                                        >
                                          Delete
                                        </button>
                                        <button
                                          onClick={() => setConfirmDelete(null)}
                                          className="text-xs px-3 py-1 rounded bg-white/5 text-text-muted hover:bg-white/10"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setConfirmDelete(user.id)}
                                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-danger hover:bg-danger/5 transition-colors border-t border-border"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                      Delete User
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                      {user.id === authUser?.id && (
                        <span className="text-xs text-text-muted italic">You</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!membersLoading && filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-text-muted">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending invitations */}
      <div className="glass-card rounded-xl overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <Mail className="w-4 h-4 text-gold" />
          <h2 className="text-sm font-semibold text-text-primary">Pending invitations ({pendingInvites.length})</h2>
        </div>
        {invitesLoading ? (
          <p className="px-6 py-8 text-center text-sm text-text-muted">Loading invitations...</p>
        ) : pendingInvites.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-text-muted">No pending invitations. Click “Add Member” to invite someone.</p>
        ) : (
          <div className="divide-y divide-border">
            {pendingInvites.map((inv) => (
              <div key={inv.id} className="px-6 py-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{inv.email}</p>
                  <p className="text-[11px] text-text-muted">
                    {inv.role === 'administrator' ? 'Admin' : 'Agent'} · {inv.status === 'expired' ? 'expired' : 'expires'} {new Date(inv.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {inv.status === 'pending' && (
                    <button
                      onClick={() => handleResend(inv.id)}
                      className="p-1.5 rounded-lg hover:bg-gold/10 text-gold transition-colors"
                      title="Resend invitation"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleRevoke(inv.id)}
                    className="px-3 py-1.5 rounded-lg text-xs text-danger hover:bg-danger/10 transition-colors"
                    title="Revoke invitation"
                  >
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAddModal(false)}>
          <div
            className="w-full max-w-md mx-4 rounded-2xl bg-surface border border-border shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-lg font-bold text-text-primary">Add Member</h2>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 rounded-lg hover:bg-white/[0.05] text-text-muted hover:text-text-secondary transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-2">Email</label>
                <input
                  type="email"
                  placeholder="example@gmail.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="input-field w-full"
                  autoComplete="off"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-2">Role</label>
                <div className="grid grid-cols-2 gap-3">
                  {(Object.keys(INVITE_ROLE_META) as InviteRole[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => setInviteRole(r)}
                      className={`text-left p-4 rounded-xl border transition-all ${inviteRole === r ? 'border-gold/50 bg-gold/[0.07]' : 'border-border bg-white/[0.02] hover:border-border-light'}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${inviteRole === r ? 'border-gold' : 'border-text-muted'}`}>
                          {inviteRole === r && <span className="w-2 h-2 rounded-full bg-gold" />}
                        </span>
                        <span className="text-sm font-semibold text-text-primary">{INVITE_ROLE_META[r].label}</span>
                      </div>
                      <p className="text-[11px] text-text-muted">{INVITE_ROLE_META[r].tagline}</p>
                      <p className="text-[11px] text-text-muted mt-1">{INVITE_ROLE_META[r].detail}</p>
                    </button>
                  ))}
                </div>
              </div>

              {inviteFormError && (
                <div className="p-3 rounded-xl bg-danger/10 border border-danger/20">
                  <p className="text-sm text-danger">{inviteFormError}</p>
                </div>
              )}

              {inviteResult && (
                <div className="p-4 rounded-xl bg-success/10 border border-success/20 space-y-2">
                  <p className="text-sm font-medium text-success flex items-center gap-2">
                    <Check className="w-4 h-4" /> Invitation sent successfully.
                  </p>
                  {!inviteResult.emailSent && (
                    <p className="text-xs text-warning">
                      Email could not be delivered automatically ({inviteResult.emailError || 'no provider'}). Share the link below manually.
                    </p>
                  )}
                  {inviteResult.inviteUrl && (
                    <div className="flex items-center gap-2">
                      <input readOnly value={inviteResult.inviteUrl} className="input-field w-full text-xs" onFocus={(e) => e.target.select()} />
                      <button
                        onClick={() => inviteResult.inviteUrl && copyText(inviteResult.inviteUrl)}
                        className="btn-secondary p-2 flex-shrink-0"
                        title="Copy invitation link"
                      >
                        {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 p-5 border-t border-border">
              <button onClick={() => setShowAddModal(false)} className="btn-secondary">
                {inviteResult ? 'Close' : 'Cancel'}
              </button>
              {!inviteResult && (
                <button
                  onClick={handleInviteSubmit}
                  disabled={inviteSending}
                  className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {inviteSending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending invitation...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send Invitation
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
