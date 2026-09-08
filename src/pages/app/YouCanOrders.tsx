import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Store, Search, RefreshCw, Filter, ChevronDown,
  Package, Clock, CheckCircle, XCircle, DollarSign,
  Eye, Loader2, AlertCircle, Truck,
  ShoppingBag, Phone, MapPin, ChevronLeft, ChevronRight,
  MessageSquare, Download, FileSpreadsheet, AlertTriangle,
  Trash2, Send, Check, AlertOctagon,
} from 'lucide-react'
import { useAppState } from '@/stores/AppState'
import { cn } from '@/lib/utils'
import type { YouCanOrder } from '@/types'

const API_BASE = import.meta.env.VITE_API_URL || 'https://foxbox-api.foxboxsolutions01.workers.dev/api'

const ECOM_COLUMNS = [
  'Nom Complet', 'Téléphone', 'Article', 'Quantité', 'Adresse',
  'Nom ou Code Wilaya', 'Commune', 'Total à ramasser', 'ID Externe',
  'OUI pour Echange', 'Si Stopdesk mettez le Code du stopdesk', 'Ref Article', 'Note',
]

export default function YouCanOrdersPage() {
  const navigate = useNavigate()
  const { youcanOrders, youcanConnection, syncYoucanOrders, fetchYoucanOrders, addNotification, addActivityLog, authUser } = useAppState()

  const [orders, setOrders] = useState<YouCanOrder[]>(youcanOrders)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')
  const [shippingFilter, setShippingFilter] = useState('')
  const [deliveryFilter, setDeliveryFilter] = useState('')
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [kpis, setKpis] = useState({ totalOrders: 0, newToday: 0, pending: 0, confirmed: 0, cancelled: 0, totalRevenue: 0 })
  const [selectedOrder, setSelectedOrder] = useState<YouCanOrder | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportData, setExportData] = useState<{ rows: Array<Record<string, string>>; errors: Array<{ orderId: string; missing: string[] }> } | null>(null)
  const [exporting, setExporting] = useState(false)
  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<YouCanOrder | null>(null)
  const [deleting, setDeleting] = useState(false)
  // Push to Ecom state
  const [pushTarget, setPushTarget] = useState<YouCanOrder | null>(null)
  const [pushPreview, setPushPreview] = useState<Record<string, string> | null>(null)
  const [pushing, setPushing] = useState(false)
  const [pushError, setPushError] = useState<string | null>(null)
  const [pushSuccess, setPushSuccess] = useState<{ tracking: string } | null>(null)
  // Bulk operations state
  const [bulkMode, setBulkMode] = useState<'idle' | 'deleting' | 'pushing'>('idle')
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number; sent: number; failed: number; skipped: number; results: Array<{ orderId: string; externalOrderId: string; status: string; tracking?: string; error?: string }> } | null>(null)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const limit = 50

  const loadOrders = useCallback(async () => {
    setLoading(true)
    const params: Record<string, string> = { page: String(page), limit: String(limit), sort }
    if (search) params.search = search
    if (statusFilter) params.status = statusFilter
    if (paymentFilter) params.payment_status = paymentFilter
    if (shippingFilter) params.shipping_status = shippingFilter
    if (deliveryFilter) params.delivery_method = deliveryFilter

    const result = await fetchYoucanOrders(params)
    setOrders(result.orders)
    setTotal(result.total)
    setTotalPages(Math.ceil(result.total / limit))
    setKpis(result.kpis)
    setLoading(false)
  }, [page, sort, search, statusFilter, paymentFilter, shippingFilter, deliveryFilter, fetchYoucanOrders])

  useEffect(() => { loadOrders() }, [loadOrders])

  // Sync with local store
  useEffect(() => { setOrders(youcanOrders) }, [youcanOrders])

  const handleSync = async () => {
    setSyncing(true)
    const result = await syncYoucanOrders()
    if (result.success) {
      addNotification({
        id: Date.now().toString(),
        title: 'YouCan Sync Complete',
        message: `Imported ${result.count} orders from YouCan`,
        type: 'YOUCAN_SYNC_COMPLETE',
        userId: authUser?.id || 'system',
        isRead: false,
        createdAt: new Date(),
      })
      if (authUser) {
        addActivityLog({
          id: Date.now().toString(),
          action: 'YOUCAN_SYNC_COMPLETED',
          userId: authUser.id,
          entityType: 'ORDER',
          entityId: 'youcan-sync',
          entityName: `Synced ${result.count} orders`,
          createdAt: new Date(),
        })
      }
      loadOrders()
    } else {
      addNotification({
        id: Date.now().toString(),
        title: 'YouCan Sync Failed',
        message: result.error || 'Unknown error',
        type: 'YOUCAN_SYNC_FAILED',
        userId: authUser?.id || 'system',
        isRead: false,
        createdAt: new Date(),
      })
    }
    setSyncing(false)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    loadOrders()
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === orders.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(orders.map(o => o.externalOrderId)))
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const handleExport = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    setExporting(true)
    try {
      const res = await fetch(`${API_BASE}/youcan/ecom-export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: ids }),
      })
      const json = await res.json()
      const data = json.data || json
      setExportData({ rows: data.rows || [], errors: data.errors || [] })
      setShowExportModal(true)
    } catch {
      setExportData({ rows: [], errors: [{ orderId: 'unknown', missing: ['connection'] }] })
      setShowExportModal(true)
    }
    setExporting(false)
  }

  const downloadCSV = () => {
    if (!exportData?.rows.length) return
    const header = ECOM_COLUMNS.join('\t')
    const rows = exportData.rows.map(row => ECOM_COLUMNS.map(col => (row[col] || '').replace(/\t/g, ' ')).join('\t'))
    const csv = [header, ...rows].join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/tab-separated-values;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ecom-delivery-export-${new Date().toISOString().slice(0, 10)}.tsv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ─── Delete Handler ───────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`${API_BASE}/youcan/orders/${deleteTarget.externalOrderId}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (json.data?.deleted || json.deleted) {
        addNotification({
          id: Date.now().toString(),
          title: 'Order Deleted',
          message: `Order #${deleteTarget.orderRef || deleteTarget.externalOrderId?.slice(0, 8)} removed from FOXBOX`,
          type: 'GENERAL',
          userId: authUser?.id || 'system',
          isRead: false,
          createdAt: new Date(),
        })
        setDeleteTarget(null)
        loadOrders()
      } else {
        addNotification({
          id: Date.now().toString(),
          title: 'Delete Failed',
          message: json.error || 'Unknown error',
          type: 'YOUCAN_SYNC_FAILED',
          userId: authUser?.id || 'system',
          isRead: false,
          createdAt: new Date(),
        })
      }
    } catch (err) {
      addNotification({
        id: Date.now().toString(),
        title: 'Delete Failed',
        message: err instanceof Error ? err.message : 'Network error',
        type: 'YOUCAN_SYNC_FAILED',
        userId: authUser?.id || 'system',
        isRead: false,
        createdAt: new Date(),
      })
    }
    setDeleting(false)
  }

  // ─── Push to Ecom Preview Builder ──────────────────────────
  const buildPushPreview = (order: YouCanOrder): Record<string, string> => {
    const items = order.orderItems || []
    const productName = items.length > 0 ? items[0].productName : ''
    const productRef = items.length > 0 ? (items[0].sku || items[0].ref || '') : ''
    const totalToCollect = order.totalToCollect || order.total + order.deliveryFee

    let ecomAddress = order.address || ''
    if (order.shippingMethod === 'bureau') {
      const bureauParts = [order.officeName, order.wilaya].filter(Boolean).join(' - ')
      ecomAddress = bureauParts || ecomAddress
    }

    return {
      'Nom Complet': order.customerName || '',
      'Téléphone': order.customerPhone || '',
      'Article': productName,
      'Quantité': String(order.quantity || 1),
      'Adresse': ecomAddress,
      'Wilaya': order.wilayaCode ? `${order.wilayaCode} — ${order.wilaya || ''}` : '',
      'Commune': order.baladiya || '',
      'Shipping': order.shippingMethod === 'bureau' ? `Bureau — ${order.stopdeskCode || ''}` : 'Domicile',
      'Delivery Fee': formatDZD(order.deliveryFee),
      'Total à ramasser': formatDZD(totalToCollect),
      'ID Externe': order.externalOrderId || '',
      'OUI pour Echange': order.exchange ? 'OUI' : 'NON',
      'Stopdesk Code': order.shippingMethod === 'bureau' ? (order.stopdeskCode || '') : '',
      'Ref Article': productRef,
      'Note': order.note || '',
    }
  }

  // ─── Push to Ecom Handler ──────────────────────────────────
  const handlePush = async () => {
    if (!pushTarget) return
    setPushing(true)
    setPushError(null)
    try {
      const res = await fetch(`${API_BASE}/youcan/push-to-ecom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: pushTarget.externalOrderId }),
      })
      const json = await res.json()
      const data = json.data || json

      if (res.ok && data.success) {
        setPushSuccess({ tracking: data.tracking || '' })
        addNotification({
          id: Date.now().toString(),
          title: 'Pushed to Ecom Delivery',
          message: `Order #${pushTarget.orderRef || pushTarget.externalOrderId?.slice(0, 8)} sent successfully`,
          type: 'GENERAL',
          userId: authUser?.id || 'system',
          isRead: false,
          createdAt: new Date(),
        })
        loadOrders()
      } else {
        const errorMsg = data.error || data.message || 'Push failed'
        setPushError(errorMsg)
      }
    } catch (err) {
      setPushError(err instanceof Error ? err.message : 'Network error')
    }
    setPushing(false)
  }

  // ─── Bulk Delete Handler ──────────────────────────────────
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    const ids = Array.from(selectedIds)
    setBulkMode('deleting')
    setBulkProgress({ current: 0, total: ids.length, sent: 0, failed: 0, skipped: 0, results: [] })
    setShowBulkModal(true)

    try {
      const res = await fetch(`${API_BASE}/youcan/bulk-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: ids }),
      })
      const json = await res.json()
      const data = json.data || json

      if (res.ok && data.deleted !== undefined) {
        setBulkProgress(prev => prev ? {
          ...prev,
          current: data.deleted,
          sent: data.deleted,
          results: data.ids?.map((id: string) => ({ orderId: id, externalOrderId: id, status: 'deleted' })) || [],
        } : null)
        addNotification({
          id: Date.now().toString(),
          title: 'Bulk Delete Complete',
          message: `${data.deleted} order(s) removed from FOXBOX`,
          type: 'GENERAL',
          userId: authUser?.id || 'system',
          isRead: false,
          createdAt: new Date(),
        })
        setSelectedIds(new Set())
        loadOrders()
      } else {
        setBulkProgress(prev => prev ? { ...prev, current: prev.total, failed: prev.total } : null)
      }
    } catch (err) {
      setBulkProgress(prev => prev ? { ...prev, current: prev.total, failed: prev.total } : null)
    }
    setBulkMode('idle')
  }

  // ─── Bulk Push to Ecom Handler ─────────────────────────────
  const handleBulkPush = async () => {
    if (selectedIds.size === 0) return
    const ids = Array.from(selectedIds)
    setBulkMode('pushing')
    setBulkProgress({ current: 0, total: ids.length, sent: 0, failed: 0, skipped: 0, results: [] })
    setShowBulkModal(true)

    try {
      const res = await fetch(`${API_BASE}/youcan/bulk-push-to-ecom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: ids }),
      })
      const json = await res.json()
      const data = json.data || json

      setBulkProgress({
        current: data.total || ids.length,
        total: data.total || ids.length,
        sent: data.sent || 0,
        failed: data.failed || 0,
        skipped: data.skipped || 0,
        results: data.results || [],
      })

      if (data.sent > 0) {
        addNotification({
          id: Date.now().toString(),
          title: 'Bulk Push Complete',
          message: `${data.sent} sent, ${data.failed} failed, ${data.skipped} skipped`,
          type: 'GENERAL',
          userId: authUser?.id || 'system',
          isRead: false,
          createdAt: new Date(),
        })
        loadOrders()
      }
    } catch (err) {
      setBulkProgress(prev => prev ? { ...prev, current: prev.total, failed: prev.total } : null)
    }
    setBulkMode('idle')
  }

  const formatDZD = (amount: number) => {
    return new Intl.NumberFormat('fr-DZ', { style: 'decimal', maximumFractionDigits: 0 }).format(amount) + ' DA'
  }

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string; label: string }> = {
      open: { bg: 'bg-info/10 border-info/20', text: 'text-info', label: 'Open' },
      confirmed: { bg: 'bg-success/10 border-success/20', text: 'text-success', label: 'Confirmed' },
      cancelled: { bg: 'bg-danger/10 border-danger/20', text: 'text-danger', label: 'Cancelled' },
      completed: { bg: 'bg-gold/10 border-gold/20', text: 'text-gold', label: 'Completed' },
      paid: { bg: 'bg-success/10 border-success/20', text: 'text-success', label: 'Paid' },
      pending: { bg: 'bg-warning/10 border-warning/20', text: 'text-warning', label: 'Pending' },
      failed: { bg: 'bg-danger/10 border-danger/20', text: 'text-danger', label: 'Failed' },
      refunded: { bg: 'bg-purple-500/10 border-purple-500/20', text: 'text-purple-400', label: 'Refunded' },
      unfulfilled: { bg: 'bg-white/5 border-border', text: 'text-text-muted', label: 'Unfulfilled' },
      fulfilled: { bg: 'bg-success/10 border-success/20', text: 'text-success', label: 'Fulfilled' },
      shipped: { bg: 'bg-info/10 border-info/20', text: 'text-info', label: 'Shipped' },
      delivered: { bg: 'bg-success/10 border-success/20', text: 'text-success', label: 'Delivered' },
      returned: { bg: 'bg-warning/10 border-warning/20', text: 'text-warning', label: 'Returned' },
    }
    const s = map[status] || { bg: 'bg-white/5 border-border', text: 'text-text-muted', label: status }
    return (
      <span className={cn('badge text-[9px] border', s.bg, s.text)}>
        {s.label}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-serif font-bold text-text-primary flex items-center gap-2">
            <Store className="w-5 h-5 text-gold" />
            YouCan Orders
          </h1>
          <p className="text-sm text-text-muted mt-1">Live orders synchronized from your YouCan store</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium',
            youcanConnection.status === 'CONNECTED'
              ? 'bg-success/10 border border-success/20 text-success'
              : 'bg-danger/10 border border-danger/20 text-danger'
          )}>
            <span className={cn('w-2 h-2 rounded-full', youcanConnection.status === 'CONNECTED' ? 'bg-success animate-pulse' : 'bg-danger')} />
            {youcanConnection.status === 'CONNECTED' ? 'Connected' : 'Disconnected'}
          </div>
          {selectedIds.size > 0 && (
            <button
              onClick={handleExport}
              disabled={exporting}
              className="btn-primary px-4 py-2 text-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Export Ecom ({selectedIds.size})
            </button>
          )}
          <button
            onClick={handleSync}
            disabled={syncing || youcanConnection.status !== 'CONNECTED'}
            className="btn-primary px-4 py-2 text-xs flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="glass-card p-4 border border-gold/20 bg-gold/[0.03]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center">
                <Check className="w-4 h-4 text-gold" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">{selectedIds.size} order{selectedIds.size > 1 ? 's' : ''} selected</p>
                <p className="text-[11px] text-text-muted">Choose an action for the selected orders</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedIds(new Set())}
                className="btn-secondary px-4 py-2.5 text-xs cursor-pointer"
              >
                Clear Selection
              </button>
              <button
                onClick={handleBulkPush}
                disabled={bulkMode === 'pushing'}
                className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-info text-white hover:bg-info/90 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {bulkMode === 'pushing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Push to Ecom Delivery ({selectedIds.size})
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkMode === 'deleting'}
                className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-danger text-white hover:bg-danger/90 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {bulkMode === 'deleting' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete ({selectedIds.size})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Not Connected Banner */}
      {youcanConnection.status !== 'CONNECTED' && (
        <div className="glass-card p-6 border border-warning/20 bg-warning/5">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-warning" />
            <div>
              <p className="text-sm font-medium text-text-primary">YouCan Store Not Connected</p>
              <p className="text-xs text-text-muted mt-1">
                Go to Settings → Integrations to connect your YouCan store and start syncing orders.
              </p>
            </div>
            <button
              onClick={() => navigate('/app/settings')}
              className="btn-secondary px-4 py-2 text-xs ml-auto cursor-pointer"
            >
              Go to Settings
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Total Orders', value: kpis.totalOrders, icon: ShoppingBag, color: 'text-gold' },
          { label: 'New Today', value: kpis.newToday, icon: Clock, color: 'text-info' },
          { label: 'Pending', value: kpis.pending, icon: Package, color: 'text-warning' },
          { label: 'Confirmed', value: kpis.confirmed, icon: CheckCircle, color: 'text-success' },
          { label: 'Cancelled', value: kpis.cancelled, icon: XCircle, color: 'text-danger' },
        ].map((kpi) => (
          <div key={kpi.label} className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <kpi.icon className={cn('w-4 h-4', kpi.color)} />
              <span className="text-[11px] text-text-muted uppercase tracking-wider">{kpi.label}</span>
            </div>
            <p className="text-2xl font-bold text-text-primary">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Revenue Card */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <DollarSign className="w-4 h-4 text-gold" />
          <span className="text-[11px] text-text-muted uppercase tracking-wider">Total Revenue</span>
        </div>
        <p className="text-2xl font-bold text-gold">{formatDZD(kpis.totalRevenue)}</p>
      </div>

      {/* Search + Filters */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-3">
          <form onSubmit={handleSearch} className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by Order ID, Customer, Phone, Product, Wilaya..."
              className="input-field w-full pl-10 py-2.5 text-sm"
            />
          </form>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'btn-secondary px-4 py-2.5 text-xs flex items-center gap-2 cursor-pointer',
              showFilters && 'border-gold/30 text-gold'
            )}
          >
            <Filter className="w-3.5 h-3.5" />
            Filters
            <ChevronDown className={cn('w-3 h-3 transition-transform', showFilters && 'rotate-180')} />
          </button>
          <select
            value={sort}
            onChange={e => { setSort(e.target.value); setPage(1) }}
            className="text-xs px-3 py-2.5 rounded-xl bg-surface border border-border text-text-primary cursor-pointer"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="amount_desc">Highest Amount</option>
            <option value="amount_asc">Lowest Amount</option>
            <option value="customer">Customer Name</option>
          </select>
        </div>

        {/* Filter Row */}
        {showFilters && (
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border">
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
              className="text-xs px-3 py-2 rounded-lg bg-surface border border-border text-text-primary cursor-pointer"
            >
              <option value="">All Status</option>
              <option value="open">Open</option>
              <option value="confirmed">Confirmed</option>
              <option value="cancelled">Cancelled</option>
              <option value="completed">Completed</option>
            </select>
            <select
              value={paymentFilter}
              onChange={e => { setPaymentFilter(e.target.value); setPage(1) }}
              className="text-xs px-3 py-2 rounded-lg bg-surface border border-border text-text-primary cursor-pointer"
            >
              <option value="">All Payment</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
            <select
              value={shippingFilter}
              onChange={e => { setShippingFilter(e.target.value); setPage(1) }}
              className="text-xs px-3 py-2 rounded-lg bg-surface border border-border text-text-primary cursor-pointer"
            >
              <option value="">All Shipping</option>
              <option value="unfulfilled">Unfulfilled</option>
              <option value="fulfilled">Fulfilled</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
            </select>
            <select
              value={deliveryFilter}
              onChange={e => { setDeliveryFilter(e.target.value); setPage(1) }}
              className="text-xs px-3 py-2 rounded-lg bg-surface border border-border text-text-primary cursor-pointer"
            >
              <option value="">All Delivery</option>
              <option value="domicile">Domicile</option>
              <option value="bureau">Bureau (Stop Desk)</option>
            </select>
            {(statusFilter || paymentFilter || shippingFilter || deliveryFilter) && (
              <button
                onClick={() => { setStatusFilter(''); setPaymentFilter(''); setShippingFilter(''); setDeliveryFilter(''); setPage(1) }}
                className="text-xs text-danger hover:text-danger/80 cursor-pointer"
              >
                Clear All
              </button>
            )}
          </div>
        )}
      </div>

      {/* Orders Table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gold" />
            <span className="ml-2 text-sm text-text-muted">Loading orders...</span>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ShoppingBag className="w-12 h-12 text-text-muted/30 mb-3" />
            <p className="text-sm text-text-muted">No orders found</p>
            <p className="text-xs text-text-muted/60 mt-1">
              {youcanConnection.status === 'CONNECTED' ? 'Try syncing or adjusting your filters' : 'Connect your YouCan store to see orders'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-center px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === orders.length && orders.length > 0}
                      onChange={toggleSelectAll}
                      className="w-3.5 h-3.5 rounded border-border bg-transparent text-gold accent-gold cursor-pointer"
                    />
                  </th>
                  <th className="text-left text-[10px] uppercase tracking-wider text-text-muted font-medium px-4 py-3">Order</th>
                  <th className="text-left text-[10px] uppercase tracking-wider text-text-muted font-medium px-4 py-3">Customer</th>
                  <th className="text-left text-[10px] uppercase tracking-wider text-text-muted font-medium px-4 py-3">Product</th>
                  <th className="text-left text-[10px] uppercase tracking-wider text-text-muted font-medium px-4 py-3">Wilaya</th>
                  <th className="text-left text-[10px] uppercase tracking-wider text-text-muted font-medium px-4 py-3">Delivery</th>
                  <th className="text-right text-[10px] uppercase tracking-wider text-text-muted font-medium px-4 py-3">Fee</th>
                  <th className="text-right text-[10px] uppercase tracking-wider text-text-muted font-medium px-4 py-3">Amount</th>
                  <th className="text-right text-[10px] uppercase tracking-wider text-text-muted font-medium px-4 py-3">To Collect</th>
                  <th className="text-center text-[10px] uppercase tracking-wider text-text-muted font-medium px-4 py-3">Payment</th>
                  <th className="text-center text-[10px] uppercase tracking-wider text-text-muted font-medium px-4 py-3">Shipping</th>
                  <th className="text-center text-[10px] uppercase tracking-wider text-text-muted font-medium px-4 py-3">Status</th>
                  <th className="text-left text-[10px] uppercase tracking-wider text-text-muted font-medium px-4 py-3">Date</th>
                  <th className="text-center text-[10px] uppercase tracking-wider text-text-muted font-medium px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => (
                  <tr
                    key={order.id}
                    className={cn(
                      'border-b border-border/50 hover:bg-white/[0.02] transition-colors cursor-pointer',
                      selectedIds.has(order.externalOrderId) && 'bg-gold/[0.03]'
                    )}
                    onClick={() => setSelectedOrder(order)}
                  >
                    <td className="px-3 py-3 text-center" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(order.externalOrderId)}
                        onChange={() => toggleSelect(order.externalOrderId)}
                        className="w-3.5 h-3.5 rounded border-border bg-transparent text-gold accent-gold cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-gold">#{order.orderRef || order.externalOrderId?.slice(0, 8)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        {order.customerName ? (
                          <>
                            <p className="text-xs font-medium">{order.customerName}</p>
                            {order.customerPhone && (
                              <p className="text-[10px] text-text-muted flex items-center gap-1 mt-0.5">
                                <Phone className="w-2.5 h-2.5" />
                                {order.customerPhone}
                              </p>
                            )}
                          </>
                        ) : order.customerPhone ? (
                          <p className="text-xs font-medium flex items-center gap-1">
                            <Phone className="w-3 h-3 text-text-muted" />
                            {order.customerPhone}
                          </p>
                        ) : (
                          <p className="text-xs text-text-muted">—</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-[160px]">
                        {order.orderItems?.slice(0, 2).map((item, i) => (
                          <p key={i} className="text-xs text-text-secondary truncate">
                            {item.productName} {item.qty > 1 && <span className="text-text-muted">×{item.qty}</span>}
                          </p>
                        ))}
                        {(order.orderItems?.length || 0) > 2 && (
                          <p className="text-[10px] text-text-muted">+{(order.orderItems?.length || 0) - 2} more</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-xs">{order.wilaya || '—'}</p>
                        {order.wilayaCode && <p className="text-[10px] text-text-muted">({order.wilayaCode})</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {order.shippingMethod === 'bureau' ? (
                          <span className="badge badge-info text-[9px]">
                            <Truck className="w-2.5 h-2.5 inline mr-0.5" />
                            Bureau
                          </span>
                        ) : (
                          <span className="badge badge-success text-[9px]">
                            <Truck className="w-2.5 h-2.5 inline mr-0.5" />
                            Domicile
                          </span>
                        )}
                        {order.stopdeskCode && (
                          <span className="text-[10px] text-text-muted">{order.stopdeskCode}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-xs text-text-secondary">
                        {order.deliveryFee > 0 ? formatDZD(order.deliveryFee) : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-xs font-semibold text-gold">{formatDZD(order.total)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-xs font-semibold text-success">{formatDZD(order.totalToCollect || order.total + order.deliveryFee)}</span>
                    </td>
                    <td className="px-4 py-3 text-center">{statusBadge(order.paymentStatus)}</td>
                    <td className="px-4 py-3 text-center">{statusBadge(order.shippingStatus)}</td>
                    <td className="px-4 py-3 text-center">{statusBadge(order.orderStatus)}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] text-text-muted">
                        {order.youcanCreatedAt ? new Date(order.youcanCreatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                          title="View details"
                        >
                          <Eye className="w-3.5 h-3.5 text-text-muted" />
                        </button>
                        <button
                          onClick={() => {
                            setPushTarget(order)
                            setPushPreview(buildPushPreview(order))
                            setPushError(null)
                            setPushSuccess(null)
                          }}
                          className={cn(
                            'p-1.5 rounded-lg transition-colors cursor-pointer',
                            order.ecomPushStatus === 'sent'
                              ? 'text-success hover:bg-success/10'
                              : order.ecomPushStatus === 'failed'
                                ? 'text-warning hover:bg-warning/10'
                                : 'text-info hover:bg-info/10'
                          )}
                          title={order.ecomPushStatus === 'sent' ? 'Already sent — Push Again' : order.ecomPushStatus === 'failed' ? 'Failed — Retry' : 'Push to Ecom Delivery'}
                        >
                          {order.ecomPushStatus === 'sent' ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => setDeleteTarget(order)}
                          className="p-1.5 rounded-lg hover:bg-danger/10 transition-colors cursor-pointer"
                          title="Delete order"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-danger/60 hover:text-danger" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-[11px] text-text-muted">
              Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-text-muted">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Order Details Drawer */}
      {selectedOrder && (
        <OrderDetailsDrawer
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          formatDZD={formatDZD}
          statusBadge={statusBadge}
        />
      )}

      {/* Ecom Delivery Export Modal */}
      {showExportModal && exportData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowExportModal(false)}>
          <div
            className="glass-card w-full max-w-6xl max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-5 h-5 text-gold" />
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Ecom Delivery Export</h3>
                  <p className="text-[11px] text-text-muted">{exportData.rows.length} orders — 13 columns</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={downloadCSV}
                  className="btn-primary px-4 py-2 text-xs flex items-center gap-2"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download TSV
                </button>
                <button onClick={() => setShowExportModal(false)} className="p-2 rounded-lg hover:bg-white/5">
                  <XCircle className="w-4 h-4 text-text-muted" />
                </button>
              </div>
            </div>

            {/* Validation Errors */}
            {exportData.errors.length > 0 && (
              <div className="px-6 py-3 bg-warning/5 border-b border-warning/20">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-warning" />
                  <span className="text-xs font-medium text-warning">{exportData.errors.length} order(s) with missing data</span>
                </div>
                <div className="flex flex-wrap gap-2 mt-1">
                  {exportData.errors.map((err, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-warning/10 text-warning border border-warning/20">
                      #{err.orderId.slice(0, 8)} — missing: {err.missing.join(', ')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Preview Table */}
            <div className="flex-1 overflow-auto px-6 py-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    {ECOM_COLUMNS.map(col => (
                      <th key={col} className="text-left text-[9px] uppercase tracking-wider text-text-muted font-medium px-2 py-2 whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {exportData.rows.map((row, i) => (
                    <tr key={i} className="border-b border-border/30 hover:bg-white/[0.02]">
                      {ECOM_COLUMNS.map(col => (
                        <td key={col} className="px-2 py-1.5 text-text-secondary max-w-[140px] truncate" title={row[col] || ''}>
                          {row[col] || <span className="text-text-muted/40">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-border flex items-center justify-between">
              <span className="text-[11px] text-text-muted">
                Ready to export {exportData.rows.length} order(s) to Ecom Delivery
              </span>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowExportModal(false)} className="btn-secondary px-4 py-2 text-xs">
                  Cancel
                </button>
                <button onClick={downloadCSV} className="btn-primary px-4 py-2 text-xs flex items-center gap-2">
                  <Download className="w-3.5 h-3.5" />
                  Download
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete Confirmation Dialog ────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="glass-card w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-danger/10 flex items-center justify-center">
                  <AlertOctagon className="w-5 h-5 text-danger" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Delete this order?</h3>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Order #{deleteTarget.orderRef || deleteTarget.externalOrderId?.slice(0, 8)}
                  </p>
                </div>
              </div>
            </div>
            <div className="px-6 py-4">
              <p className="text-xs text-text-secondary">
                This action will remove the order from FOXBOX TEAM.
              </p>
              <p className="text-[11px] text-text-muted mt-2">
                The YouCan order itself will NOT be affected.
              </p>
            </div>
            <div className="px-6 py-3 border-t border-border flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="btn-secondary px-4 py-2 text-xs cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-xs font-medium rounded-xl bg-danger text-white hover:bg-danger/90 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Push to Ecom Delivery Preview Dialog ──────────── */}
      {pushTarget && pushPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => { if (!pushing) { setPushTarget(null); setPushPreview(null); setPushError(null); setPushSuccess(null); } }}>
          <div className="glass-card w-full max-w-md" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="px-6 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center">
                  <Send className="w-5 h-5 text-info" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">
                    {pushSuccess ? 'Sent Successfully' : pushError ? 'Push Failed' : 'Push Order to Ecom Delivery'}
                  </h3>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    #{pushTarget.orderRef || pushTarget.externalOrderId?.slice(0, 8)}
                  </p>
                </div>
              </div>
            </div>

            {/* Success State */}
            {pushSuccess && (
              <div className="px-6 py-4">
                <div className="flex items-center gap-2 p-3 rounded-xl bg-success/10 border border-success/20">
                  <Check className="w-4 h-4 text-success" />
                  <div>
                    <p className="text-xs font-medium text-success">Order sent to Ecom Delivery</p>
                    {pushSuccess.tracking && (
                      <p className="text-[10px] text-text-muted mt-0.5">Tracking: {pushSuccess.tracking}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Error State */}
            {pushError && (
              <div className="px-6 py-4">
                <div className="flex items-center gap-2 p-3 rounded-xl bg-danger/10 border border-danger/20">
                  <AlertOctagon className="w-4 h-4 text-danger" />
                  <div>
                    <p className="text-xs font-medium text-danger">Push failed</p>
                    <p className="text-[10px] text-text-muted mt-0.5">{pushError}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Preview Content (before success) */}
            {!pushSuccess && !pushError && (
              <div className="px-6 py-4 space-y-3">
                {[
                  ['Customer', pushPreview['Nom Complet']],
                  ['Phone', pushPreview['Téléphone']],
                  ['Article', pushPreview['Article']],
                  ['Quantity', pushPreview['Quantité']],
                  ['Wilaya', pushPreview['Wilaya']],
                  ['Commune', pushPreview['Commune']],
                  ['Delivery', pushPreview['Shipping']],
                  ['Delivery Fee', pushPreview['Delivery Fee']],
                  ['Total à ramasser', pushPreview['Total à ramasser']],
                  ['Stopdesk Code', pushPreview['Stopdesk Code'] || '—'],
                  ['Note', pushPreview['Note'] || '—'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between text-xs">
                    <span className="text-text-muted">{label}</span>
                    <span className="text-text-secondary font-medium text-right max-w-[60%] truncate">{value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Footer */}
            <div className="px-6 py-3 border-t border-border flex items-center justify-end gap-2">
              <button
                onClick={() => { setPushTarget(null); setPushPreview(null); setPushError(null); setPushSuccess(null); }}
                disabled={pushing}
                className="btn-secondary px-4 py-2 text-xs cursor-pointer disabled:opacity-50"
              >
                {pushSuccess ? 'Close' : 'Cancel'}
              </button>
              {!pushSuccess && (
                <button
                  onClick={handlePush}
                  disabled={pushing}
                  className="px-4 py-2 text-xs font-medium rounded-xl bg-info text-white hover:bg-info/90 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {pushing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  {pushing ? 'Pushing...' : 'Push to Ecom Delivery'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Bulk Operations Progress Modal ────────────────── */}
      {showBulkModal && bulkProgress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => { if (bulkMode === 'idle') setShowBulkModal(false) }}>
          <div className="glass-card w-full max-w-lg" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="px-6 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center',
                  bulkMode === 'deleting' ? 'bg-danger/10' : 'bg-info/10'
                )}>
                  {bulkMode === 'idle' ? (
                    <Check className="w-5 h-5 text-success" />
                  ) : bulkMode === 'deleting' ? (
                    <Trash2 className="w-5 h-5 text-danger" />
                  ) : (
                    <Send className="w-5 h-5 text-info" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">
                    {bulkMode === 'idle'
                      ? (bulkProgress.sent > 0 ? 'Operation Complete' : 'Operation Failed')
                      : bulkMode === 'deleting' ? 'Deleting Orders...' : 'Pushing to Ecom Delivery...'}
                  </h3>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    {bulkProgress.current} / {bulkProgress.total} processed
                  </p>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="px-6 py-4">
              <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    bulkMode === 'idle'
                      ? (bulkProgress.failed > 0 ? 'bg-warning' : 'bg-success')
                      : bulkMode === 'deleting' ? 'bg-danger' : 'bg-info'
                  )}
                  style={{ width: `${bulkProgress.total > 0 ? (bulkProgress.current / bulkProgress.total) * 100 : 0}%` }}
                />
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 mt-4">
                {bulkProgress.sent > 0 && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-success" />
                    <span className="text-xs text-text-secondary">{bulkProgress.sent} sent</span>
                  </div>
                )}
                {bulkProgress.failed > 0 && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-danger" />
                    <span className="text-xs text-text-secondary">{bulkProgress.failed} failed</span>
                  </div>
                )}
                {bulkProgress.skipped > 0 && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-warning" />
                    <span className="text-xs text-text-secondary">{bulkProgress.skipped} skipped</span>
                  </div>
                )}
              </div>

              {/* Results List */}
              {bulkProgress.results.length > 0 && (
                <div className="mt-4 max-h-48 overflow-y-auto space-y-1">
                  {bulkProgress.results.map((r, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-white/[0.02] text-xs">
                      <span className="text-text-muted font-mono">#{r.externalOrderId?.slice(0, 8)}</span>
                      <div className="flex items-center gap-2">
                        {r.tracking && <span className="text-text-muted">({r.tracking})</span>}
                        {r.error && <span className="text-danger truncate max-w-[200px]" title={r.error}>{r.error}</span>}
                        <span className={cn(
                          'font-medium',
                          r.status === 'sent' || r.status === 'deleted' ? 'text-success' :
                          r.status === 'skipped' ? 'text-warning' : 'text-danger'
                        )}>
                          {r.status === 'sent' ? '✓ Sent' : r.status === 'deleted' ? '✓ Deleted' : r.status === 'skipped' ? '⊘ Skipped' : '✗ Failed'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-border flex items-center justify-end">
              <button
                onClick={() => setShowBulkModal(false)}
                disabled={bulkMode !== 'idle'}
                className="btn-secondary px-4 py-2 text-xs cursor-pointer disabled:opacity-50"
              >
                {bulkMode !== 'idle' ? 'Processing...' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Order Details Drawer ───────────────────────────────────

function OrderDetailsDrawer({
  order, onClose, formatDZD, statusBadge
}: {
  order: YouCanOrder
  onClose: () => void
  formatDZD: (n: number) => string
  statusBadge: (s: string) => React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-surface border-l border-border overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-surface/95 backdrop-blur-md border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <span className="text-gold font-mono">#{order.orderRef || order.externalOrderId?.slice(0, 8)}</span>
                <span className="badge text-[9px] bg-white/5 text-text-muted border-border">YouCan</span>
              </h3>
              <p className="text-[11px] text-text-muted mt-0.5">
                Created {order.youcanCreatedAt ? new Date(order.youcanCreatedAt).toLocaleString('en-GB') : '—'}
              </p>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 cursor-pointer">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-6 py-4 space-y-5">
          {/* Customer */}
          <section>
            <h4 className="text-[11px] uppercase tracking-wider text-text-muted font-semibold mb-2">Customer</h4>
            <div className="space-y-1.5">
              {order.customerName ? (
                <p className="text-sm font-medium">{order.customerName}</p>
              ) : order.customerPhone ? (
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-text-muted" />
                  {order.customerPhone}
                </p>
              ) : (
                <p className="text-sm text-text-muted">—</p>
              )}
              {order.customerPhone && order.customerName && (
                <p className="text-xs text-text-secondary flex items-center gap-1.5">
                  <Phone className="w-3 h-3 text-text-muted" />
                  {order.customerPhone}
                </p>
              )}
            </div>
          </section>

          {/* Delivery */}
          <section>
            <h4 className="text-[11px] uppercase tracking-wider text-text-muted font-semibold mb-2">Delivery</h4>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <MapPin className="w-3 h-3 text-text-muted" />
                <span className="text-xs">
                  {order.wilaya}{order.wilayaCode ? ` (${order.wilayaCode})` : ''}
                  {order.baladiya ? `, ${order.baladiya}` : ''}
                </span>
              </div>
              {order.address && (
                <p className="text-xs text-text-secondary ml-5">{order.address}</p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <Truck className="w-3 h-3 text-text-muted" />
                <span className="text-xs">
                  {order.shippingMethod === 'bureau' ? 'Bureau (Stop Desk)' : 'Domicile'}
                </span>
              </div>
              {order.shippingMethod === 'bureau' && order.officeCode && (
                <div className="ml-5 mt-1 p-2 rounded-lg bg-white/[0.02] border border-border">
                  <p className="text-xs font-medium">{order.officeCode}</p>
                  {order.officeName && <p className="text-[10px] text-text-muted">{order.officeName}</p>}
                </div>
              )}
            </div>
          </section>

          {/* Products */}
          <section>
            <h4 className="text-[11px] uppercase tracking-wider text-text-muted font-semibold mb-2">Products</h4>
            <div className="space-y-2">
              {order.orderItems?.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-border">
                  <div>
                    <p className="text-xs font-medium">{item.productName}</p>
                    {item.variant && <p className="text-[10px] text-text-muted">{typeof item.variant === 'object' ? Object.values(item.variant as Record<string, string>).join(' / ') : item.variant}</p>}
                    {item.sku && <p className="text-[10px] text-text-muted">SKU: {item.sku}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium">{formatDZD(item.totalPrice)}</p>
                    <p className="text-[10px] text-text-muted">×{item.qty} @ {formatDZD(item.unitPrice)}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Financial */}
          <section>
            <h4 className="text-[11px] uppercase tracking-wider text-text-muted font-semibold mb-2">Financial</h4>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Subtotal</span>
                <span>{formatDZD(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Delivery Fee ({order.shippingMethod === 'bureau' ? 'Bureau' : 'Domicile'})</span>
                <span>{order.deliveryFee > 0 ? formatDZD(order.deliveryFee) : '—'}</span>
              </div>
              <div className="flex justify-between text-xs font-semibold pt-1.5 border-t border-border">
                <span className="text-text-primary">Total</span>
                <span className="text-gold">{formatDZD(order.total)}</span>
              </div>
              <div className="flex justify-between text-xs font-semibold pt-1.5 border-t border-success/20">
                <span className="text-text-primary">Total à ramasser</span>
                <span className="text-success">{formatDZD(order.totalToCollect || order.total + order.deliveryFee)}</span>
              </div>
            </div>
          </section>

          {/* Note */}
          {order.note && (
            <section>
              <h4 className="text-[11px] uppercase tracking-wider text-text-muted font-semibold mb-2">Note</h4>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-border">
                <p className="text-xs text-text-secondary flex items-start gap-2">
                  <MessageSquare className="w-3 h-3 text-text-muted mt-0.5 flex-shrink-0" />
                  {order.note}
                </p>
              </div>
            </section>
          )}

          {/* Status */}
          <section>
            <h4 className="text-[11px] uppercase tracking-wider text-text-muted font-semibold mb-2">Status</h4>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center">
                <p className="text-[10px] text-text-muted mb-1">Order</p>
                {statusBadge(order.orderStatus)}
              </div>
              <div className="text-center">
                <p className="text-[10px] text-text-muted mb-1">Payment</p>
                {statusBadge(order.paymentStatus)}
              </div>
              <div className="text-center">
                <p className="text-[10px] text-text-muted mb-1">Shipping</p>
                {statusBadge(order.shippingStatus)}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
