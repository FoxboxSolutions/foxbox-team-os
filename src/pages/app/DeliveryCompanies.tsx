import { useState, useCallback, useEffect } from 'react'
import {
  Link as LinkIcon,
  Wifi,
  WifiOff,
  RefreshCw,
  X,
  Truck,
  Search,
} from 'lucide-react'
import { useAppState } from '@/stores/AppState'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { getProviderConfig, DELIVERY_PROVIDER_REGISTRY } from '@/lib/delivery-providers'

// ─── Helpers ────────────────────────────────────────────────

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec} sec`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} min`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h`
  const days = Math.floor(hr / 24)
  return `${days}j`
}

function formatDateTime(d: Date | string | undefined): string {
  if (!d) return '-'
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d))
}

// ─── Types ──────────────────────────────────────────────────

interface ProviderIntegration {
  id: string
  name: string
  hasApi: boolean
  envConfigured: boolean
  envKeyStatus: Record<string, boolean>
  integration: {
    id: string
    accountName: string
    linkedStoreId: string | null
    status: string
    errorMessage: string | null
    connectedAt: string | null
    lastTestedAt: string | null
    lastTestStatus: string | null
  } | null
}

// ─── Component ──────────────────────────────────────────────

export function DeliveryCompanies() {
  const { addActivityLog, currentUser } = useAppState()

  // ─── State ──────────────────────────────────────────────
  const [providerIntegrations, setProviderIntegrations] = useState<ProviderIntegration[]>([])
  const [integrationsLoading, setIntegrationsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showConnectModal, setShowConnectModal] = useState<string | null>(null)
  const [showManageModal, setShowManageModal] = useState<string | null>(null)
  const [connectForm, setConnectForm] = useState({ accountName: 'Default', linkedStoreId: '' })
  const [connectLoading, setConnectLoading] = useState(false)
  const [connectError, setConnectError] = useState('')
  const [testLoading, setTestLoading] = useState<string | null>(null)
  const [disconnectLoading, setDisconnectLoading] = useState<string | null>(null)
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState<string | null>(null)

  // ─── Load integrations ──────────────────────────────────

  const loadProviderIntegrations = useCallback(async () => {
    setIntegrationsLoading(true)
    try {
      const providers = await api.getDeliveryIntegrationProviders()
      setProviderIntegrations(providers)
    } catch (err) {
      console.error('Failed to load provider integrations:', err)
    } finally {
      setIntegrationsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProviderIntegrations()
  }, [loadProviderIntegrations])

  // ─── Handlers ───────────────────────────────────────────

  const handleConnectProvider = useCallback(async (providerId: string) => {
    setConnectLoading(true)
    setConnectError('')
    try {
      await api.connectDeliveryProvider({
        providerId,
        accountName: connectForm.accountName || 'Default',
        linkedStoreId: connectForm.linkedStoreId || undefined,
      })
      setShowConnectModal(null)
      setConnectForm({ accountName: 'Default', linkedStoreId: '' })
      await loadProviderIntegrations()
      addActivityLog({
        id: `log_${Date.now()}`,
        userId: currentUser?.id || 'system',
        action: 'DELIVERY_PROVIDER_CONNECTED',
        entityType: 'DELIVERY_INTEGRATION',
        entityId: providerId,
        entityName: getProviderConfig(providerId)?.name || providerId,
        details: `Connected ${getProviderConfig(providerId)?.name || providerId}`,
        createdAt: new Date(),
      })
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : 'Connection failed')
    } finally {
      setConnectLoading(false)
    }
  }, [connectForm, loadProviderIntegrations, addActivityLog, currentUser])

  const handleTestIntegration = useCallback(async (providerId: string) => {
    setTestLoading(providerId)
    try {
      await api.testDeliveryIntegration(providerId)
      await loadProviderIntegrations()
      addActivityLog({
        id: `log_${Date.now()}`,
        userId: currentUser?.id || 'system',
        action: 'DELIVERY_PROVIDER_TESTED',
        entityType: 'DELIVERY_INTEGRATION',
        entityId: providerId,
        entityName: getProviderConfig(providerId)?.name || providerId,
        details: `Tested ${getProviderConfig(providerId)?.name || providerId} — connection OK`,
        createdAt: new Date(),
      })
    } catch (err) {
      console.error('Test failed:', err)
    } finally {
      setTestLoading(null)
    }
  }, [loadProviderIntegrations, addActivityLog, currentUser])

  const handleDisconnectProvider = useCallback(async (providerId: string) => {
    setDisconnectLoading(providerId)
    try {
      await api.disconnectDeliveryProvider(providerId)
      setShowDisconnectConfirm(null)
      setShowManageModal(null)
      await loadProviderIntegrations()
      addActivityLog({
        id: `log_${Date.now()}`,
        userId: currentUser?.id || 'system',
        action: 'DELIVERY_PROVIDER_DISCONNECTED',
        entityType: 'DELIVERY_INTEGRATION',
        entityId: providerId,
        entityName: getProviderConfig(providerId)?.name || providerId,
        details: `Disconnected ${getProviderConfig(providerId)?.name || providerId}`,
        createdAt: new Date(),
      })
    } catch (err) {
      console.error('Disconnect failed:', err)
    } finally {
      setDisconnectLoading(null)
    }
  }, [loadProviderIntegrations, addActivityLog, currentUser])

  // ─── Filter providers by search ─────────────────────────

  const filteredProviders = providerIntegrations.filter(p => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return p.name.toLowerCase().includes(q)
  })

  const connectedCount = providerIntegrations.filter(p => p.integration?.status === 'connected').length

  // ─── Render ─────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Delivery Companies</h1>
          <p className="text-sm text-text-muted mt-1">Manage your delivery provider integrations.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.03] text-text-muted border border-border">
            <Truck className="w-4 h-4" />
            <span>{connectedCount} Connected</span>
          </div>
          <button onClick={loadProviderIntegrations} disabled={integrationsLoading} className="btn-secondary text-xs">
            <RefreshCw className={cn('w-4 h-4', integrationsLoading && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="glass-card p-4">
        <div className="header-search flex items-center gap-3 px-4 py-2.5 max-w-md">
          <Search className="w-4 h-4 text-text-muted shrink-0" />
          <input
            type="text"
            placeholder="Search providers..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none text-sm text-text-primary placeholder:text-text-muted w-full"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-text-muted hover:text-text-primary">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Provider Grid */}
      {integrationsLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-5 h-5 text-text-muted animate-spin" />
          <span className="ml-2 text-sm text-text-muted">Loading providers...</span>
        </div>
      ) : filteredProviders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Truck className="w-6 h-6" /></div>
          <p className="text-sm text-text-muted">No providers found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProviders.map(provider => {
            const config = getProviderConfig(provider.id)
            const integration = provider.integration
            const isConnected = integration?.status === 'connected'
            const hasError = integration?.status === 'error'

            return (
              <div key={provider.id} className="glass-card overflow-hidden group hover:border-gold/20 transition-all">
                {/* Provider Header */}
                <div className="p-5 text-center">
                  <div
                    className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-3xl"
                    style={{ backgroundColor: `${config?.color || '#666'}15` }}
                  >
                    {config?.logo || '📦'}
                  </div>
                  <h3 className="text-sm font-semibold mb-1">{provider.name}</h3>
                  <p className="text-[11px] text-text-muted line-clamp-2 mb-3 min-h-[32px]">
                    {config?.description || 'Delivery provider'}
                  </p>

                  {/* Status Badge */}
                  <div className="flex items-center justify-center gap-1.5 mb-4">
                    <div className={cn(
                      'w-2 h-2 rounded-full',
                      isConnected ? 'bg-success' :
                      hasError ? 'bg-danger' :
                      'bg-text-muted/40'
                    )} />
                    <span className={cn(
                      'text-xs font-medium',
                      isConnected ? 'text-success' :
                      hasError ? 'text-danger' :
                      'text-text-muted'
                    )}>
                      {isConnected ? 'Connected' :
                       hasError ? 'Connection failed' :
                       provider.envConfigured ? 'Available' :
                       'Integration coming soon'}
                    </span>
                  </div>

                  {/* API indicator */}
                  {!provider.hasApi && (
                    <p className="text-[10px] text-text-muted/60 mb-3 italic">API integration in development</p>
                  )}

                  {/* Action Button */}
                  {isConnected ? (
                    <button
                      onClick={() => setShowManageModal(provider.id)}
                      className="w-full px-4 py-2 rounded-xl text-xs font-medium bg-gold/10 text-gold border border-gold/20 hover:bg-gold/20 transition-all"
                    >
                      Manage
                    </button>
                  ) : provider.hasApi && provider.envConfigured ? (
                    <button
                      onClick={() => { setShowConnectModal(provider.id); setConnectForm({ accountName: 'Default', linkedStoreId: '' }); setConnectError(''); }}
                      className="w-full px-4 py-2 rounded-xl text-xs font-medium bg-gold text-black hover:bg-gold/90 transition-all"
                    >
                      Connect
                    </button>
                  ) : (
                    <button disabled className="w-full px-4 py-2 rounded-xl text-xs font-medium bg-white/[0.03] text-text-muted/40 border border-border cursor-not-allowed">
                      Coming Soon
                    </button>
                  )}
                </div>

                {/* Connected Details */}
                {isConnected && integration && (
                  <div className="border-t border-border px-5 py-3 bg-white/[0.01]">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-text-muted">Account</span>
                      <span className="text-text-secondary font-medium">{integration.accountName}</span>
                    </div>
                    {integration.lastTestedAt && (
                      <div className="flex items-center justify-between text-[11px] mt-1">
                        <span className="text-text-muted">Last tested</span>
                        <span className="text-text-secondary">{formatTimeAgo(integration.lastTestedAt)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* CONNECT PROVIDER MODAL                             */}
      {/* ═══════════════════════════════════════════════════ */}
      {showConnectModal && (() => {
        const config = getProviderConfig(showConnectModal)
        if (!config) return null
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowConnectModal(null)} />
            <div className="relative bg-bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl">
              <div className="border-b border-border px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: `${config.color}15` }}>
                    {config.logo}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Connect to {config.name}</h2>
                    <p className="text-xs text-text-muted">Configure delivery integration</p>
                  </div>
                </div>
                <button onClick={() => setShowConnectModal(null)} className="p-2 rounded-lg hover:bg-white/[0.05] text-text-muted"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-4">
                {connectError && (
                  <div className="p-3 rounded-xl bg-danger/10 border border-danger/20 text-sm text-danger">{connectError}</div>
                )}

                <div>
                  <label className="text-xs text-text-muted mb-1 block">Account name</label>
                  <input
                    type="text"
                    value={connectForm.accountName}
                    onChange={e => setConnectForm(f => ({ ...f, accountName: e.target.value }))}
                    placeholder="Default"
                    className="input-field w-full"
                  />
                  <p className="text-[10px] text-text-muted mt-1">Optional identifier for this connection</p>
                </div>

                <div>
                  <label className="text-xs text-text-muted mb-1 block">Linked store</label>
                  <select
                    value={connectForm.linkedStoreId}
                    onChange={e => setConnectForm(f => ({ ...f, linkedStoreId: e.target.value }))}
                    className="select-field w-full"
                  >
                    <option value="">No specific store</option>
                  </select>
                  <p className="text-[10px] text-text-muted mt-1">Associate this delivery connection with a specific store</p>
                </div>

                <div className="p-3 rounded-xl bg-info/5 border border-info/10">
                  <p className="text-[11px] text-text-muted">
                    API credentials for {config.name} are managed server-side as Worker environment secrets.
                    Contact your administrator to configure them.
                  </p>
                </div>

                {config.credentialFields.length > 0 && (
                  <div className="space-y-2">
                    {config.credentialFields.map(field => (
                      <div key={field.type}>
                        <label className="text-xs text-text-muted mb-1 block">{field.label} {field.required && '*'}</label>
                        <div className="relative">
                          <input
                            type="password"
                            placeholder={field.placeholder}
                            disabled
                            className="input-field w-full opacity-50 cursor-not-allowed"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-text-muted bg-bg-surface px-1">Server-managed</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="border-t border-border px-6 py-4 flex items-center justify-end gap-3">
                <button onClick={() => setShowConnectModal(null)} className="btn-secondary">Cancel</button>
                <button
                  onClick={() => handleConnectProvider(showConnectModal)}
                  disabled={connectLoading}
                  className="btn-primary"
                >
                  {connectLoading ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Connecting...</>
                  ) : (
                    <><LinkIcon className="w-4 h-4" /> Connect</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ═══════════════════════════════════════════════════ */}
      {/* MANAGE PROVIDER MODAL                               */}
      {/* ═══════════════════════════════════════════════════ */}
      {showManageModal && (() => {
        const config = getProviderConfig(showManageModal)
        const integration = providerIntegrations.find(p => p.id === showManageModal)?.integration
        if (!config || !integration) return null
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowManageModal(null)} />
            <div className="relative bg-bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl">
              <div className="border-b border-border px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: `${config.color}15` }}>
                    {config.logo}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">{config.name}</h2>
                    <div className="flex items-center gap-1.5">
                      <div className={cn('w-2 h-2 rounded-full', integration.status === 'connected' ? 'bg-success' : 'bg-danger')} />
                      <span className={cn('text-xs', integration.status === 'connected' ? 'text-success' : 'text-danger')}>
                        {integration.status === 'connected' ? 'Connected' : 'Error'}
                      </span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setShowManageModal(null)} className="p-2 rounded-lg hover:bg-white/[0.05] text-text-muted"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="glass-card p-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-muted">Account</span>
                    <span className="font-medium">{integration.accountName}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-muted">Connected</span>
                    <span>{integration.connectedAt ? formatDateTime(integration.connectedAt) : '-'}</span>
                  </div>
                  {integration.lastTestedAt && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-text-muted">Last tested</span>
                      <span className={cn(integration.lastTestStatus === 'ok' ? 'text-success' : 'text-danger')}>
                        {integration.lastTestStatus === 'ok' ? 'Passed' : 'Failed'} — {formatTimeAgo(integration.lastTestedAt)}
                      </span>
                    </div>
                  )}
                  {integration.errorMessage && (
                    <div className="p-2 rounded-lg bg-danger/5 border border-danger/10">
                      <p className="text-[11px] text-danger">{integration.errorMessage}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() => handleTestIntegration(showManageModal)}
                    disabled={testLoading === showManageModal}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/[0.03] text-text-secondary border border-border hover:bg-white/[0.05] transition-all"
                  >
                    {testLoading === showManageModal ? (
                      <><RefreshCw className="w-4 h-4 animate-spin" /> Testing...</>
                    ) : (
                      <><Wifi className="w-4 h-4" /> Test Connection</>
                    )}
                  </button>

                  <button
                    onClick={() => setShowDisconnectConfirm(showManageModal)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-danger/5 text-danger border border-danger/10 hover:bg-danger/10 transition-all"
                  >
                    <WifiOff className="w-4 h-4" /> Disconnect
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ═══════════════════════════════════════════════════ */}
      {/* DISCONNECT CONFIRMATION                             */}
      {/* ═══════════════════════════════════════════════════ */}
      {showDisconnectConfirm && (() => {
        const config = getProviderConfig(showDisconnectConfirm)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDisconnectConfirm(null)} />
            <div className="relative bg-bg-surface border border-border rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center">
              <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-4">
                <WifiOff className="w-6 h-6 text-danger" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Disconnect {config?.name || 'Provider'}?</h3>
              <p className="text-sm text-text-muted mb-6">
                Existing delivery orders and historical records will not be deleted. You can reconnect at any time.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button onClick={() => setShowDisconnectConfirm(null)} className="btn-secondary">Cancel</button>
                <button
                  onClick={() => handleDisconnectProvider(showDisconnectConfirm)}
                  disabled={disconnectLoading === showDisconnectConfirm}
                  className="btn-primary bg-danger/15 text-danger border-danger/20 hover:bg-danger/25"
                >
                  {disconnectLoading === showDisconnectConfirm ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Disconnecting...</>
                  ) : (
                    <><WifiOff className="w-4 h-4" /> Disconnect</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
