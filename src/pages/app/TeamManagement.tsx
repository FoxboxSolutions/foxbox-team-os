import { useState, useMemo } from 'react'
import { Search, MoreHorizontal, Shield, ShieldOff, Ban, Unlock, Trash2, UserCheck, ChevronDown } from 'lucide-react'
import { useAppState } from '@/stores/AppState'
import { UserAvatar } from '@/components/auth/UserAvatar'
import { getRoleDisplayName, getStatusDisplayName, getStatusColor } from '@/lib/auth'
import type { AuthUser, AuthRole, AccountStatus } from '@/types'

export function TeamManagement() {
  const { authUser, authUsers, updateUserRole, blockUser, unblockUser, banUser, unbanUser, deleteUser } = useAppState()
  const [search, setSearch] = useState('')
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [editingRole, setEditingRole] = useState<string | null>(null)

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return authUsers
    const q = search.toLowerCase()
    return authUsers.filter(u =>
      u.fullName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    )
  }, [authUsers, search])

  const handleRoleChange = (userId: string, newRole: AuthRole) => {
    if (!authUser) return
    updateUserRole(userId, newRole, authUser.fullName)
    setEditingRole(null)
    setOpenMenu(null)
  }

  const handleBlock = (userId: string) => {
    blockUser(userId)
    setOpenMenu(null)
  }

  const handleUnblock = (userId: string) => {
    unblockUser(userId)
    setOpenMenu(null)
  }

  const handleBan = (userId: string) => {
    banUser(userId)
    setOpenMenu(null)
  }

  const handleUnban = (userId: string) => {
    unbanUser(userId)
    setOpenMenu(null)
  }

  const handleDelete = (userId: string) => {
    const success = deleteUser(userId)
    if (!success) {
      alert('Cannot delete the last active administrator.')
    }
    setConfirmDelete(null)
    setOpenMenu(null)
  }

  const isLastAdmin = (user: AuthUser) => {
    if (user.role !== 'administrator') return false
    const activeAdmins = authUsers.filter(u => u.role === 'administrator' && u.status === 'approved' && u.id !== user.id)
    return activeAdmins.length === 0
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-serif font-bold text-text-primary">Team Members</h1>
          <p className="text-sm text-text-muted mt-1">{authUsers.length} users registered</p>
        </div>
      </div>

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
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-6 py-4 text-xs font-semibold text-text-muted uppercase tracking-wider">User</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Role</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Created</th>
                <th className="text-right px-6 py-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} className="border-b border-border hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={user.fullName} avatar={user.avatar} size="sm" />
                      <div>
                        <p className="text-sm font-medium text-text-primary">{user.fullName}</p>
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
                          <option value="administrator">Administrator</option>
                          <option value="mediabuyer">Mediabuyer</option>
                          <option value="confirmator">Confirmator</option>
                        </select>
                        <button onClick={() => setEditingRole(null)} className="text-xs text-text-muted hover:text-text-secondary">Cancel</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingRole(user.id)}
                        className="text-sm text-gold hover:text-gold-light transition-colors flex items-center gap-1"
                      >
                        {getRoleDisplayName(user.role as AuthRole)}
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-medium ${getStatusColor(user.status as AccountStatus)}`}>
                      {getStatusDisplayName(user.status as AccountStatus)}
                    </span>
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
                          {/* Inline quick actions for active users */}
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
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-text-muted">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
