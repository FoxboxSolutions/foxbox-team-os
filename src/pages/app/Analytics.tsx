import { useState, useMemo } from 'react'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Target,
  Package,
  MapPin,
  DollarSign,
  CheckCircle,
  Clock,
  Truck,
  RotateCcw,
  XCircle,
  Download,
  Eye,
  Zap,
} from 'lucide-react'
import { useAppState } from '@/stores/AppState'
import { cn } from '@/lib/utils'

const DATE_RANGES = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: 'All', days: Infinity },
] as const

type DateRange = (typeof DATE_RANGES)[number]['days']

const ORDER_STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  NEW: { label: 'New', color: 'text-info', bgColor: 'bg-info/12', icon: Zap },
  PENDING_CONFIRMATION: { label: 'Pending', color: 'text-warning', bgColor: 'bg-warning/12', icon: Clock },
  CONFIRMED: { label: 'Confirmed', color: 'text-success', bgColor: 'bg-success/12', icon: CheckCircle },
  CANCELLED: { label: 'Cancelled', color: 'text-danger', bgColor: 'bg-danger/12', icon: XCircle },
  PREPARING: { label: 'Preparing', color: 'text-purple', bgColor: 'bg-purple/12', icon: Package },
  SHIPPED: { label: 'Shipped', color: 'text-blue', bgColor: 'bg-blue/12', icon: Truck },
  IN_TRANSIT: { label: 'In Transit', color: 'text-orange', bgColor: 'bg-orange/12', icon: Truck },
  OUT_FOR_DELIVERY: { label: 'Out for Delivery', color: 'text-gold', bgColor: 'bg-gold/12', icon: MapPin },
  DELIVERED: { label: 'Delivered', color: 'text-success', bgColor: 'bg-success/12', icon: CheckCircle },
  RETURNED: { label: 'Returned', color: 'text-danger', bgColor: 'bg-danger/12', icon: RotateCcw },
}

const PLATFORM_BADGES: Record<string, string> = {
  META: 'text-blue bg-blue/10 border-blue/20',
  TIKTOK: 'text-text-primary bg-white/10 border-white/20',
  OTHER: 'text-text-muted bg-white/5 border-white/10',
}

const fmt = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toFixed(0)
}

export function Analytics() {
  const { orders, products, creatives, expenses, revenues } = useAppState()
  const [dateRange, setDateRange] = useState<DateRange>(Infinity)

  const now = useMemo(() => new Date(), [])

  const filteredOrders = useMemo(() => {
    if (dateRange === Infinity) return orders
    const cutoff = new Date(now.getTime() - dateRange * 24 * 60 * 60 * 1000)
    return orders.filter(o => new Date(o.createdAt) >= cutoff)
  }, [orders, dateRange, now])

  const filteredExpenses = useMemo(() => {
    if (dateRange === Infinity) return expenses
    const cutoff = new Date(now.getTime() - dateRange * 24 * 60 * 60 * 1000)
    return expenses.filter(e => new Date(e.createdAt) >= cutoff)
  }, [expenses, dateRange, now])

  const filteredRevenues = useMemo(() => {
    if (dateRange === Infinity) return revenues
    const cutoff = new Date(now.getTime() - dateRange * 24 * 60 * 60 * 1000)
    return revenues.filter(r => new Date(r.createdAt) >= cutoff)
  }, [revenues, dateRange, now])

  const totalOrders = filteredOrders.length
  const confirmedOrders = filteredOrders.filter(o => o.confirmationStatus === 'CONFIRMED').length
  const deliveredOrders = filteredOrders.filter(o => o.status === 'DELIVERED')
  const returnedOrders = filteredOrders.filter(o => o.status === 'RETURNED')
  const cancelledOrders = filteredOrders.filter(o => o.status === 'CANCELLED')
  const pendingOrders = filteredOrders.filter(o =>
    ['NEW', 'PENDING_CONFIRMATION', 'PREPARING', 'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(o.status)
  )

  const totalRevenue = useMemo(() => {
    const orderRevenue = deliveredOrders.reduce((sum, o) => sum + o.sellingPriceDzd, 0)
    const extraRevenue = filteredRevenues.reduce((sum, r) => sum + r.amountDzd, 0)
    return orderRevenue + extraRevenue
  }, [deliveredOrders, filteredRevenues])

  const totalExpenses = useMemo(
    () => filteredExpenses.reduce((sum, e) => sum + e.amountDzd, 0),
    [filteredExpenses],
  )

  const totalProfit = totalRevenue - totalExpenses
  const confirmationRate = totalOrders > 0 ? (confirmedOrders / totalOrders) * 100 : 0
  const deliveryRate = confirmedOrders > 0 ? (deliveredOrders.length / confirmedOrders) * 100 : 0
  const returnRate = deliveredOrders.length > 0 ? (returnedOrders.length / deliveredOrders.length) * 100 : 0
  const avgOrderValue = deliveredOrders.length > 0 ? totalRevenue / deliveredOrders.length : 0

  const statusBreakdown = useMemo(() => {
    const map: Record<string, number> = {}
    filteredOrders.forEach(o => {
      map[o.status] = (map[o.status] || 0) + 1
    })
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
  }, [filteredOrders])

  const productPerformance = useMemo(() => {
    const map: Record<string, {
      id: string
      name: string
      orders: number
      revenue: number
      expenses: number
      profit: number
      margin: number
    }> = {}

    filteredOrders.forEach(o => {
      const pid = o.productId
      if (!map[pid]) {
        const product = products.find(p => p.id === pid)
        map[pid] = { id: pid, name: product?.name || 'Unknown', orders: 0, revenue: 0, expenses: 0, profit: 0, margin: 0 }
      }
      map[pid].orders++
      map[pid].revenue += o.sellingPriceDzd
    })

    filteredExpenses.forEach(e => {
      if (e.productId && map[e.productId]) {
        map[e.productId].expenses += e.amountDzd
      }
    })

    Object.values(map).forEach(p => {
      p.profit = p.revenue - p.expenses
      p.margin = p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0
    })

    return Object.values(map).sort((a, b) => b.revenue - a.revenue)
  }, [filteredOrders, filteredExpenses, products])

  const creativePerformance = useMemo(() => {
    return creatives
      .filter(c => c.performance)
      .map(c => ({
        id: c.id,
        name: c.name,
        product: products.find(p => p.id === c.productId)?.name || 'Unknown',
        platform: c.platform,
        impressions: c.performance!.impressions,
        clicks: c.performance!.clicks,
        ctr: c.performance!.ctr,
        cpc: c.performance!.cpc,
        cpa: c.performance!.cpa,
        roas: c.performance!.roas,
        orders: c.performance!.orders,
        revenue: c.performance!.revenue,
      }))
      .sort((a, b) => b.roas - a.roas)
  }, [creatives, products])

  const wilayaPerformance = useMemo(() => {
    const map: Record<string, {
      name: string
      total: number
      delivered: number
      returned: number
      cancelled: number
      deliveryRate: number
      returnRate: number
      revenue: number
    }> = {}

    filteredOrders.forEach(o => {
      const w = o.customer.wilaya || 'Unknown'
      if (!map[w]) {
        map[w] = { name: w, total: 0, delivered: 0, returned: 0, cancelled: 0, deliveryRate: 0, returnRate: 0, revenue: 0 }
      }
      map[w].total++
      if (o.status === 'DELIVERED') {
        map[w].delivered++
        map[w].revenue += o.sellingPriceDzd
      }
      if (o.status === 'RETURNED') map[w].returned++
      if (o.status === 'CANCELLED') map[w].cancelled++
    })

    Object.values(map).forEach(w => {
      const effectiveOrders = w.total - w.cancelled
      w.deliveryRate = effectiveOrders > 0 ? (w.delivered / effectiveOrders) * 100 : 0
      w.returnRate = w.delivered > 0 ? (w.returned / w.delivered) * 100 : 0
    })

    return Object.values(map).sort((a, b) => b.revenue - a.revenue)
  }, [filteredOrders])

  const hasData = totalOrders > 0 || filteredExpenses.length > 0

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Analytics Dashboard</h1>
          <p className="text-sm text-text-muted mt-1">
            Performance insights across your operation.
            {dateRange !== Infinity && (
              <span className="text-gold ml-1">
                Last {dateRange} days
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white/[0.03] rounded-lg p-0.5 border border-border">
            {DATE_RANGES.map(dr => (
              <button
                key={dr.days}
                onClick={() => setDateRange(dr.days)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                  dateRange === dr.days
                    ? 'bg-gold/20 text-gold border border-gold/30'
                    : 'text-text-muted hover:text-text-secondary',
                )}
              >
                {dr.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="kpi-card">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-lg bg-info/10 flex items-center justify-center">
              <ShoppingCart className="w-4 h-4 text-info" />
            </div>
          </div>
          <p className="text-xl font-bold text-text-primary">{totalOrders}</p>
          <p className="text-[10px] text-text-muted mt-0.5">Total Orders</p>
        </div>
        <div className="kpi-card">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-gold" />
            </div>
          </div>
          <p className="text-xl font-bold text-gold">{fmt(totalRevenue)} DA</p>
          <p className="text-[10px] text-text-muted mt-0.5">Revenue</p>
        </div>
        <div className="kpi-card">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-success" />
            </div>
          </div>
          <p className="text-xl font-bold text-success">{confirmedOrders}</p>
          <p className="text-[10px] text-text-muted mt-0.5">Confirmed</p>
        </div>
        <div className="kpi-card">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
              <Target className="w-4 h-4 text-success" />
            </div>
          </div>
          <p className="text-xl font-bold text-success">{confirmationRate.toFixed(1)}%</p>
          <p className="text-[10px] text-text-muted mt-0.5">Confirmation Rate</p>
        </div>
        <div className="kpi-card">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue/10 flex items-center justify-center">
              <Truck className="w-4 h-4 text-blue" />
            </div>
          </div>
          <p className={cn('text-xl font-bold', deliveryRate >= 70 ? 'text-success' : 'text-warning')}>
            {deliveryRate.toFixed(1)}%
          </p>
          <p className="text-[10px] text-text-muted mt-0.5">Delivery Rate</p>
        </div>
        <div className="kpi-card">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-lg bg-danger/10 flex items-center justify-center">
              <RotateCcw className="w-4 h-4 text-danger" />
            </div>
          </div>
          <p className={cn('text-xl font-bold', returnRate <= 15 ? 'text-success' : 'text-danger')}>
            {returnRate.toFixed(1)}%
          </p>
          <p className="text-[10px] text-text-muted mt-0.5">Return Rate</p>
        </div>
        <div className="kpi-card">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-lg bg-purple/10 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-purple" />
            </div>
          </div>
          <p className="text-xl font-bold text-text-primary">{fmt(avgOrderValue)} DA</p>
          <p className="text-[10px] text-text-muted mt-0.5">Avg Order Value</p>
        </div>
        <div className="kpi-card">
          <div className="flex items-center justify-between mb-2">
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', totalProfit >= 0 ? 'bg-success/10' : 'bg-danger/10')}>
              {totalProfit >= 0
                ? <TrendingUp className="w-4 h-4 text-success" />
                : <TrendingDown className="w-4 h-4 text-danger" />
              }
            </div>
          </div>
          <p className={cn('text-xl font-bold', totalProfit >= 0 ? 'text-success' : 'text-danger')}>
            {totalProfit >= 0 ? '+' : ''}{fmt(totalProfit)} DA
          </p>
          <p className="text-[10px] text-text-muted mt-0.5">Total Profit</p>
        </div>
      </div>

      {/* Status Breakdown */}
      {hasData && (
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold mb-4 text-text-primary flex items-center gap-2">
            <Eye className="w-4 h-4 text-gold" />
            Order Status Breakdown
          </h3>
          {statusBreakdown.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-6">No orders in this period.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {statusBreakdown.map(([status, count]) => {
                const cfg = ORDER_STATUS_CONFIG[status] || { label: status, color: 'text-text-muted', bgColor: 'bg-white/5', icon: Package }
                const Icon = cfg.icon
                const pct = totalOrders > 0 ? (count / totalOrders) * 100 : 0
                return (
                  <div
                    key={status}
                    className={cn('p-3 rounded-xl border transition-all hover:scale-[1.02]', cfg.bgColor, 'border-border')}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <Icon className={cn('w-3.5 h-3.5', cfg.color)} />
                      <span className="text-xs font-medium text-text-secondary">{cfg.label}</span>
                    </div>
                    <p className={cn('text-lg font-bold', cfg.color)}>{count}</p>
                    <div className="mt-1.5 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-500', cfg.color.replace('text-', 'bg-'))}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-text-muted mt-1">{pct.toFixed(1)}% of total</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!hasData && (
        <div className="glass-card p-16 text-center">
          <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-8 h-8 text-gold opacity-60" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary mb-2">No Analytics Data Yet</h3>
          <p className="text-sm text-text-muted max-w-md mx-auto">
            Start creating orders, tracking expenses, and managing creatives to see your analytics dashboard come to life.
          </p>
        </div>
      )}

      {/* Product Performance Table */}
      {productPerformance.length > 0 && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Package className="w-4 h-4 text-gold" />
              Product Performance
              <span className="text-xs text-text-muted font-normal">Ranked by Revenue</span>
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Product</th>
                  <th className="text-right">Orders</th>
                  <th className="text-right">Revenue</th>
                  <th className="text-right">Expenses</th>
                  <th className="text-right">Profit</th>
                  <th className="text-right">Margin</th>
                </tr>
              </thead>
              <tbody>
                {productPerformance.map((p, i) => (
                  <tr key={p.id}>
                    <td>
                      <span className={cn(
                        'text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center',
                        i === 0 ? 'bg-gold/15 text-gold' : i === 1 ? 'bg-white/10 text-text-secondary' : 'bg-white/5 text-text-muted',
                      )}>
                        {i + 1}
                      </span>
                    </td>
                    <td>
                      <span className="font-medium text-text-primary text-sm">{p.name}</span>
                    </td>
                    <td className="text-right">
                      <span className="text-sm text-text-secondary">{p.orders}</span>
                    </td>
                    <td className="text-right">
                      <span className="text-sm font-medium text-gold">{fmt(p.revenue)} DA</span>
                    </td>
                    <td className="text-right">
                      <span className="text-sm text-danger">{fmt(p.expenses)} DA</span>
                    </td>
                    <td className="text-right">
                      <span className={cn('text-sm font-bold', p.profit >= 0 ? 'text-success' : 'text-danger')}>
                        {p.profit >= 0 ? '+' : ''}{fmt(p.profit)} DA
                      </span>
                    </td>
                    <td className="text-right">
                      <span className={cn(
                        'text-xs font-medium px-2 py-0.5 rounded-full',
                        p.margin >= 20 ? 'bg-success/10 text-success' : p.margin >= 0 ? 'bg-gold/10 text-gold' : 'bg-danger/10 text-danger',
                      )}>
                        {p.margin.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Creative Performance Table */}
      {creativePerformance.length > 0 && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Zap className="w-4 h-4 text-gold" />
              Creative Performance
              <span className="text-xs text-text-muted font-normal">Ranked by ROAS</span>
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Creative</th>
                  <th>Product</th>
                  <th>Platform</th>
                  <th className="text-right">Impressions</th>
                  <th className="text-right">Clicks</th>
                  <th className="text-right">CTR</th>
                  <th className="text-right">CPC</th>
                  <th className="text-right">CPA</th>
                  <th className="text-right">ROAS</th>
                  <th className="text-right">Orders</th>
                  <th className="text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {creativePerformance.map((c, i) => (
                  <tr key={c.id}>
                    <td>
                      <span className={cn(
                        'text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center',
                        i === 0 ? 'bg-gold/15 text-gold' : i === 1 ? 'bg-white/10 text-text-secondary' : 'bg-white/5 text-text-muted',
                      )}>
                        {i + 1}
                      </span>
                    </td>
                    <td>
                      <span className="font-medium text-text-primary text-sm">{c.name}</span>
                    </td>
                    <td>
                      <span className="text-xs text-gold">{c.product}</span>
                    </td>
                    <td>
                      <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full border', PLATFORM_BADGES[c.platform] || PLATFORM_BADGES.OTHER)}>
                        {c.platform}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className="text-sm text-text-secondary">{c.impressions.toLocaleString()}</span>
                    </td>
                    <td className="text-right">
                      <span className="text-sm text-text-secondary">{c.clicks.toLocaleString()}</span>
                    </td>
                    <td className="text-right">
                      <span className="text-xs text-info">{c.ctr.toFixed(2)}%</span>
                    </td>
                    <td className="text-right">
                      <span className="text-xs text-text-secondary">{fmt(c.cpc)} DA</span>
                    </td>
                    <td className="text-right">
                      <span className="text-xs text-warning">{fmt(c.cpa)} DA</span>
                    </td>
                    <td className="text-right">
                      <span className={cn(
                        'text-sm font-bold px-2 py-0.5 rounded-full',
                        c.roas >= 3 ? 'bg-success/10 text-success' : c.roas >= 1 ? 'bg-gold/10 text-gold' : 'bg-danger/10 text-danger',
                      )}>
                        {c.roas.toFixed(2)}x
                      </span>
                    </td>
                    <td className="text-right">
                      <span className="text-sm text-text-secondary">{c.orders}</span>
                    </td>
                    <td className="text-right">
                      <span className="text-sm font-medium text-gold">{fmt(c.revenue)} DA</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Wilaya Performance Table */}
      {wilayaPerformance.length > 0 && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gold" />
              Wilaya Performance
              <span className="text-xs text-text-muted font-normal">Ranked by Revenue</span>
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Wilaya</th>
                  <th className="text-right">Total Orders</th>
                  <th className="text-right">Delivered</th>
                  <th className="text-right">Returned</th>
                  <th className="text-right">Cancelled</th>
                  <th className="text-right">Delivery Rate</th>
                  <th className="text-right">Return Rate</th>
                  <th className="text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {wilayaPerformance.map((w, i) => (
                  <tr key={w.name}>
                    <td>
                      <span className={cn(
                        'text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center',
                        i === 0 ? 'bg-gold/15 text-gold' : i === 1 ? 'bg-white/10 text-text-secondary' : 'bg-white/5 text-text-muted',
                      )}>
                        {i + 1}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-gold" />
                        <span className="font-medium text-text-primary text-sm">{w.name}</span>
                      </div>
                    </td>
                    <td className="text-right">
                      <span className="text-sm text-text-secondary">{w.total}</span>
                    </td>
                    <td className="text-right">
                      <span className="text-sm text-success">{w.delivered}</span>
                    </td>
                    <td className="text-right">
                      <span className="text-sm text-danger">{w.returned}</span>
                    </td>
                    <td className="text-right">
                      <span className="text-sm text-text-muted">{w.cancelled}</span>
                    </td>
                    <td className="text-right">
                      <span className={cn(
                        'text-sm font-medium',
                        w.deliveryRate >= 80 ? 'text-success' : w.deliveryRate >= 60 ? 'text-warning' : 'text-danger',
                      )}>
                        {w.deliveryRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="text-right">
                      <span className={cn(
                        'text-sm font-medium',
                        w.returnRate <= 10 ? 'text-success' : w.returnRate <= 20 ? 'text-warning' : 'text-danger',
                      )}>
                        {w.returnRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="text-right">
                      <span className="text-sm font-medium text-gold">{fmt(w.revenue)} DA</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Export Summary */}
      {hasData && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Download className="w-4 h-4 text-gold" />
              Period Summary
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-white/[0.02] border border-border">
              <p className="text-xs text-text-muted uppercase tracking-wider mb-2">Orders Overview</p>
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Total Orders</span>
                  <span className="font-medium text-text-primary">{totalOrders}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Confirmed</span>
                  <span className="font-medium text-success">{confirmedOrders} ({confirmationRate.toFixed(1)}%)</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Delivered</span>
                  <span className="font-medium text-success">{deliveredOrders.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Returned</span>
                  <span className="font-medium text-danger">{returnedOrders.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Cancelled</span>
                  <span className="font-medium text-text-muted">{cancelledOrders.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Pending/Active</span>
                  <span className="font-medium text-info">{pendingOrders.length}</span>
                </div>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-border">
              <p className="text-xs text-text-muted uppercase tracking-wider mb-2">Financial Summary</p>
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Total Revenue</span>
                  <span className="font-medium text-gold">{fmt(totalRevenue)} DA</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Total Expenses</span>
                  <span className="font-medium text-danger">{fmt(totalExpenses)} DA</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Net Profit</span>
                  <span className={cn('font-bold', totalProfit >= 0 ? 'text-success' : 'text-danger')}>
                    {totalProfit >= 0 ? '+' : ''}{fmt(totalProfit)} DA
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Avg Order Value</span>
                  <span className="font-medium text-text-primary">{fmt(avgOrderValue)} DA</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Profit per Order</span>
                  <span className="font-medium text-text-primary">
                    {deliveredOrders.length > 0 ? fmt(totalProfit / deliveredOrders.length) : '—'} DA
                  </span>
                </div>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-border">
              <p className="text-xs text-text-muted uppercase tracking-wider mb-2">Performance Metrics</p>
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Confirmation Rate</span>
                  <span className="font-medium text-success">{confirmationRate.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Delivery Rate</span>
                  <span className={cn('font-medium', deliveryRate >= 70 ? 'text-success' : 'text-warning')}>
                    {deliveryRate.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Return Rate</span>
                  <span className={cn('font-medium', returnRate <= 15 ? 'text-success' : 'text-danger')}>
                    {returnRate.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Unique Products</span>
                  <span className="font-medium text-text-primary">{productPerformance.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Active Creatives</span>
                  <span className="font-medium text-text-primary">{creativePerformance.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Wilayas Covered</span>
                  <span className="font-medium text-text-primary">{wilayaPerformance.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
