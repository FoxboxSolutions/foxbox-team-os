import { useState, useMemo, useCallback } from 'react'
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  DollarSign,
  ShoppingCart,
  Target,
  Plus,
  Pencil,
  Trash2,
  X,
  Calendar,
  Filter,
  Package,
  MapPin,
} from 'lucide-react'
import { useAppState } from '@/stores/AppState'
import { cn } from '@/lib/utils'
import type { ExpenseCategory, Expense } from '@/types'

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'PRODUCT', 'SHIPPING', 'DELIVERY', 'ADVERTISING', 'PACKAGING', 'OPERATIONS', 'TOOLS', 'OTHER',
]

const expenseCategoryColors: Record<string, string> = {
  PRODUCT: 'text-gold bg-gold/10 border-gold/20',
  SHIPPING: 'text-orange bg-orange/10 border-orange/20',
  DELIVERY: 'text-info bg-info/10 border-info/20',
  ADVERTISING: 'text-purple bg-purple/10 border-purple/20',
  PACKAGING: 'text-warning bg-warning/10 border-warning/20',
  OPERATIONS: 'text-text-muted bg-white/5 border-white/10',
  TOOLS: 'text-blue bg-blue/10 border-blue/20',
  OTHER: 'text-text-muted bg-white/5 border-white/10',
}

const expenseCategoryBarColors: Record<string, string> = {
  PRODUCT: 'bg-gold',
  SHIPPING: 'bg-orange',
  DELIVERY: 'bg-info',
  ADVERTISING: 'bg-purple',
  PACKAGING: 'bg-warning',
  OPERATIONS: 'bg-text-muted',
  TOOLS: 'bg-blue',
  OTHER: 'bg-text-muted',
}

const DATE_RANGES = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: 'All', days: Infinity },
] as const

type DateRange = (typeof DATE_RANGES)[number]['days']

interface ExpenseFormData {
  category: ExpenseCategory
  description: string
  amountDzd: string
  productId: string
  date: string
}

const emptyForm: ExpenseFormData = {
  category: 'OTHER',
  description: '',
  amountDzd: '',
  productId: '',
  date: new Date().toISOString().split('T')[0],
}

export function Finance() {
  const {
    orders, expenses, products, sellingProducts, revenues,
    addExpense, updateExpense, deleteExpense, currentUser, addActivityLog,
  } = useAppState()

  const [dateRange, setDateRange] = useState<DateRange>(Infinity)
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | 'ALL'>('ALL')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ExpenseFormData>(emptyForm)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'expenses' | 'revenue' | 'profitability'>('overview')

  const now = useMemo(() => new Date(), [])

  const dateFilteredData = useMemo(() => {
    if (dateRange === Infinity) return { expenses, orders, revenues }
    const cutoff = new Date(now.getTime() - dateRange * 24 * 60 * 60 * 1000)
    return {
      expenses: expenses.filter(e => e.createdAt >= cutoff),
      orders: orders.filter(o => o.createdAt >= cutoff),
      revenues: revenues.filter(r => r.createdAt >= cutoff),
    }
  }, [expenses, orders, revenues, dateRange, now])

  const filteredExpenses = useMemo(() => {
    if (categoryFilter === 'ALL') return dateFilteredData.expenses
    return dateFilteredData.expenses.filter(e => e.category === categoryFilter)
  }, [dateFilteredData.expenses, categoryFilter])

  const deliveredOrders = useMemo(
    () => dateFilteredData.orders.filter(o => o.status === 'DELIVERED'),
    [dateFilteredData.orders],
  )

  const totalRevenue = useMemo(() => {
    const ordersRevenue = deliveredOrders.reduce((sum, o) => sum + o.sellingPriceDzd, 0)
    const otherRevenue = dateFilteredData.revenues.reduce((sum, r) => sum + r.amountDzd, 0)
    return ordersRevenue + otherRevenue
  }, [deliveredOrders, dateFilteredData.revenues])

  const ordersRevenue = useMemo(
    () => deliveredOrders.reduce((sum, o) => sum + o.sellingPriceDzd, 0),
    [deliveredOrders],
  )

  const totalExpenses = useMemo(
    () => filteredExpenses.reduce((sum, e) => sum + e.amountDzd, 0),
    [filteredExpenses],
  )

  const netProfit = totalRevenue - totalExpenses
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0
  const avgOrderValue = deliveredOrders.length > 0 ? ordersRevenue / deliveredOrders.length : 0

  const potentialProfit = useMemo(() => {
    const allActiveOrders = dateFilteredData.orders.filter(
      o => !['CANCELLED', 'RETURNED'].includes(o.status),
    )
    return allActiveOrders.reduce((sum, o) => sum + o.sellingPriceDzd + o.deliveryFeeDzd, 0)
  }, [dateFilteredData.orders])

  const expensesByCategory = useMemo(() => {
    const acc: Record<string, number> = {}
    filteredExpenses.forEach(e => {
      acc[e.category] = (acc[e.category] || 0) + e.amountDzd
    })
    return Object.entries(acc)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
  }, [filteredExpenses])

  const maxCategoryAmount = useMemo(
    () => Math.max(...expensesByCategory.map(c => c.amount), 1),
    [expensesByCategory],
  )

  const revenueByProduct = useMemo(() => {
    const map: Record<string, { name: string; revenue: number; orders: number; product?: typeof products[0] }> = {}
    deliveredOrders.forEach(o => {
      if (!map[o.productId]) {
        const sp = sellingProducts.find(p => p.id === o.productId)
        const rp = products.find(p => p.id === o.productId)
        map[o.productId] = { name: sp?.name || rp?.name || 'Unknown', revenue: 0, orders: 0, product: rp }
      }
      map[o.productId].revenue += o.sellingPriceDzd
      map[o.productId].orders += 1
    })
    return Object.values(map).sort((a, b) => b.revenue - a.revenue)
  }, [deliveredOrders, sellingProducts, products])

  const profitPerOrder = useMemo(() => {
    return deliveredOrders.map(o => {
      const sp = sellingProducts.find(p => p.id === o.productId)
      const product = sp || products.find(p => p.id === o.productId)
      const orderExpenses = filteredExpenses.filter(e => e.orderId === o.id)
      const totalOrderExpenses = orderExpenses.reduce((sum, e) => sum + e.amountDzd, 0)
      const productExpenses = filteredExpenses
        .filter(e => e.productId === o.productId && !e.orderId)
        .reduce((sum, e) => sum + e.amountDzd, 0)
      const relatedOrders = deliveredOrders.filter(oo => oo.productId === o.productId)
      const allocatedProductExpense = relatedOrders.length > 0
        ? productExpenses / relatedOrders.length
        : 0
      const totalCost = totalOrderExpenses + allocatedProductExpense
      return {
        order: o,
        productName: sp?.name || product?.name || 'Unknown',
        revenue: o.sellingPriceDzd,
        deliveryFee: o.deliveryFeeDzd,
        expenses: totalCost,
        profit: o.sellingPriceDzd - totalCost,
      }
    }).sort((a, b) => b.profit - a.profit)
  }, [deliveredOrders, products, filteredExpenses])

  const profitPerProduct = useMemo(() => {
    const map: Record<string, {
      name: string
      revenue: number
      expenses: number
      profit: number
      orderCount: number
    }> = {}
    profitPerOrder.forEach(po => {
      const product = products.find(p => p.name === po.productName)
      const key = product?.id || po.productName
      if (!map[key]) {
        map[key] = { name: po.productName, revenue: 0, expenses: 0, profit: 0, orderCount: 0 }
      }
      map[key].revenue += po.revenue
      map[key].expenses += po.expenses
      map[key].profit += po.profit
      map[key].orderCount += 1
    })
    return Object.values(map).sort((a, b) => b.profit - a.profit)
  }, [profitPerOrder, products])

  const profitPerWilaya = useMemo(() => {
    const map: Record<string, {
      wilaya: string
      revenue: number
      orders: number
      expenses: number
      profit: number
    }> = {}
    profitPerOrder.forEach(po => {
      const wilaya = po.order.customer?.wilaya || 'Unknown'
      if (!map[wilaya]) {
        map[wilaya] = { wilaya, revenue: 0, orders: 0, expenses: 0, profit: 0 }
      }
      map[wilaya].revenue += po.revenue
      map[wilaya].orders += 1
      map[wilaya].expenses += po.expenses
      map[wilaya].profit += po.profit
    })
    return Object.values(map).sort((a, b) => b.profit - a.profit)
  }, [profitPerOrder])

  const expenseTrend = useMemo(() => {
    const dayMap: Record<string, number> = {}
    filteredExpenses.forEach(e => {
      const key = e.createdAt.toISOString().split('T')[0]
      dayMap[key] = (dayMap[key] || 0) + e.amountDzd
    })
    const entries = Object.entries(dayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
    return entries.map(([date, amount]) => ({ date, amount }))
  }, [filteredExpenses])

  const maxTrendAmount = useMemo(
    () => Math.max(...expenseTrend.map(t => t.amount), 1),
    [expenseTrend],
  )

  const recentExpenses = useMemo(() => {
    return [...filteredExpenses]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 8)
  }, [filteredExpenses])

  const openAddForm = useCallback(() => {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(true)
  }, [])

  const openEditForm = useCallback((expense: Expense) => {
    setEditingId(expense.id)
    setForm({
      category: expense.category,
      description: expense.description,
      amountDzd: String(expense.amountDzd),
      productId: expense.productId || '',
      date: expense.createdAt.toISOString().split('T')[0],
    })
    setShowForm(true)
  }, [])

  const closeForm = useCallback(() => {
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm)
  }, [])

  const handleSave = useCallback(() => {
    const amount = parseFloat(form.amountDzd)
    if (!form.description.trim() || isNaN(amount) || amount <= 0) return

    const dateObj = new Date(form.date + 'T12:00:00')

    if (editingId) {
      const existing = expenses.find(e => e.id === editingId)
      if (existing) {
        updateExpense({
          ...existing,
          category: form.category,
          description: form.description.trim(),
          amountDzd: amount,
          productId: form.productId || undefined,
          createdAt: dateObj,
        })
        addActivityLog({
          id: crypto.randomUUID(),
          action: 'ORDER_UPDATED',
          userId: currentUser?.id || '',
          entityType: 'ORDER',
          entityId: editingId,
          entityName: `Expense: ${form.description.trim()}`,
          details: `Updated expense ${form.description.trim()} — ${(amount / 1000).toFixed(1)}K DA`,
          createdAt: new Date(),
        })
      }
    } else {
      const newExpense: Expense = {
        id: crypto.randomUUID(),
        category: form.category,
        description: form.description.trim(),
        amountDzd: amount,
        productId: form.productId || undefined,
        createdBy: currentUser?.id || '',
        createdAt: dateObj,
      }
      addExpense(newExpense)
      addActivityLog({
        id: crypto.randomUUID(),
        action: 'ORDER_CREATED',
        userId: currentUser?.id || '',
        entityType: 'ORDER',
        entityId: newExpense.id,
        entityName: `Expense: ${form.description.trim()}`,
        details: `Added expense ${form.description.trim()} — ${(amount / 1000).toFixed(1)}K DA`,
        createdAt: new Date(),
      })
    }
    closeForm()
  }, [form, editingId, expenses, updateExpense, addExpense, addActivityLog, currentUser, closeForm])

  const handleDelete = useCallback((id: string) => {
    const expense = expenses.find(e => e.id === id)
    deleteExpense(id)
    if (expense) {
      addActivityLog({
        id: crypto.randomUUID(),
        action: 'ORDER_UPDATED',
        userId: currentUser?.id || '',
        entityType: 'ORDER',
        entityId: id,
        entityName: `Expense: ${expense.description}`,
        details: `Deleted expense ${expense.description}`,
        createdAt: new Date(),
      })
    }
    setDeleteConfirm(null)
  }, [expenses, deleteExpense, addActivityLog, currentUser])

  const fmt = (n: number) => {
    if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return n.toFixed(0)
  }

  const kpis = [
    {
      label: 'Total Revenue',
      value: `${fmt(totalRevenue)} DA`,
      sub: `${deliveredOrders.length} delivered orders`,
      icon: TrendingUp,
      color: 'text-success',
      bg: 'bg-success/10',
    },
    {
      label: 'Total Expenses',
      value: `${fmt(totalExpenses)} DA`,
      sub: `${filteredExpenses.length} recorded`,
      icon: TrendingDown,
      color: 'text-danger',
      bg: 'bg-danger/10',
    },
    {
      label: 'Net Profit',
      value: `${fmt(netProfit)} DA`,
      sub: `${profitMargin.toFixed(1)}% margin`,
      icon: DollarSign,
      color: netProfit >= 0 ? 'text-success' : 'text-danger',
      bg: netProfit >= 0 ? 'bg-success/10' : 'bg-danger/10',
    },
    {
      label: 'Profit Margin',
      value: `${profitMargin.toFixed(1)}%`,
      sub: netProfit >= 0 ? 'Profitable' : 'Needs attention',
      icon: BarChart3,
      color: profitMargin >= 20 ? 'text-success' : profitMargin >= 0 ? 'text-gold' : 'text-danger',
      bg: profitMargin >= 20 ? 'bg-success/10' : profitMargin >= 0 ? 'bg-gold/10' : 'bg-danger/10',
    },
    {
      label: 'Orders Revenue',
      value: `${fmt(ordersRevenue)} DA`,
      sub: `${deliveredOrders.length} orders`,
      icon: ShoppingCart,
      color: 'text-info',
      bg: 'bg-info/10',
    },
    {
      label: 'Avg Order Value',
      value: `${fmt(avgOrderValue)} DA`,
      sub: 'Per delivered order',
      icon: Target,
      color: 'text-purple',
      bg: 'bg-purple/10',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Finance Management</h1>
          <p className="text-sm text-text-muted mt-1">
            Track revenue, expenses, and real profit across your business.
          </p>
        </div>
        <button onClick={openAddForm} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Expense
        </button>
      </div>

      {/* Filters Bar */}
      <div className="glass-card p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-text-muted" />
          <span className="text-xs text-text-muted uppercase tracking-wider">Period</span>
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

        <div className="h-6 w-px bg-border hidden md:block" />

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-text-muted" />
          <span className="text-xs text-text-muted uppercase tracking-wider">Category</span>
          <div className="relative">
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value as ExpenseCategory | 'ALL')}
              className="select-field pr-8 text-xs"
            >
              <option value="ALL">All Categories</option>
              {EXPENSE_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/[0.02] p-1 rounded-xl border border-border overflow-x-auto">
        {(['overview', 'expenses', 'revenue', 'profitability'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium rounded-lg transition-all capitalize whitespace-nowrap',
              activeTab === tab
                ? 'bg-gold/15 text-gold border border-gold/25'
                : 'text-text-muted hover:text-text-secondary hover:bg-white/[0.03]',
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map(kpi => (
          <div key={kpi.label} className="kpi-card">
            <div className="flex items-center justify-between mb-2">
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', kpi.bg)}>
                <kpi.icon className={cn('w-4 h-4', kpi.color)} />
              </div>
            </div>
            <p className={cn('text-xl font-bold', kpi.color)}>{kpi.value}</p>
            <p className="text-[10px] text-text-muted mt-0.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Potential vs Real Profit Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card p-5 border-l-4 border-l-gold">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-gold" />
            </div>
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider">Potential Profit</p>
              <p className="text-xl font-bold text-gold">{fmt(potentialProfit)} DA</p>
            </div>
          </div>
          <p className="text-xs text-text-muted">
            Revenue from all active orders (not yet delivered). Based on{' '}
            {dateFilteredData.orders.filter(o => !['CANCELLED', 'RETURNED'].includes(o.status)).length} pending/active orders.
          </p>
        </div>
        <div className="glass-card p-5 border-l-4 border-l-success">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider">Real Profit</p>
              <p className={cn('text-xl font-bold', netProfit >= 0 ? 'text-success' : 'text-danger')}>
                {fmt(netProfit)} DA
              </p>
            </div>
          </div>
          <p className="text-xs text-text-muted">
            Actual profit from {deliveredOrders.length} delivered orders minus{' '}
            {filteredExpenses.length} recorded expenses.
          </p>
        </div>
      </div>

      {/* === OVERVIEW TAB === */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Expense Categories Breakdown */}
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold mb-4 text-text-primary">Expenses by Category</h3>
            {expensesByCategory.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-8">No expenses recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {expensesByCategory.map(({ category, amount }) => {
                  const barColor = expenseCategoryBarColors[category] || 'bg-text-muted'
                  const pct = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0
                  const barWidth = maxCategoryAmount > 0 ? (amount / maxCategoryAmount) * 100 : 0
                  return (
                    <div key={category}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className={cn('w-2.5 h-2.5 rounded-full', barColor)} />
                          <span className="text-xs text-text-secondary">
                            {category.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <span className="text-xs font-medium text-text-primary">
                          {fmt(amount)} DA
                          <span className="text-text-muted ml-1">({pct.toFixed(0)}%)</span>
                        </span>
                      </div>
                      <div className="h-2 bg-white/[0.03] rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all duration-500', barColor)}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Expense Trend */}
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold mb-4 text-text-primary">Expense Trend (Last 14 Days)</h3>
            {expenseTrend.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-8">No expense data in this period.</p>
            ) : (
              <div className="flex items-end gap-1 h-40">
                {expenseTrend.map((t, i) => {
                  const h = maxTrendAmount > 0 ? (t.amount / maxTrendAmount) * 100 : 0
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[9px] text-text-muted">{fmt(t.amount)}</span>
                      <div
                        className="w-full bg-gold/60 rounded-t-sm transition-all duration-300 hover:bg-gold min-h-[2px]"
                        style={{ height: `${h}%` }}
                        title={`${t.date}: ${fmt(t.amount)} DA`}
                      />
                      <span className="text-[8px] text-text-muted">
                        {t.date.slice(5)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Revenue by Product */}
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold mb-4 text-text-primary">Revenue by Product</h3>
            {revenueByProduct.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-8">No delivered orders yet.</p>
            ) : (
              <div className="space-y-2">
                {revenueByProduct.slice(0, 6).map(rp => (
                  <div
                    key={rp.name}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-border"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center">
                      <Package className="w-4 h-4 text-gold" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-text-primary">{rp.name}</p>
                      <p className="text-[10px] text-text-muted">{rp.orders} orders</p>
                    </div>
                    <p className="text-sm font-bold text-success">{fmt(rp.revenue)} DA</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Expenses */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-text-primary">Recent Expenses</h3>
              <button
                onClick={() => setActiveTab('expenses')}
                className="text-xs text-gold hover:text-gold/80 transition-colors"
              >
                View all →
              </button>
            </div>
            {recentExpenses.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-8">No expenses yet.</p>
            ) : (
              <div className="space-y-2">
                {recentExpenses.map(expense => {
                  const colorClass = expenseCategoryColors[expense.category] || 'text-text-muted bg-white/5'
                  return (
                    <div
                      key={expense.id}
                      className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.02] border border-border"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate text-text-primary">{expense.description}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={cn('badge text-[9px]', colorClass)}>
                            {expense.category.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[10px] text-text-muted">
                            {expense.createdAt.toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <span className="text-sm font-medium text-danger whitespace-nowrap">
                        -{fmt(expense.amountDzd)} DA
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* === EXPENSES TAB === */}
      {activeTab === 'expenses' && (
        <div className="space-y-6">
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-text-primary">
                All Expenses ({filteredExpenses.length})
              </h3>
              <button onClick={openAddForm} className="btn-primary text-xs flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                Add Expense
              </button>
            </div>
            {filteredExpenses.length === 0 ? (
              <div className="text-center py-12">
                <DollarSign className="w-12 h-12 text-text-muted mx-auto mb-3 opacity-40" />
                <p className="text-sm text-text-muted">No expenses found.</p>
                <p className="text-xs text-text-muted mt-1">Click "Add Expense" to get started.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>Category</th>
                      <th>Amount</th>
                      <th>Product</th>
                      <th>Date</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExpenses
                      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
                      .map(expense => {
                        const colorClass = expenseCategoryColors[expense.category] || 'text-text-muted bg-white/5'
                        const product = (() => {
                          const sp = sellingProducts.find(p => p.id === expense.productId)
                          if (sp) return sp
                          return products.find(p => p.id === expense.productId)
                        })()
                        return (
                          <tr key={expense.id}>
                            <td>
                              <span className="font-medium text-text-primary">{expense.description}</span>
                            </td>
                            <td>
                              <span className={cn('badge text-[9px]', colorClass)}>
                                {expense.category.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td>
                              <span className="text-sm font-medium text-danger">
                                -{fmt(expense.amountDzd)} DA
                              </span>
                            </td>
                            <td>
                              <span className="text-xs text-text-secondary">
                                {product?.name || '—'}
                              </span>
                            </td>
                            <td>
                              <span className="text-xs text-text-muted">
                                {expense.createdAt.toLocaleDateString()}
                              </span>
                            </td>
                            <td className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => openEditForm(expense)}
                                  className="p-1.5 rounded-lg text-text-muted hover:text-gold hover:bg-gold/10 transition-all"
                                  title="Edit"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm(expense.id)}
                                  className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-all"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
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
      )}

      {/* === REVENUE TAB === */}
      {activeTab === 'revenue' && (
        <div className="space-y-6">
          {/* Revenue by Product Table */}
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold mb-4 text-text-primary">Revenue by Product</h3>
            {revenueByProduct.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingCart className="w-12 h-12 text-text-muted mx-auto mb-3 opacity-40" />
                <p className="text-sm text-text-muted">No delivered orders yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th className="text-right">Orders</th>
                      <th className="text-right">Revenue</th>
                      <th className="text-right">Avg per Order</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenueByProduct.map(rp => (
                      <tr key={rp.name}>
                        <td>
                          <span className="font-medium text-text-primary">{rp.name}</span>
                        </td>
                        <td className="text-right">
                          <span className="text-sm text-text-secondary">{rp.orders}</span>
                        </td>
                        <td className="text-right">
                          <span className="text-sm font-medium text-success">{fmt(rp.revenue)} DA</span>
                        </td>
                        <td className="text-right">
                          <span className="text-sm text-text-secondary">
                            {fmt(rp.orders > 0 ? rp.revenue / rp.orders : 0)} DA
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Profit per Order Table */}
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold mb-4 text-text-primary">Profit per Order</h3>
            {profitPerOrder.length === 0 ? (
              <div className="text-center py-12">
                <Target className="w-12 h-12 text-text-muted mx-auto mb-3 opacity-40" />
                <p className="text-sm text-text-muted">No delivered orders to analyze.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Order #</th>
                      <th>Product</th>
                      <th className="text-right">Revenue</th>
                      <th className="text-right">Expenses</th>
                      <th className="text-right">Profit</th>
                      <th className="text-right">Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profitPerOrder.map(po => {
                      const margin = po.revenue > 0 ? (po.profit / po.revenue) * 100 : 0
                      return (
                        <tr key={po.order.id}>
                          <td>
                            <span className="font-mono text-xs text-text-secondary">
                              #{po.order.orderNumber}
                            </span>
                          </td>
                          <td>
                            <span className="text-sm text-text-primary">{po.productName}</span>
                          </td>
                          <td className="text-right">
                            <span className="text-sm text-success">{fmt(po.revenue)} DA</span>
                          </td>
                          <td className="text-right">
                            <span className="text-sm text-danger">{fmt(po.expenses)} DA</span>
                          </td>
                          <td className="text-right">
                            <span className={cn('text-sm font-bold', po.profit >= 0 ? 'text-success' : 'text-danger')}>
                              {po.profit >= 0 ? '+' : ''}{fmt(po.profit)} DA
                            </span>
                          </td>
                          <td className="text-right">
                            <span className={cn(
                              'text-xs font-medium',
                              margin >= 20 ? 'text-success' : margin >= 0 ? 'text-gold' : 'text-danger',
                            )}>
                              {margin.toFixed(1)}%
                            </span>
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
      )}

      {/* === PROFITABILITY TAB === */}
      {activeTab === 'profitability' && (
        <div className="space-y-6">
          {/* Profit per Product */}
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold mb-4 text-text-primary">Profit by Product</h3>
            {profitPerProduct.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-12 h-12 text-text-muted mx-auto mb-3 opacity-40" />
                <p className="text-sm text-text-muted">No product data yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {profitPerProduct.map(p => {
                  const margin = p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0
                  return (
                    <div
                      key={p.name}
                      className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] border border-border"
                    >
                      <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center">
                        <Package className="w-5 h-5 text-gold" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary">{p.name}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] text-success">Rev: {fmt(p.revenue)} DA</span>
                          <span className="text-[10px] text-danger">Exp: {fmt(p.expenses)} DA</span>
                          <span className="text-[10px] text-text-muted">{p.orderCount} orders</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={cn('text-sm font-bold', p.profit >= 0 ? 'text-success' : 'text-danger')}>
                          {p.profit >= 0 ? '+' : ''}{fmt(p.profit)} DA
                        </p>
                        <p className={cn(
                          'text-[10px] mt-0.5',
                          margin >= 20 ? 'text-success' : margin >= 0 ? 'text-gold' : 'text-danger',
                        )}>
                          {margin.toFixed(1)}% margin
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Profit per Wilaya */}
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold mb-4 text-text-primary">
              <span className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gold" />
                Profit by Wilaya
              </span>
            </h3>
            {profitPerWilaya.length === 0 ? (
              <div className="text-center py-12">
                <MapPin className="w-12 h-12 text-text-muted mx-auto mb-3 opacity-40" />
                <p className="text-sm text-text-muted">No wilaya data yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Wilaya</th>
                      <th className="text-right">Orders</th>
                      <th className="text-right">Revenue</th>
                      <th className="text-right">Expenses</th>
                      <th className="text-right">Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profitPerWilaya.map(w => (
                      <tr key={w.wilaya}>
                        <td>
                          <span className="font-medium text-text-primary flex items-center gap-1.5">
                            <MapPin className="w-3 h-3 text-gold" />
                            {w.wilaya}
                          </span>
                        </td>
                        <td className="text-right">
                          <span className="text-sm text-text-secondary">{w.orders}</span>
                        </td>
                        <td className="text-right">
                          <span className="text-sm text-success">{fmt(w.revenue)} DA</span>
                        </td>
                        <td className="text-right">
                          <span className="text-sm text-danger">{fmt(w.expenses)} DA</span>
                        </td>
                        <td className="text-right">
                          <span className={cn('text-sm font-bold', w.profit >= 0 ? 'text-success' : 'text-danger')}>
                            {w.profit >= 0 ? '+' : ''}{fmt(w.profit)} DA
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* === EXPENSE FORM MODAL === */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeForm} />
          <div className="relative glass-card p-6 w-full max-w-lg mx-4 border border-border shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-text-primary">
                {editingId ? 'Edit Expense' : 'Add Expense'}
              </h3>
              <button
                onClick={closeForm}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/5 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-text-muted uppercase tracking-wider mb-1.5 block">
                  Category
                </label>
                <select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value as ExpenseCategory }))}
                  className="select-field w-full"
                >
                  {EXPENSE_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-text-muted uppercase tracking-wider mb-1.5 block">
                  Description
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="e.g. Facebook ad spend"
                  className="input-field w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-text-muted uppercase tracking-wider mb-1.5 block">
                    Amount (DA)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={form.amountDzd}
                    onChange={e => setForm(f => ({ ...f, amountDzd: e.target.value }))}
                    placeholder="0"
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="text-xs text-text-muted uppercase tracking-wider mb-1.5 block">
                    Date
                  </label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="input-field w-full"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-text-muted uppercase tracking-wider mb-1.5 block">
                  Product (optional)
                </label>
                <select
                  value={form.productId}
                  onChange={e => setForm(f => ({ ...f, productId: e.target.value }))}
                  className="select-field w-full"
                >
                  <option value="">No product</option>
                  {sellingProducts.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {form.amountDzd && parseFloat(form.amountDzd) > 0 && (
                <div className="p-3 rounded-xl bg-gold/5 border border-gold/20">
                  <p className="text-xs text-gold">
                    This expense will reduce your net profit by {fmt(parseFloat(form.amountDzd) || 0)} DA
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={closeForm} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!form.description.trim() || !form.amountDzd || parseFloat(form.amountDzd) <= 0}
                  className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {editingId ? 'Update' : 'Add'} Expense
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === DELETE CONFIRMATION MODAL === */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
          <div className="relative glass-card p-6 w-full max-w-sm mx-4 border border-border shadow-2xl">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-danger" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">Delete Expense?</h3>
              <p className="text-sm text-text-muted mb-6">
                This action cannot be undone. The expense will be permanently removed.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="btn-primary flex-1 bg-danger hover:bg-danger/90"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
