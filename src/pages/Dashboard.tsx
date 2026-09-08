import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Package,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  CheckSquare,
  Activity,
  ArrowUpRight,
  Clock,
  Users,
  Bell,
} from 'lucide-react'
import { useAppState } from '@/stores/AppState'
import { cn } from '@/lib/utils'

const statusColors: Record<string, string> = {
  IDEA: 'bg-text-muted/15 text-text-muted',
  RESEARCH: 'bg-info/12 text-info',
  STANDBY: 'bg-orange/12 text-orange',
  TESTING: 'bg-blue/12 text-blue',
  APPROVED: 'bg-success/12 text-success',
  PURCHASE: 'bg-gold/12 text-gold',
  SCALING: 'bg-purple/12 text-purple',
  REJECTED: 'bg-danger/12 text-danger',
  NEW: 'bg-info/12 text-info',
  PENDING_CONFIRMATION: 'bg-orange/12 text-orange',
  CONFIRMED: 'bg-success/12 text-success',
  CANCELLED: 'bg-danger/12 text-danger',
  PREPARING: 'bg-blue/12 text-blue',
  SHIPPED: 'bg-purple/12 text-purple',
  IN_TRANSIT: 'bg-blue/12 text-blue',
  OUT_FOR_DELIVERY: 'bg-gold/12 text-gold',
  DELIVERED: 'bg-success/12 text-success',
  RETURNED: 'bg-danger/12 text-danger',
}

const pipelineStages = [
  { key: 'IDEA', label: 'IDEA' },
  { key: 'RESEARCH', label: 'RESEARCH' },
  { key: 'TESTING', label: 'TESTING' },
  { key: 'APPROVED', label: 'APPROVED' },
  { key: 'PURCHASE', label: 'PURCHASE' },
  { key: 'SCALING', label: 'SCALING' },
]

const orderStatusLabels: Record<string, string> = {
  NEW: 'New',
  PENDING_CONFIRMATION: 'Pending',
  CONFIRMED: 'Confirmed',
  CANCELLED: 'Cancelled',
  PREPARING: 'Preparing',
  SHIPPED: 'Shipped',
  IN_TRANSIT: 'In Transit',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  RETURNED: 'Returned',
}

function relativeTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - new Date(date).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M DA`
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K DA`
  return `${value.toLocaleString()} DA`
}

function EmptyState({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <Icon className="w-8 h-8 text-text-muted/40 mb-2" />
      <p className="text-xs text-text-muted">{label}</p>
    </div>
  )
}

export function Dashboard() {
  const {
    products, tasks, orders, activityLog, users,
    unreadNotificationCount,
  } = useAppState()
  const navigate = useNavigate()

  const stats = useMemo(() => {
    const testing = products.filter(p => p.status === 'TESTING')
    const approved = products.filter(p => p.status === 'APPROVED')
    const scaling = products.filter(p => p.status === 'SCALING')

    const potentialProfit = [...testing, ...approved, ...scaling].reduce((sum, p) => {
      if (p.codScenario && p.costScenario) {
        const margin = p.codScenario.sellingPriceDzd - (p.costScenario.landedCostDzd / p.costScenario.quantity)
        return sum + (margin * 0.7 * p.costScenario.quantity)
      }
      return sum
    }, 0)

    const totalInvested = products.reduce((sum, p) => {
      if (p.costScenario) return sum + p.costScenario.landedCostDzd
      return sum
    }, 0)

    return {
      totalProducts: products.length,
      activeTests: testing.length,
      potentialProfit,
      totalInvested,
    }
  }, [products])

  const codStats = useMemo(() => {
    const total = orders.length
    const pending = orders.filter(o => o.confirmationStatus === 'PENDING').length
    const confirmed = orders.filter(o => o.confirmationStatus === 'CONFIRMED').length
    const delivered = orders.filter(o => o.status === 'DELIVERED').length
    const returned = orders.filter(o => o.status === 'RETURNED').length
    return { total, pending, confirmed, delivered, returned }
  }, [orders])

  const teamStats = useMemo(() => {
    const pendingTasks = tasks.filter(t => t.status !== 'DONE').length
    const totalTasks = tasks.length
    return { pendingTasks, totalTasks, teamMembers: users.length }
  }, [tasks, users])

  const pipelineCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const stage of pipelineStages) {
      counts[stage.key] = products.filter(p => p.status === stage.key).length
    }
    return counts
  }, [products])

  const recentActivity = useMemo(() => {
    return [...activityLog]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)
  }, [activityLog])

  const topProducts = useMemo(() => {
    return [...products]
      .filter(p => p.score != null)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 3)
  }, [products])

  const recentOrders = useMemo(() => {
    return [...orders]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
  }, [orders])

  const quickStats = useMemo(() => {
    const totalTasks = tasks.length
    const doneTasks = tasks.filter(t => t.status === 'DONE').length
    const taskCompletionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

    const totalOrders = orders.length
    const confirmedOrders = orders.filter(o => o.confirmationStatus === 'CONFIRMED').length
    const orderConfirmationRate = totalOrders > 0 ? Math.round((confirmedOrders / totalOrders) * 100) : 0

    const shippedOrders = orders.filter(o =>
      ['SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(o.status)
    ).length
    const deliveredOrders = orders.filter(o => o.status === 'DELIVERED').length
    const deliveryRate = shippedOrders > 0 ? Math.round((deliveredOrders / shippedOrders) * 100) : 0

    return { taskCompletionRate, orderConfirmationRate, deliveryRate }
  }, [tasks, orders])

  const kpis = [
    { label: 'Total Products', value: stats.totalProducts, icon: Package, color: 'text-gold', bgColor: 'bg-gold/10', route: '/app/research' },
    { label: 'Active Tests', value: stats.activeTests, icon: TrendingUp, color: 'text-blue', bgColor: 'bg-blue/10', route: '/app/research' },
    { label: 'Potential Profit', value: formatCurrency(stats.potentialProfit), icon: DollarSign, color: 'text-success', bgColor: 'bg-success/10', route: '/app/finance' },
    { label: 'Total Invested', value: formatCurrency(stats.totalInvested), icon: DollarSign, color: 'text-orange', bgColor: 'bg-orange/10', route: '/app/finance' },
  ]

  const codKpis = [
    { label: 'Total Orders', value: codStats.total, icon: ShoppingCart, color: 'text-info', bgColor: 'bg-info/10', route: '/app/orders' },
    { label: 'Pending', value: codStats.pending, icon: Clock, color: 'text-orange', bgColor: 'bg-orange/10', route: '/app/orders' },
    { label: 'Confirmed', value: codStats.confirmed, icon: CheckSquare, color: 'text-success', bgColor: 'bg-success/10', route: '/app/orders' },
    { label: 'Delivered', value: codStats.delivered, icon: Package, color: 'text-gold', bgColor: 'bg-gold/10', route: '/app/delivery' },
    { label: 'Returned', value: codStats.returned, icon: Activity, color: 'text-danger', bgColor: 'bg-danger/10', route: '/app/orders' },
  ]

  const teamKpis = [
    { label: 'Pending Tasks', value: teamStats.pendingTasks, icon: CheckSquare, color: 'text-orange', bgColor: 'bg-orange/10', route: '/app/tasks' },
    { label: 'Total Tasks', value: teamStats.totalTasks, icon: CheckSquare, color: 'text-info', bgColor: 'bg-info/10', route: '/app/tasks' },
    { label: 'Team Members', value: teamStats.teamMembers, icon: Users, color: 'text-purple', bgColor: 'bg-purple/10', route: '/app/team' },
    { label: 'Unread Notifications', value: unreadNotificationCount, icon: Bell, color: 'text-warning', bgColor: 'bg-warning/10', route: '/app/notifications' },
  ]

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-text-muted mt-1">Welcome back. Here's your command center.</p>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
            <CheckSquare className="w-5 h-5 text-success" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-text-muted uppercase tracking-wider">Task Completion</p>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-success rounded-full transition-all"
                  style={{ width: `${quickStats.taskCompletionRate}%` }}
                />
              </div>
              <span className="text-sm font-bold text-success">{quickStats.taskCompletionRate}%</span>
            </div>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center">
            <CheckSquare className="w-5 h-5 text-info" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-text-muted uppercase tracking-wider">Order Confirmation</p>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-info rounded-full transition-all"
                  style={{ width: `${quickStats.orderConfirmationRate}%` }}
                />
              </div>
              <span className="text-sm font-bold text-info">{quickStats.orderConfirmationRate}%</span>
            </div>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-gold" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-text-muted uppercase tracking-wider">Delivery Rate</p>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gold rounded-full transition-all"
                  style={{ width: `${quickStats.deliveryRate}%` }}
                />
              </div>
              <span className="text-sm font-bold text-gold">{quickStats.deliveryRate}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Product KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="kpi-card cursor-pointer hover:border-border-light transition-all"
            onClick={() => navigate(kpi.route)}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', kpi.bgColor)}>
                <kpi.icon className={cn('w-5 h-5', kpi.color)} />
              </div>
              <ArrowUpRight className="w-4 h-4 text-text-muted" />
            </div>
            <p className="text-2xl font-bold">{kpi.value}</p>
            <p className="text-xs text-text-muted mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* COD Operations + Team Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* COD Operations */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">COD Operations</h3>
            <button
              onClick={() => navigate('/app/orders')}
              className="text-xs text-gold hover:text-gold-light transition-colors flex items-center gap-1"
            >
              View All <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          {codStats.total === 0 ? (
            <EmptyState icon={ShoppingCart} label="No orders yet" />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {codKpis.map((kpi) => (
                <div
                  key={kpi.label}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-border cursor-pointer hover:border-border-light transition-all"
                  onClick={() => navigate(kpi.route)}
                >
                  <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', kpi.bgColor)}>
                    <kpi.icon className={cn('w-4 h-4', kpi.color)} />
                  </div>
                  <div>
                    <p className="text-lg font-bold">{kpi.value}</p>
                    <p className="text-[10px] text-text-muted uppercase tracking-wider">{kpi.label}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Team Overview */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Team Overview</h3>
            <button
              onClick={() => navigate('/app/tasks')}
              className="text-xs text-gold hover:text-gold-light transition-colors flex items-center gap-1"
            >
              View Tasks <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {teamKpis.map((kpi) => (
              <div
                key={kpi.label}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-border cursor-pointer hover:border-border-light transition-all"
                onClick={() => navigate(kpi.route)}
              >
                <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', kpi.bgColor)}>
                  <kpi.icon className={cn('w-4 h-4', kpi.color)} />
                </div>
                <div>
                  <p className="text-lg font-bold">{kpi.value}</p>
                  <p className="text-[10px] text-text-muted uppercase tracking-wider">{kpi.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pipeline + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Pipeline */}
        <div className="lg:col-span-2 glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-semibold">Product Pipeline</h3>
            <button
              onClick={() => navigate('/app/research')}
              className="text-xs text-gold hover:text-gold-light transition-colors flex items-center gap-1"
            >
              View All <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          {products.length === 0 ? (
            <EmptyState icon={Package} label="No products in pipeline" />
          ) : (
            <div className="flex items-center justify-between gap-2">
              {pipelineStages.map((stage, i) => {
                const count = pipelineCounts[stage.key]
                const isActive = count > 0
                return (
                  <div key={stage.key} className="flex items-center gap-2">
                    <div className={cn('pipeline-stage', isActive && 'active')}>
                      <div className={cn('pipeline-stage-count', isActive && 'active')}>
                        {count}
                      </div>
                      <span className="text-[10px] font-medium text-text-muted tracking-wider">{stage.label}</span>
                    </div>
                    {i < pipelineStages.length - 1 && (
                      <div className={cn('pipeline-connector', count > 0 && 'active')} />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Recent Activity</h3>
            <button
              onClick={() => navigate('/app/team')}
              className="text-xs text-gold hover:text-gold-light transition-colors flex items-center gap-1"
            >
              View All <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          {recentActivity.length === 0 ? (
            <EmptyState icon={Activity} label="No activity yet" />
          ) : (
            <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1 scrollbar-thin">
              {recentActivity.map((activity) => {
                const user = users.find(u => u.id === activity.userId)
                return (
                  <div key={activity.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/[0.02] transition-colors">
                    <div className="w-2 h-2 rounded-full bg-gold mt-1.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-text-secondary leading-relaxed">
                        <span className="font-medium text-text-primary">{user?.name || 'Unknown'}</span>
                        {' '}
                        {activity.action.replace(/_/g, ' ').toLowerCase()}
                        {' '}
                        <span className="font-medium text-text-primary">{activity.entityName}</span>
                      </p>
                      <p className="text-[10px] text-text-muted mt-0.5">{relativeTime(activity.createdAt)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Top Products + Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Top Products</h3>
            <button
              onClick={() => navigate('/app/research')}
              className="text-xs text-gold hover:text-gold-light transition-colors flex items-center gap-1"
            >
              View All <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          {topProducts.length === 0 ? (
            <EmptyState icon={Package} label="No products with scores yet" />
          ) : (
            <div className="space-y-3">
              {topProducts.map((product, index) => (
                <div
                  key={product.id}
                  onClick={() => navigate(`/app/research/${product.id}`)}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-border hover:border-border-light transition-all cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-lg bg-charcoal-light overflow-hidden flex-shrink-0">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-5 h-5 text-text-muted/40" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{product.name}</p>
                    <p className="text-[11px] text-text-muted">Score: {product.score}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn('status-badge', statusColors[product.status])}>
                      {product.status}
                    </span>
                    {index === 0 && (
                      <span className="text-[10px] font-bold text-gold bg-gold/10 px-1.5 py-0.5 rounded">#1</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Orders */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Recent Orders</h3>
            <button
              onClick={() => navigate('/app/orders')}
              className="text-xs text-gold hover:text-gold-light transition-colors flex items-center gap-1"
            >
              View All <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          {recentOrders.length === 0 ? (
            <EmptyState icon={ShoppingCart} label="No orders yet" />
          ) : (
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-border hover:border-border-light transition-all cursor-pointer"
                  onClick={() => navigate('/app/orders')}
                >
                  <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center flex-shrink-0">
                    <ShoppingCart className="w-4 h-4 text-gold" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{order.customer.name}</p>
                    <p className="text-[11px] text-text-muted">{order.orderNumber} — {order.customer.wilaya}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gold">{order.sellingPriceDzd.toLocaleString()} DA</p>
                    <span className={cn('status-badge text-[9px]', statusColors[order.status])}>
                      {orderStatusLabels[order.status] || order.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
