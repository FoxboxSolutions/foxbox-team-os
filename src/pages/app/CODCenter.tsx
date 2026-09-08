import { useState, useMemo } from 'react'
import {
  TrendingUp,
  ShoppingCart,
  CheckCircle,
  Truck,
  RotateCcw,
  ArrowUpRight,
  Package,
  Clock,
  XCircle,
  Filter,
  Calendar,
  BarChart3,
  Phone,
  MapPin,
  ChevronRight,
  Inbox,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppState } from '@/stores/AppState'
import { cn } from '@/lib/utils'
import type { Order, OrderStatus } from '@/types'

type DateRange = '7d' | '30d' | '90d' | 'all'

function getStatusClass(status: OrderStatus): string {
  switch (status) {
    case 'NEW': return 'status-new'
    case 'PENDING_CONFIRMATION': return 'status-pending'
    case 'CONFIRMED': return 'status-confirmed'
    case 'CANCELLED': return 'status-cancelled'
    case 'PREPARING': return 'status-preparing'
    case 'SHIPPED': return 'status-shipped'
    case 'IN_TRANSIT':
    case 'OUT_FOR_DELIVERY': return 'status-transit'
    case 'DELIVERED': return 'status-delivered'
    case 'RETURNED': return 'status-returned'
    default: return 'status-new'
  }
}

function getStatusLabel(status: OrderStatus): string {
  return status.replace(/_/g, ' ')
}

function formatDzd(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M DA`
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K DA`
  return `${amount.toLocaleString()} DA`
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(0, 0, 0, 0)
  return d
}

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  NEW: 'PENDING_CONFIRMATION',
  PENDING_CONFIRMATION: 'CONFIRMED',
  CONFIRMED: 'PREPARING',
  PREPARING: 'SHIPPED',
  SHIPPED: 'IN_TRANSIT',
  IN_TRANSIT: 'OUT_FOR_DELIVERY',
  OUT_FOR_DELIVERY: 'DELIVERED',
}

const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  NEW: 'Send for Confirmation',
  PENDING_CONFIRMATION: 'Confirm Order',
  CONFIRMED: 'Start Preparing',
  PREPARING: 'Ship Order',
  SHIPPED: 'Mark In Transit',
  IN_TRANSIT: 'Out for Delivery',
  OUT_FOR_DELIVERY: 'Mark Delivered',
}

export function CODCenter() {
  const { orders, sellingProducts, deliveryProviders, expenses, updateOrder } = useAppState()
  const navigate = useNavigate()

  const [dateRange, setDateRange] = useState<DateRange>('all')
  const [productFilter, setProductFilter] = useState<string>('all')
  const [wilayaFilter, setWilayaFilter] = useState<string>('all')
  const [providerFilter, setProviderFilter] = useState<string>('all')
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const dateCutoff = useMemo(() => {
    switch (dateRange) {
      case '7d': return daysAgo(7)
      case '30d': return daysAgo(30)
      case '90d': return daysAgo(90)
      default: return new Date(0)
    }
  }, [dateRange])

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const created = new Date(o.createdAt)
      if (created < dateCutoff) return false
      if (productFilter !== 'all' && o.productId !== productFilter) return false
      if (wilayaFilter !== 'all' && o.customer.wilaya !== wilayaFilter) return false
      if (providerFilter !== 'all' && o.carrierId !== providerFilter) return false
      return true
    })
  }, [orders, dateCutoff, productFilter, wilayaFilter, providerFilter])

  const uniqueWilayas = useMemo(() => {
    const set = new Set(orders.map(o => o.customer.wilaya))
    return Array.from(set).sort()
  }, [orders])

  const totalOrders = filteredOrders.length
  const pendingConfirmation = filteredOrders.filter(o => o.confirmationStatus === 'PENDING').length
  const confirmed = filteredOrders.filter(o => o.status === 'CONFIRMED').length
  const cancelled = filteredOrders.filter(o => o.status === 'CANCELLED').length
  const preparing = filteredOrders.filter(o => o.status === 'PREPARING').length
  const shipped = filteredOrders.filter(o => o.status === 'SHIPPED').length
  const inTransit = filteredOrders.filter(o => o.status === 'IN_TRANSIT' || o.status === 'OUT_FOR_DELIVERY').length
  const delivered = filteredOrders.filter(o => o.status === 'DELIVERED').length
  const returned = filteredOrders.filter(o => o.status === 'RETURNED').length

  const confirmedCount = filteredOrders.filter(o => o.confirmationStatus === 'CONFIRMED').length
  const confirmationRate = totalOrders > 0 ? (confirmedCount / totalOrders * 100) : 0
  const deliveryRate = confirmedCount > 0 ? (delivered / confirmedCount * 100) : 0
  const returnRate = delivered > 0 ? (returned / delivered * 100) : 0

  const avgDeliveryTime = useMemo(() => {
    const deliveredOrders = filteredOrders.filter(o => o.deliveredAt && o.confirmedAt)
    if (deliveredOrders.length === 0) return 0
    const totalDays = deliveredOrders.reduce((sum, o) => {
      const diff = new Date(o.deliveredAt!).getTime() - new Date(o.confirmedAt!).getTime()
      return sum + diff / (1000 * 60 * 60 * 24)
    }, 0)
    return totalDays / deliveredOrders.length
  }, [filteredOrders])

  const totalExpenses = useMemo(() => {
    return expenses
      .filter(e => {
        const created = new Date(e.createdAt)
        return created >= dateCutoff
      })
      .reduce((sum, e) => sum + e.amountDzd, 0)
  }, [expenses, dateCutoff])

  const orderRevenue = useMemo(() => {
    return filteredOrders
      .filter(o => o.status === 'DELIVERED')
      .reduce((sum, o) => sum + o.sellingPriceDzd, 0)
  }, [filteredOrders])

  const realProfit = orderRevenue - totalExpenses

  const statusBreakdown = [
    { label: 'New', count: filteredOrders.filter(o => o.status === 'NEW').length, color: 'bg-info', textColor: 'text-info' },
    { label: 'Pending Confirm', count: pendingConfirmation, color: 'bg-warning', textColor: 'text-warning' },
    { label: 'Confirmed', count: confirmed, color: 'bg-success', textColor: 'text-success' },
    { label: 'Preparing', count: preparing, color: 'bg-purple', textColor: 'text-purple' },
    { label: 'Shipped', count: shipped, color: 'bg-blue', textColor: 'text-blue' },
    { label: 'In Transit', count: inTransit, color: 'bg-orange', textColor: 'text-orange' },
    { label: 'Delivered', count: delivered, color: 'bg-success', textColor: 'text-success' },
    { label: 'Returned', count: returned, color: 'bg-danger', textColor: 'text-danger' },
    { label: 'Cancelled', count: cancelled, color: 'bg-danger', textColor: 'text-danger' },
  ]

  const recentOrders = useMemo(() => {
    return [...filteredOrders]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8)
  }, [filteredOrders])

  const handleStatusChange = (order: Order, nextStatus: OrderStatus) => {
    const now = new Date()
    const updated: Order = {
      ...order,
      status: nextStatus,
      updatedAt: now,
    }
    if (nextStatus === 'CONFIRMED') {
      updated.confirmedAt = now
      updated.confirmationStatus = 'CONFIRMED'
    } else if (nextStatus === 'SHIPPED') {
      updated.shippedAt = now
    } else if (nextStatus === 'DELIVERED') {
      updated.deliveredAt = now
    } else if (nextStatus === 'RETURNED') {
      updated.returnedAt = now
    }
    updateOrder(updated)
    setConfirmingId(null)
  }

  const handleCancel = (order: Order) => {
    updateOrder({
      ...order,
      status: 'CANCELLED',
      confirmationStatus: 'CANCELLED',
      updatedAt: new Date(),
    })
    setConfirmingId(null)
  }

  const kpis = [
    { label: 'Total Orders', value: totalOrders, icon: ShoppingCart, color: 'text-info', bgColor: 'bg-info/10' },
    { label: 'Pending Confirmation', value: pendingConfirmation, icon: Clock, color: 'text-warning', bgColor: 'bg-warning/10' },
    { label: 'Confirmed', value: confirmed, icon: CheckCircle, color: 'text-success', bgColor: 'bg-success/10' },
    { label: 'Preparing', value: preparing, icon: Package, color: 'text-purple', bgColor: 'bg-purple/10' },
    { label: 'Shipped', value: shipped, icon: Truck, color: 'text-blue', bgColor: 'bg-blue/10' },
    { label: 'In Transit', value: inTransit, icon: TrendingUp, color: 'text-orange', bgColor: 'bg-orange/10' },
    { label: 'Delivered', value: delivered, icon: CheckCircle, color: 'text-gold', bgColor: 'bg-gold/10' },
    { label: 'Returned', value: returned, icon: RotateCcw, color: 'text-danger', bgColor: 'bg-danger/10' },
    { label: 'Cancelled', value: cancelled, icon: XCircle, color: 'text-danger', bgColor: 'bg-danger/10' },
  ]

  if (orders.length === 0) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">COD Center</h1>
            <p className="text-sm text-text-muted mt-1">Cash on Delivery operations dashboard.</p>
          </div>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">
            <Inbox className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Orders Yet</h3>
          <p className="text-sm text-text-muted max-w-sm">
            Orders will appear here once you start receiving COD orders. Create your first order to get started.
          </p>
          <button
            onClick={() => navigate('/app/orders')}
            className="btn-primary mt-6"
          >
            <ShoppingCart className="w-4 h-4" />
            Create Order
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">COD Center</h1>
          <p className="text-sm text-text-muted mt-1">Cash on Delivery operations dashboard.</p>
        </div>
        <button
          onClick={() => navigate('/app/orders')}
          className="btn-secondary"
        >
          View All Orders
          <ArrowUpRight className="w-4 h-4" />
        </button>
      </div>

      {/* Filters */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-gold" />
          <span className="text-sm font-semibold">Filters</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Date Range */}
          <div>
            <label className="text-xs text-text-muted mb-1.5 block">Date Range</label>
            <div className="flex gap-1">
              {(['7d', '30d', '90d', 'all'] as DateRange[]).map(range => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                    dateRange === range
                      ? 'bg-gold/15 text-gold border border-gold/30'
                      : 'bg-white/[0.03] text-text-muted border border-border hover:text-text-secondary hover:border-border-light'
                  )}
                >
                  {range === 'all' ? 'All' : range.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Product Filter */}
          <div>
            <label className="text-xs text-text-muted mb-1.5 block">Product</label>
            <select
              value={productFilter}
              onChange={e => setProductFilter(e.target.value)}
              className="select-field"
            >
              <option value="all">All Products</option>
              {sellingProducts.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Wilaya Filter */}
          <div>
            <label className="text-xs text-text-muted mb-1.5 block">Wilaya</label>
            <select
              value={wilayaFilter}
              onChange={e => setWilayaFilter(e.target.value)}
              className="select-field"
            >
              <option value="all">All Wilayas</option>
              {uniqueWilayas.map(w => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>

          {/* Delivery Provider Filter */}
          <div>
            <label className="text-xs text-text-muted mb-1.5 block">Delivery Provider</label>
            <select
              value={providerFilter}
              onChange={e => setProviderFilter(e.target.value)}
              className="select-field"
            >
              <option value="all">All Providers</option>
              {deliveryProviders.map(dp => (
                <option key={dp.id} value={dp.id}>{dp.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpis.map(kpi => (
          <div key={kpi.label} className="kpi-card">
            <div className="flex items-center justify-between mb-3">
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', kpi.bgColor)}>
                <kpi.icon className={cn('w-5 h-5', kpi.color)} />
              </div>
            </div>
            <p className="text-2xl font-bold">{kpi.value}</p>
            <p className="text-xs text-text-muted mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Rates & Financials */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="glass-card p-5">
          <p className="text-xs text-text-muted uppercase tracking-wider mb-2">Confirmation Rate</p>
          <p className={cn('text-2xl font-bold', confirmationRate >= 75 ? 'text-success' : 'text-warning')}>
            {confirmationRate.toFixed(1)}%
          </p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs text-text-muted uppercase tracking-wider mb-2">Delivery Rate</p>
          <p className={cn('text-2xl font-bold', deliveryRate >= 80 ? 'text-success' : 'text-warning')}>
            {deliveryRate.toFixed(1)}%
          </p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs text-text-muted uppercase tracking-wider mb-2">Return Rate</p>
          <p className={cn('text-2xl font-bold', returnRate <= 15 ? 'text-success' : 'text-danger')}>
            {returnRate.toFixed(1)}%
          </p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs text-text-muted uppercase tracking-wider mb-2">Avg Delivery</p>
          <p className="text-2xl font-bold text-info">
            {avgDeliveryTime > 0 ? `${avgDeliveryTime.toFixed(1)}d` : '—'}
          </p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs text-text-muted uppercase tracking-wider mb-2">Revenue</p>
          <p className="text-2xl font-bold text-gold">{formatDzd(orderRevenue)}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs text-text-muted uppercase tracking-wider mb-2">Real Profit</p>
          <p className={cn('text-2xl font-bold', realProfit >= 0 ? 'text-success' : 'text-danger')}>
            {formatDzd(realProfit)}
          </p>
        </div>
      </div>

      {/* Status Breakdown & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Bar Chart */}
        <div className="lg:col-span-2 glass-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 className="w-4 h-4 text-gold" />
            <h3 className="text-sm font-semibold">Order Status Breakdown</h3>
          </div>
          <div className="space-y-3">
            {statusBreakdown.map(status => (
              <div key={status.label} className="flex items-center gap-3">
                <div className={cn('w-3 h-3 rounded-full shrink-0', status.color)} />
                <span className="text-sm text-text-secondary w-36 shrink-0">{status.label}</span>
                <div className="flex-1 h-2.5 bg-white/[0.03] rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', status.color)}
                    style={{ width: `${totalOrders > 0 ? (status.count / totalOrders * 100) : 0}%` }}
                  />
                </div>
                <span className="text-sm font-medium w-8 text-right shrink-0">{status.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold mb-2">Quick Actions</h3>
          <button
            onClick={() => navigate('/app/orders')}
            className="glass-card p-5 w-full text-left hover:border-gold/20 transition-all group flex items-center gap-4"
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gold/10">
              <ShoppingCart className="w-5 h-5 text-gold group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold">Manage Orders</h4>
              <p className="text-xs text-text-muted">View and manage all COD orders.</p>
            </div>
            <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-gold transition-colors" />
          </button>
          <button
            onClick={() => navigate('/app/delivery')}
            className="glass-card p-5 w-full text-left hover:border-gold/20 transition-all group flex items-center gap-4"
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-info/10">
              <Truck className="w-5 h-5 text-info group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold">Delivery Tracking</h4>
              <p className="text-xs text-text-muted">Track shipments and deliveries.</p>
            </div>
            <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-info transition-colors" />
          </button>
          <button
            onClick={() => navigate('/app/analytics')}
            className="glass-card p-5 w-full text-left hover:border-gold/20 transition-all group flex items-center gap-4"
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-success/10">
              <TrendingUp className="w-5 h-5 text-success group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold">COD Analytics</h4>
              <p className="text-xs text-text-muted">Analyze performance by wilaya.</p>
            </div>
            <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-success transition-colors" />
          </button>
        </div>
      </div>

      {/* Recent Orders Table */}
      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between p-5 pb-0">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gold" />
            <h3 className="text-sm font-semibold">Recent Orders</h3>
            <span className="text-xs text-text-muted ml-1">({filteredOrders.length} total)</span>
          </div>
          <button
            onClick={() => navigate('/app/orders')}
            className="text-xs text-gold hover:text-gold-light transition-colors flex items-center gap-1"
          >
            View All <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>
        {recentOrders.length === 0 ? (
          <div className="p-12 text-center">
            <Inbox className="w-8 h-8 text-text-muted mx-auto mb-3" />
            <p className="text-sm text-text-muted">No orders match the current filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Customer</th>
                  <th>Wilaya</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Confirmation</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map(order => {
                  const next = NEXT_STATUS[order.status]
                  const canProgress = next && order.status !== 'CANCELLED' && order.status !== 'DELIVERED' && order.status !== 'RETURNED'

                  return (
                    <tr key={order.id}>
                      <td className="font-medium text-text-primary">{order.orderNumber}</td>
                      <td>
                        <div>
                          <p className="text-text-primary font-medium">{order.customer.name}</p>
                          <p className="text-xs text-text-muted flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {order.customer.phone}
                          </p>
                        </div>
                      </td>
                      <td>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-text-muted" />
                          {order.customer.wilaya}
                        </span>
                      </td>
                      <td className="font-medium text-text-primary">
                        {order.sellingPriceDzd.toLocaleString()} DA
                      </td>
                      <td>
                        <span className={cn('status-badge', getStatusClass(order.status))}>
                          {getStatusLabel(order.status)}
                        </span>
                      </td>
                      <td>
                        <span className={cn(
                          'status-badge',
                          order.confirmationStatus === 'CONFIRMED' ? 'status-confirmed' :
                          order.confirmationStatus === 'PENDING' ? 'status-pending' :
                          order.confirmationStatus === 'CANCELLED' ? 'status-cancelled' :
                          'status-new'
                        )}>
                          {order.confirmationStatus}
                        </span>
                      </td>
                      <td className="text-xs">{formatDate(new Date(order.createdAt))}</td>
                      <td>
                        {canProgress && (
                          <div className="flex items-center gap-1">
                            {confirmingId === order.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleStatusChange(order, next!)}
                                  className="px-2 py-1 rounded-md text-xs font-medium bg-success/15 text-success border border-success/20 hover:bg-success/25 transition-all"
                                >
                                  Confirm
                                </button>
                                {order.status === 'PENDING_CONFIRMATION' && (
                                  <button
                                    onClick={() => handleCancel(order)}
                                    className="px-2 py-1 rounded-md text-xs font-medium bg-danger/15 text-danger border border-danger/20 hover:bg-danger/25 transition-all"
                                  >
                                    Cancel
                                  </button>
                                )}
                                <button
                                  onClick={() => setConfirmingId(null)}
                                  className="px-2 py-1 rounded-md text-xs font-medium text-text-muted hover:text-text-secondary transition-all"
                                >
                                  ×
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmingId(order.id)}
                                className="px-2 py-1 rounded-md text-xs font-medium bg-gold/10 text-gold border border-gold/20 hover:bg-gold/20 transition-all"
                              >
                                {NEXT_LABEL[order.status] || 'Advance'}
                              </button>
                            )}
                          </div>
                        )}
                        {!canProgress && order.status !== 'CANCELLED' && (
                          <span className="text-xs text-text-muted italic">
                            {order.status === 'DELIVERED' ? 'Completed' : order.status === 'RETURNED' ? 'Returned' : '—'}
                          </span>
                        )}
                        {order.status === 'CANCELLED' && (
                          <span className="text-xs text-danger italic">Cancelled</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
