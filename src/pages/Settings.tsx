import { useState, useEffect } from 'react'
import {
  Settings as Save,
  Globe,
  Truck,
  Users,
  Check,
  Download,
  Trash2,
  Shield,
  BarChart3,
  Package,
  ListTodo,
  ShoppingCart,
  Receipt,
  TrendingUp,
  Link as LinkIcon,
  Info,
  ArrowLeftRight,
  UserCheck,
  UserX,
  Clock,
  CheckCircle,
  XCircle,
  Store,
  RefreshCw,
  ExternalLink,
} from 'lucide-react'
import { useAppState } from '@/stores/AppState'
import { db } from '@/lib/db'
import { cn } from '@/lib/utils'
import { getRoleDisplayName, getStatusDisplayName } from '@/lib/auth'
import type { AuthRole } from '@/types'

export function Settings() {
  const {
    users, currentUser, setCurrentUser,
    deliveryProviders, products, tasks, orders, expenses, revenues,
    authUser, authUsers, registrationRequests,
    approveUser, rejectUser, suspendUser, reactivateUser, updateUserRole,
    youcanConnection, connectYoucan, disconnectYoucan, testYoucanConnection, fetchYoucanStatus,
  } = useAppState()

  const [saved, setSaved] = useState(false)
  const [exported, setExported] = useState(false)
  const [rates, setRates] = useState({ rmbToUsd: 0.15, usdToDzd: 260 })
  const [youcanLoading, setYoucanLoading] = useState(false)
  const [youcanTestResult, setYoucanTestResult] = useState<{ success: boolean; error?: string } | null>(null)

  useEffect(() => {
    const settings = db.getSettings()
    setRates({
      rmbToUsd: (settings.rmbToUsd as number) || 0.15,
      usdToDzd: (settings.usdToDzd as number) || 260,
    })
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const youcan = params.get('youcan')
    if (youcan === 'connected' || youcan === 'error') {
      fetchYoucanStatus()
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [fetchYoucanStatus])

  const handleSaveRates = () => {
    db.saveSetting('rmbToUsd', rates.rmbToUsd)
    db.saveSetting('usdToDzd', rates.usdToDzd)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleUserSwitch = (userId: string) => {
    const user = users.find(u => u.id === userId)
    if (user) setCurrentUser(user)
  }

  const handleExport = () => {
    const data: Record<string, unknown> = {}
    const keys = [
      'users', 'products', 'tasks', 'posts', 'channels', 'messages',
      'files', 'creatives', 'orders', 'deliveryProviders', 'shipments',
      'wilayas', 'expenses', 'revenues', 'notifications', 'activityLog', 'settings',
    ]
    keys.forEach(k => {
      const raw = localStorage.getItem('foxbox_' + k)
      if (raw) data[k] = JSON.parse(raw)
    })
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `foxbox-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    setExported(true)
    setTimeout(() => setExported(false), 2000)
  }

  const handleReset = () => {
    if (window.confirm('This will delete ALL data and reload the app. Are you sure?')) {
      const keys = [
        'users', 'products', 'tasks', 'posts', 'channels', 'messages',
        'files', 'creatives', 'orders', 'deliveryProviders', 'shipments',
        'wilayas', 'expenses', 'revenues', 'notifications', 'activityLog',
        'currentUser', 'settings',
      ]
      keys.forEach(k => localStorage.removeItem('foxbox_' + k))
      window.location.reload()
    }
  }

  const handleYoucanConnect = async () => {
    setYoucanLoading(true)
    const result = await connectYoucan()
    if (result.url) {
      window.location.href = result.url
    }
    setYoucanLoading(false)
  }

  const handleYoucanTest = async () => {
    setYoucanTestResult(null)
    setYoucanLoading(true)
    const result = await testYoucanConnection()
    setYoucanTestResult(result)
    setYoucanLoading(false)
    setTimeout(() => setYoucanTestResult(null), 5000)
  }

  const handleYoucanDisconnect = () => {
    if (window.confirm('Disconnect your YouCan store? You will need to re-authorize to sync orders.')) {
      disconnectYoucan()
    }
  }

  const totalRevenue = revenues.reduce((sum, r) => sum + r.amountDzd, 0)
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amountDzd, 0)

  const stats = [
    { label: 'Products', value: products.length, icon: Package },
    { label: 'Tasks', value: tasks.length, icon: ListTodo },
    { label: 'Orders', value: orders.length, icon: ShoppingCart },
    { label: 'Expenses', value: expenses.length, icon: Receipt },
    { label: 'Revenue', value: `$${totalRevenue.toLocaleString()}`, icon: TrendingUp },
    { label: 'Profit', value: `$${(totalRevenue - totalExpenses).toLocaleString()}`, icon: BarChart3 },
  ]

  const roleLabels: Record<string, string> = {
    ADMIN: 'Admin',
    MANAGER: 'Manager',
    PRODUCT_RESEARCH: 'Product Research',
    MARKETING: 'Marketing',
    OPERATIONS: 'Operations',
    FINANCE: 'Finance',
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-text-muted mt-1">Configure your FOXBOX TEAM OS.</p>
      </div>

      {/* Current User Profile */}
      {currentUser && (
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-gold" />
            <h3 className="text-sm font-semibold">Current User</h3>
          </div>
          <div className="flex items-center gap-4">
            <div className="avatar">
              <span>{currentUser.name.split(' ').map(n => n[0]).join('')}</span>
            </div>
            <div className="flex-1">
              <p className="font-medium">{currentUser.name}</p>
              <p className="text-xs text-text-muted">{currentUser.email}</p>
              <span className="badge badge-success text-[9px] mt-1">{roleLabels[currentUser.role]}</span>
            </div>
          </div>
        </div>
      )}

      {/* User Switching */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <ArrowLeftRight className="w-5 h-5 text-gold" />
          <h3 className="text-sm font-semibold">Switch User</h3>
        </div>
        <div className="space-y-2">
          {users.filter(u => u.isActive).map(user => (
            <button
              key={user.id}
              onClick={() => handleUserSwitch(user.id)}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left',
                currentUser?.id === user.id
                  ? 'bg-gold/10 border-gold/30'
                  : 'bg-white/[0.02] border-border hover:bg-white/[0.04]'
              )}
            >
              <div className="avatar">
                <span>{user.name.split(' ').map(n => n[0]).join('')}</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-[11px] text-text-muted">{roleLabels[user.role]}</p>
              </div>
              {currentUser?.id === user.id && (
                <span className="text-[10px] text-gold font-medium uppercase tracking-wider">Active</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* System Stats */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-gold" />
          <h3 className="text-sm font-semibold">System Stats</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {stats.map(stat => (
            <div key={stat.label} className="p-3 rounded-xl bg-white/[0.02] border border-border">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className="w-3.5 h-3.5 text-text-muted" />
                <span className="text-[11px] text-text-muted uppercase tracking-wider">{stat.label}</span>
              </div>
              <p className="text-lg font-bold text-text-primary">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Currency Rates */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-5 h-5 text-gold" />
          <h3 className="text-sm font-semibold">Currency Rates</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-text-muted uppercase tracking-wider block mb-2">RMB to USD</label>
            <input
              type="number"
              step="0.01"
              value={rates.rmbToUsd}
              onChange={(e) => setRates({ ...rates, rmbToUsd: parseFloat(e.target.value) || 0 })}
              className="input-field"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted uppercase tracking-wider block mb-2">USD to DZD</label>
            <input
              type="number"
              step="1"
              value={rates.usdToDzd}
              onChange={(e) => setRates({ ...rates, usdToDzd: parseFloat(e.target.value) || 0 })}
              className="input-field"
            />
          </div>
        </div>
        <div className="mt-4 p-3 rounded-lg bg-white/[0.02] border border-border">
          <p className="text-xs text-text-muted">
            1 RMB = {(rates.rmbToUsd * rates.usdToDzd).toFixed(2)} DZD
          </p>
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={handleSaveRates} className="btn-primary">
            {saved ? (
              <><Check className="w-4 h-4" /> Saved!</>
            ) : (
              <><Save className="w-4 h-4" /> Save Rates</>
            )}
          </button>
        </div>
      </div>

      {/* Delivery Providers */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-gold" />
            <h3 className="text-sm font-semibold">Delivery Providers</h3>
          </div>
          <a href="/delivery" className="flex items-center gap-1 text-xs text-gold hover:text-gold/80 transition-colors">
            <LinkIcon className="w-3 h-3" />
            Manage
          </a>
        </div>
        <div className="space-y-3">
          {deliveryProviders.map((provider) => (
            <div key={provider.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center">
                  <Truck className="w-5 h-5 text-gold" />
                </div>
                <div>
                  <p className="text-sm font-medium">{provider.name}</p>
                  <p className="text-[11px] text-text-muted">{provider.code} - {provider.services.join(', ').replace(/_/g, ' ')}</p>
                </div>
              </div>
              <span className={cn('badge text-[9px]', provider.isActive ? 'badge-success' : 'badge-danger')}>
                {provider.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          ))}
          {deliveryProviders.length === 0 && (
            <p className="text-sm text-text-muted text-center py-4">No delivery providers configured.</p>
          )}
        </div>
      </div>

      {/* Team Members */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-gold" />
          <h3 className="text-sm font-semibold">Team Members</h3>
        </div>
        <div className="space-y-3">
          {users.map((member) => (
            <div key={member.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-border">
              <div className="flex items-center gap-3">
                <div className="avatar">
                  <span>{member.name.split(' ').map(n => n[0]).join('')}</span>
                </div>
                <div>
                  <p className="text-sm font-medium">{member.name}</p>
                  <p className="text-[11px] text-text-muted">{member.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge badge-success text-[9px]">{roleLabels[member.role]}</span>
                {currentUser?.id === member.id && (
                  <span className="badge text-[9px] bg-gold/10 text-gold border-gold/20">Current</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Admin User Management */}
      {authUser?.role === 'administrator' && (
        <>
          {/* Pending Requests */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-gold" />
              <h3 className="text-sm font-semibold">Pending Registration Requests</h3>
              {registrationRequests.filter(r => r.status === 'pending').length > 0 && (
                <span className="badge badge-warning text-[9px]">{registrationRequests.filter(r => r.status === 'pending').length}</span>
              )}
            </div>
            <div className="space-y-3">
              {registrationRequests.filter(r => r.status === 'pending').length === 0 ? (
                <p className="text-sm text-text-muted text-center py-4">No pending requests.</p>
              ) : (
                registrationRequests.filter(r => r.status === 'pending').map(request => (
                  <div key={request.id} className="p-4 rounded-xl bg-white/[0.02] border border-border">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium">{request.fullName}</p>
                        <p className="text-[11px] text-text-muted">{request.email}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="badge badge-info text-[9px]">Requested: {getRoleDisplayName(request.requestedRole)}</span>
                          <span className="badge text-[9px] bg-white/5 text-text-muted border-border">
                            via {request.authProvider}
                          </span>
                        </div>
                        <p className="text-[10px] text-text-muted mt-1">
                          Registered {new Date(request.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => approveUser(
                            authUsers.find(u => u.email === request.email)?.id || '',
                            request.requestedRole,
                            authUser.id
                          )}
                          className="px-3 py-1.5 rounded-lg bg-success/10 border border-success/20 text-success text-xs font-medium hover:bg-success/20 transition-colors cursor-pointer"
                        >
                          <CheckCircle className="w-3 h-3 inline mr-1" />
                          Approve
                        </button>
                        <button
                          onClick={() => rejectUser(
                            authUsers.find(u => u.email === request.email)?.id || '',
                            authUser.id
                          )}
                          className="px-3 py-1.5 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs font-medium hover:bg-danger/20 transition-colors cursor-pointer"
                        >
                          <XCircle className="w-3 h-3 inline mr-1" />
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* All Auth Users */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5 text-gold" />
              <h3 className="text-sm font-semibold">User Management</h3>
            </div>
            <div className="space-y-3">
              {authUsers.map(user => (
                <div key={user.id} className="p-4 rounded-xl bg-white/[0.02] border border-border">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium">{user.fullName}</p>
                      <p className="text-[11px] text-text-muted">{user.email}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={cn(
                          'badge text-[9px]',
                          user.status === 'approved' ? 'badge-success' :
                          user.status === 'pending' ? 'badge-warning' :
                          user.status === 'rejected' ? 'badge-danger' :
                          'badge-danger'
                        )}>
                          {getStatusDisplayName(user.status)}
                        </span>
                        <span className="badge badge-info text-[9px]">
                          {getRoleDisplayName(user.role)}
                        </span>
                        <span className="badge text-[9px] bg-white/5 text-text-muted border-border">
                          {user.authProvider}
                        </span>
                      </div>
                      {user.approvedAt && (
                        <p className="text-[10px] text-text-muted mt-1">
                          Approved {new Date(user.approvedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {user.status === 'approved' && user.id !== authUser.id && (
                        <>
                          <select
                            value={user.role}
                            onChange={e => updateUserRole(user.id, e.target.value as AuthRole, authUser.id)}
                            className="text-xs px-2 py-1 rounded-lg bg-surface border border-border text-text-primary"
                          >
                            <option value="administrator">Administrator</option>
                            <option value="mediabuyer">Mediabuyer</option>
                            <option value="confirmator">Confirmator</option>
                          </select>
                          <button
                            onClick={() => suspendUser(user.id)}
                            className="px-2 py-1 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs hover:bg-danger/20 transition-colors cursor-pointer"
                          >
                            <UserX className="w-3 h-3" />
                          </button>
                        </>
                      )}
                      {user.status === 'suspended' && user.id !== authUser.id && (
                        <button
                          onClick={() => reactivateUser(user.id)}
                          className="px-2 py-1 rounded-lg bg-success/10 border border-success/20 text-success text-xs hover:bg-success/20 transition-colors cursor-pointer"
                        >
                          <UserCheck className="w-3 h-3" />
                        </button>
                      )}
                      {user.id === authUser.id && (
                        <span className="text-[10px] text-gold font-medium">You</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* YouCan Integration */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Store className="w-5 h-5 text-gold" />
          <h3 className="text-sm font-semibold">YouCan Integration</h3>
          <span className={cn(
            'badge text-[9px] ml-auto',
            youcanConnection.status === 'CONNECTED'
              ? 'bg-success/10 border border-success/20 text-success'
              : 'bg-white/5 border border-border text-text-muted'
          )}>
            {youcanConnection.status === 'CONNECTED' ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        {youcanConnection.status === 'CONNECTED' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-white/[0.02] border border-border">
                <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Store Name</p>
                <p className="text-sm font-medium">{youcanConnection.storeName || 'YouCan Store'}</p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-border">
                <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Orders Synced</p>
                <p className="text-sm font-medium">{youcanConnection.ordersSyncedCount}</p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-border">
                <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Last Sync</p>
                <p className="text-sm font-medium">
                  {youcanConnection.lastSyncAt
                    ? new Date(youcanConnection.lastSyncAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                    : 'Never'}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-border">
                <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Token Expires</p>
                <p className="text-sm font-medium">
                  {youcanConnection.expiresAt
                    ? new Date(youcanConnection.expiresAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                    : 'N/A'}
                </p>
              </div>
            </div>

            {youcanTestResult && (
              <div className={cn(
                'p-3 rounded-xl text-xs',
                youcanTestResult.success ? 'bg-success/10 border border-success/20 text-success' : 'bg-danger/10 border border-danger/20 text-danger'
              )}>
                {youcanTestResult.success ? 'Connection test successful!' : youcanTestResult.error}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={handleYoucanTest}
                disabled={youcanLoading}
                className="btn-secondary px-4 py-2 text-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Test Connection
              </button>
              <button
                onClick={handleYoucanDisconnect}
                className="btn-danger px-4 py-2 text-xs flex items-center gap-2 cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" />
                Disconnect
              </button>
            </div>

            <p className="text-[10px] text-text-muted">
              Webhook URL: <span className="font-mono text-text-secondary">https://foxbox-api.foxboxsolutions01.workers.dev/api/webhooks/youcan/orders</span>
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-text-muted">
              Connect your YouCan store to automatically sync orders, track shipments, and manage your e-commerce operations from one place.
            </p>
            <button
              onClick={handleYoucanConnect}
              disabled={youcanLoading}
              className="btn-primary px-6 py-2.5 text-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {youcanLoading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Store className="w-3.5 h-3.5" />
              )}
              {youcanLoading ? 'Connecting...' : 'Connect YouCan Store'}
            </button>
            <p className="text-[10px] text-text-muted">
              You'll be redirected to YouCan to authorize access. No credentials are stored on our servers.
            </p>
          </div>
        )}
      </div>

      {/* Data Management */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Receipt className="w-5 h-5 text-gold" />
          <h3 className="text-sm font-semibold">Data Management</h3>
        </div>
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={handleExport} className="btn-secondary flex items-center justify-center gap-2">
              {exported ? (
                <><Check className="w-4 h-4" /> Downloaded!</>
              ) : (
                <><Download className="w-4 h-4" /> Export Data (JSON)</>
              )}
            </button>
            <button onClick={handleReset} className="btn-danger flex items-center justify-center gap-2">
              <Trash2 className="w-4 h-4" />
              Reset All Data
            </button>
          </div>
          <p className="text-[11px] text-text-muted">
            Export downloads a backup of all data. Reset clears localStorage and reloads with defaults.
          </p>
        </div>
      </div>

      {/* About */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Info className="w-5 h-5 text-gold" />
          <h3 className="text-sm font-semibold">About</h3>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Application</span>
            <span className="text-text-primary font-medium">FOXBOX TEAM OS</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Version</span>
            <span className="text-text-primary font-medium">1.0.0</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Framework</span>
            <span className="text-text-primary font-medium">React 19 + TypeScript</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Styling</span>
            <span className="text-text-primary font-medium">Tailwind CSS v4</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Storage</span>
            <span className="text-text-primary font-medium">localStorage</span>
          </div>
        </div>
      </div>
    </div>
  )
}
