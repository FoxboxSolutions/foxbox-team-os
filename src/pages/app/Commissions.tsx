import { useState, useEffect, useCallback } from 'react'
import { Wallet, Trophy, Loader2, Save } from 'lucide-react'
import { useAppState } from '@/stores/AppState'
import { UserAvatar } from '@/components/auth/UserAvatar'
import { api } from '@/lib/api'
import type { AgentCommissionSummary, CommissionEntry } from '@/types'

function formatDA(n: number, currency = 'DA'): string {
  return `${(Number(n) || 0).toLocaleString('en-US')} ${currency}`
}

export function Commissions() {
  const { authUser } = useAppState()
  const isAdmin = authUser?.role === 'administrator'

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [amountPerOrder, setAmountPerOrder] = useState(150)
  const [currency, setCurrency] = useState('DA')
  const [agents, setAgents] = useState<AgentCommissionSummary[]>([])
  const [ledger, setLedger] = useState<CommissionEntry[]>([])
  const [configDraft, setConfigDraft] = useState('150')
  const [savingConfig, setSavingConfig] = useState(false)
  const [configMsg, setConfigMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [summary, ledgerRes] = await Promise.all([
      api.getCommissionSummary(),
      api.getCommissionLedger({ limit: 30 }),
    ])
    setAmountPerOrder(summary.amountPerOrder)
    setCurrency(summary.currency)
    setConfigDraft(String(summary.amountPerOrder))
    setAgents(summary.agents as unknown as AgentCommissionSummary[])
    setLedger(ledgerRes.commissions as unknown as CommissionEntry[])
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    load()
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load commissions.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [load])

  const handleSaveConfig = async () => {
    const amount = parseInt(configDraft, 10)
    if (!Number.isFinite(amount) || amount < 0 || amount > 1000000) {
      setConfigMsg('Enter an amount between 0 and 1,000,000.')
      return
    }
    setSavingConfig(true)
    setConfigMsg(null)
    try {
      const cfg = await api.saveCommissionConfig(amount)
      setAmountPerOrder(cfg.amountPerOrder)
      setCurrency(cfg.currency)
      setConfigMsg(`Saved. New confirmations earn ${formatDA(cfg.amountPerOrder, cfg.currency)} each. Past entries are unchanged.`)
      await load().catch(() => {})
    } catch (err) {
      setConfigMsg(err instanceof Error ? err.message : 'Could not save.')
    } finally {
      setSavingConfig(false)
    }
  }

  const me = agents.find(a => a.userId === authUser?.id)
  const totals = agents.reduce(
    (acc, a) => ({ confirmed: acc.confirmed + a.confirmedCount, earned: acc.earned + a.totalEarned }),
    { confirmed: 0, earned: 0 }
  )

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold text-text-primary">Commissions</h1>
        <p className="text-sm text-text-muted mt-1">
          {formatDA(amountPerOrder, currency)} per confirmed order · pending and canceled orders earn 0.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-danger/10 border border-danger/20 flex items-center justify-between gap-3">
          <p className="text-sm text-danger">{error}</p>
          <button
            onClick={() => { setError(null); setLoading(true); load().catch((e) => setError(e instanceof Error ? e.message : 'Failed.')).finally(() => setLoading(false)) }}
            className="btn-secondary text-xs py-1.5 flex-shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="glass-card p-12 text-center">
          <Loader2 className="w-6 h-6 animate-spin text-gold mx-auto mb-3" />
          <p className="text-sm text-text-muted">Loading commissions...</p>
        </div>
      ) : (
        <>
          {/* Own + totals */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="w-4 h-4 text-gold" />
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">My earnings</p>
              </div>
              <p className="text-2xl font-bold text-text-primary">{formatDA(me?.totalEarned ?? 0, currency)}</p>
              <p className="text-xs text-text-muted mt-1">{me?.confirmedCount ?? 0} confirmed orders</p>
            </div>
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-4 h-4 text-gold" />
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Team total</p>
              </div>
              <p className="text-2xl font-bold text-text-primary">{formatDA(totals.earned, currency)}</p>
              <p className="text-xs text-text-muted mt-1">{totals.confirmed} confirmed orders</p>
            </div>
            <div className="glass-card p-5">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Rate</p>
              <p className="text-2xl font-bold text-text-primary">{formatDA(amountPerOrder, currency)}</p>
              <p className="text-xs text-text-muted mt-1">per confirmed order</p>
            </div>
          </div>

          {/* Team performance */}
          <div className="glass-card rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-text-primary">Team performance</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Agent</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Confirmed</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Rate</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Total earned</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((a) => (
                    <tr key={a.userId} className="border-b border-border hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <UserAvatar name={a.fullName || a.email} size="sm" />
                          <div>
                            <p className="text-sm font-medium text-text-primary">
                              {a.fullName || '—'}
                              {a.userId === authUser?.id && <span className="ml-2 text-[10px] text-gold">you</span>}
                            </p>
                            <p className="text-xs text-text-muted">{a.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-right text-sm text-text-primary">{a.confirmedCount}</td>
                      <td className="px-6 py-3 text-right text-xs text-text-muted">{formatDA(amountPerOrder, currency)}</td>
                      <td className="px-6 py-3 text-right text-sm font-semibold text-gold">{formatDA(a.totalEarned, currency)}</td>
                    </tr>
                  ))}
                  {agents.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-sm text-text-muted">
                        No confirmed orders yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Config (admin) */}
          {isAdmin && (
            <div className="glass-card p-5">
              <h2 className="text-sm font-semibold text-text-primary mb-1">Commission rate</h2>
              <p className="text-xs text-text-muted mb-4">Applies to future confirmations only. Past ledger entries keep their recorded amount.</p>
              <div className="flex items-center gap-3 flex-wrap">
                <input
                  type="number"
                  min={0}
                  max={1000000}
                  value={configDraft}
                  onChange={(e) => setConfigDraft(e.target.value)}
                  className="input-field w-40"
                />
                <span className="text-sm text-text-muted">{currency}</span>
                <button onClick={handleSaveConfig} disabled={savingConfig} className="btn-primary disabled:opacity-40">
                  {savingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save
                </button>
                {configMsg && <p className="text-xs text-text-muted w-full">{configMsg}</p>}
              </div>
            </div>
          )}

          {/* Ledger */}
          <div className="glass-card rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-text-primary">Recent commissions</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Agent</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Confirmation</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Amount</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Earned</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((c) => (
                    <tr key={c.id} className="border-b border-border hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-3 text-sm text-text-primary">{c.agentName || c.agentId}</td>
                      <td className="px-6 py-3 text-xs text-text-muted font-mono">{c.confirmationId}</td>
                      <td className="px-6 py-3 text-right text-sm font-medium text-gold">{formatDA(c.amount, c.currency)}</td>
                      <td className="px-6 py-3 text-right text-xs text-text-muted">{new Date(c.earnedAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {ledger.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-sm text-text-muted">
                        No commission entries yet. They appear here when orders reach Confirmed.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
