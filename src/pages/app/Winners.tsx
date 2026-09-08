import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Trophy,
  Search,
  X,
  Star,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  Package,
  Truck,
  CheckCircle,
  RotateCcw,
  AlertTriangle,
  ExternalLink,
  BarChart3,
  StickyNote,
  Filter,
  Flame,
  Crown,
  ShieldCheck,
  ArrowUpRight,
  Clock,
  Image as ImageIcon,
  ShoppingBag,
  Check,
} from 'lucide-react'
import { useAppState } from '@/stores/AppState'
import { cn } from '@/lib/utils'
import type { Product, ProductStatus, Creative, SellingProduct } from '@/types'

// ─── Helpers ────────────────────────────────────────────────

function formatDate(d: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(d))
}

// ─── Constants ──────────────────────────────────────────────

const WINNER_STATUSES: ProductStatus[] = ['APPROVED', 'SCALING']

const statusConfig: Record<ProductStatus, { label: string; color: string; bgColor: string }> = {
  IDEA: { label: 'Idea', color: 'text-text-muted', bgColor: 'bg-white/[0.05]' },
  RESEARCH: { label: 'Research', color: 'text-info', bgColor: 'bg-info/12' },
  STANDBY: { label: 'Standby', color: 'text-text-muted', bgColor: 'bg-white/[0.05]' },
  TESTING: { label: 'Testing', color: 'text-warning', bgColor: 'bg-warning/12' },
  APPROVED: { label: 'Approved', color: 'text-success', bgColor: 'bg-success/12' },
  PURCHASE: { label: 'Purchase', color: 'text-purple', bgColor: 'bg-purple/12' },
  SCALING: { label: 'Scaling', color: 'text-gold', bgColor: 'bg-gold/12' },
  REJECTED: { label: 'Rejected', color: 'text-danger', bgColor: 'bg-danger/12' },
}

// ─── Component ──────────────────────────────────────────────

export function Winners() {
  const {
    products,
    updateProduct,
    orders,
    creatives,
    expenses,
    revenues,
    currentUser,
    addActivityLog,
    addNotification,
    sellingProducts,
    addSellingProduct,
  } = useAppState()

  const navigate = useNavigate()

  // ─── State ──────────────────────────────────────────────

  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'WINNER' | ProductStatus>('ALL')
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null)
  const [showNoteModal, setShowNoteModal] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [showCreativeDrawer, setShowCreativeDrawer] = useState<string | null>(null)
  const [showPerformanceDrawer, setShowPerformanceDrawer] = useState<string | null>(null)

  // ─── Derived data ───────────────────────────────────────

  const getWinnerProducts = useCallback(() => {
    return products.filter(p => p.isWinner || WINNER_STATUSES.includes(p.status))
  }, [products])

  const winnerProducts = useMemo(() => getWinnerProducts(), [getWinnerProducts])

  const getStats = useCallback(
    (productId: string) => {
      const productOrders = orders.filter(o => o.productId === productId)
      const deliveredOrders = productOrders.filter(o => o.status === 'DELIVERED')
      const returnedOrders = productOrders.filter(o => o.status === 'RETURNED')
      const confirmedOrders = productOrders.filter(o => o.confirmationStatus === 'CONFIRMED')

      const productRevenue = deliveredOrders.reduce((sum, o) => sum + o.sellingPriceDzd, 0)
      const productExpenses = expenses
        .filter(e => e.productId === productId)
        .reduce((sum, e) => sum + e.amountDzd, 0)
      const productRevenues = revenues
        .filter(r => r.productId === productId)
        .reduce((sum, r) => sum + r.amountDzd, 0)

      const totalRelatedRevenue = productRevenues || productRevenue
      const profit = totalRelatedRevenue - productExpenses

      const confirmationRate = productOrders.length > 0
        ? (confirmedOrders.length / productOrders.length) * 100
        : 0
      const deliveryRate = confirmedOrders.length > 0
        ? (deliveredOrders.length / confirmedOrders.length) * 100
        : 0
      const returnRate = productOrders.length > 0
        ? (returnedOrders.length / productOrders.length) * 100
        : 0

      return {
        totalOrders: productOrders.length,
        deliveredOrders: deliveredOrders.length,
        revenue: totalRelatedRevenue,
        expenses: productExpenses,
        profit,
        confirmationRate,
        deliveryRate,
        returnRate,
      }
    },
    [orders, expenses, revenues]
  )

  const getBestCreative = useCallback(
    (productId: string): Creative | null => {
      const productCreatives = creatives.filter(c => c.productId === productId)
      const winner = productCreatives.find(c => c.isWinner)
      if (winner) return winner
      const sorted = [...productCreatives].sort(
        (a, b) => (b.performance?.roas || 0) - (a.performance?.roas || 0)
      )
      return sorted[0] || null
    },
    [creatives]
  )

  const getWinnerCreatives = useCallback(
    (productId: string): Creative[] => {
      return creatives.filter(c => c.productId === productId && c.isWinner)
    },
    [creatives]
  )

  // ─── Filtering ─────────────────────────────────────────

  const filteredProducts = useMemo(() => {
    let result = [...winnerProducts]

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(p => p.name.toLowerCase().includes(q))
    }

    if (filterStatus === 'WINNER') {
      result = result.filter(p => p.isWinner)
    } else if (filterStatus !== 'ALL') {
      result = result.filter(p => p.status === filterStatus)
    }

    return result
  }, [winnerProducts, searchQuery, filterStatus])

  // ─── KPIs ─────────────────────────────────────────────

  const kpis = useMemo(() => {
    const totalOrders = winnerProducts.reduce((sum, p) => sum + getStats(p.id).totalOrders, 0)
    const totalRevenue = winnerProducts.reduce((sum, p) => sum + getStats(p.id).revenue, 0)
    const totalExpenses = winnerProducts.reduce((sum, p) => sum + getStats(p.id).expenses, 0)
    const totalProfit = totalRevenue - totalExpenses
    return {
      count: winnerProducts.length,
      totalOrders,
      totalRevenue,
      totalProfit,
    }
  }, [winnerProducts, getStats])

  // ─── Handlers ─────────────────────────────────────────

  function toggleWinner(product: Product) {
    const now = new Date()
    const isCurrentlyWinner = product.isWinner
    const updated: Product = {
      ...product,
      isWinner: !isCurrentlyWinner,
      updatedAt: now,
    }
    updateProduct(updated)

    if (!isCurrentlyWinner) {
      addNotification({
        id: `n_${Date.now()}`,
        type: 'PRODUCT_STATUS_CHANGED',
        title: 'Product Marked as Winner',
        message: `${product.name} has been marked as a winning product.`,
        link: '/app/winners',
        isRead: false,
        userId: currentUser?.id || 'unknown',
        createdAt: now,
      })
      addActivityLog({
        id: `al_${Date.now()}`,
        action: 'PRODUCT_UPDATED',
        userId: currentUser?.id || 'unknown',
        entityType: 'PRODUCT',
        entityId: product.id,
        entityName: product.name,
        details: 'Product marked as winner',
        createdAt: now,
      })
    } else {
      addActivityLog({
        id: `al_${Date.now()}`,
        action: 'PRODUCT_UPDATED',
        userId: currentUser?.id || 'unknown',
        entityType: 'PRODUCT',
        entityId: product.id,
        entityName: product.name,
        details: 'Winner status removed',
        createdAt: now,
      })
    }
  }

  // Check if a product is already in selling products
  function isAlreadySelling(productId: string): boolean {
    return sellingProducts.some(sp => sp.researchProductId === productId)
  }

  // Add a research product to selling products
  function handleStartSelling(product: Product) {
    if (isAlreadySelling(product.id)) return

    const now = new Date()
    const sellingPrice = product.codScenario?.sellingPriceDzd || product.variants?.[0]?.priceRmb || 0
    const costPrice = product.costScenario?.landedCostDzd || 0

    const newSellingProduct: SellingProduct = {
      id: `sp_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 8)}`,
      name: product.name,
      sku: product.sourceProductId || `SKU-${Date.now().toString(36).slice(-6).toUpperCase()}`,
      description: product.description,
      imageUrl: product.imageUrl,
      sellingPriceDzd: sellingPrice,
      costPriceDzd: costPrice,
      stock: 0,
      availableStock: 0,
      status: 'ACTIVE',
      weight: undefined,
      supplier: product.supplier?.name,
      supplierRef: product.sourceProductId,
      notes: `Migrated from Product Research. Original status: ${product.status}`,
      researchProductId: product.id,
      createdAt: now,
      updatedAt: now,
    }

    addSellingProduct(newSellingProduct)
    addActivityLog({
      id: `al_${Date.now()}`,
      action: 'PRODUCT_CREATED',
      userId: currentUser?.id || 'unknown',
      entityType: 'SELLING_PRODUCT',
      entityId: newSellingProduct.id,
      entityName: newSellingProduct.name,
      details: `Product added to selling from Winners: ${product.name}`,
      createdAt: now,
    })
    addNotification({
      id: `n_${Date.now()}`,
      type: 'PRODUCT_STATUS_CHANGED',
      title: 'Product Added to Selling',
      message: `${product.name} is now available in Product Selling.`,
      link: '/app/product-selling',
      isRead: false,
      userId: currentUser?.id || 'unknown',
      createdAt: now,
    })
  }

  function saveNote(productId: string) {
    const product = products.find(p => p.id === productId)
    if (!product) return
    const now = new Date()
    updateProduct({
      ...product,
      notes: noteText,
      updatedAt: now,
    })
    addActivityLog({
      id: `al_${Date.now()}`,
      action: 'PRODUCT_UPDATED',
      userId: currentUser?.id || 'unknown',
      entityType: 'PRODUCT',
      entityId: productId,
      entityName: product.name,
      details: 'Winner notes updated',
      createdAt: now,
    })
    setShowNoteModal(null)
    setNoteText('')
  }

  function openNoteModal(product: Product) {
    setNoteText(product.notes || '')
    setShowNoteModal(product.id)
  }

  // ─── Selected product data ────────────────────────────

  const selectedProductData = useMemo(
    () => (selectedProduct ? products.find(p => p.id === selectedProduct) : null),
    [selectedProduct, products]
  )

  const selectedStats = useMemo(
    () => (selectedProduct ? getStats(selectedProduct) : null),
    [selectedProduct, getStats]
  )

  const selectedBestCreative = useMemo(
    () => (selectedProduct ? getBestCreative(selectedProduct) : null),
    [selectedProduct, getBestCreative]
  )

  const selectedWinnerCreatives = useMemo(
    () => (selectedProduct ? getWinnerCreatives(selectedProduct) : []),
    [selectedProduct, getWinnerCreatives]
  )

  const selectedProductOrders = useMemo(
    () => (selectedProduct ? orders.filter(o => o.productId === selectedProduct) : []),
    [selectedProduct, orders]
  )

  // ─── Filter counts ──────────────────────────────────

  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: winnerProducts.length, WINNER: 0 }
    winnerProducts.forEach(p => {
      if (p.isWinner) counts.WINNER = (counts.WINNER || 0) + 1
      counts[p.status] = (counts[p.status] || 0) + 1
    })
    return counts
  }, [winnerProducts])

  // ─── Render ──────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Trophy className="w-7 h-7 text-gold" />
            Winning Products
          </h1>
          <p className="text-sm text-text-muted mt-1">Your validated product knowledge base.</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi-card">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-gold/10 flex items-center justify-center">
              <Crown className="w-4.5 h-4.5 text-gold" />
            </div>
            <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">Winners</span>
          </div>
          <p className="text-3xl font-bold text-gold">{kpis.count}</p>
          <p className="text-[11px] text-text-muted mt-1">Winning products</p>
        </div>
        <div className="kpi-card">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-info/10 flex items-center justify-center">
              <ShoppingCart className="w-4.5 h-4.5 text-info" />
            </div>
            <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">Orders</span>
          </div>
          <p className="text-3xl font-bold text-info">{kpis.totalOrders}</p>
          <p className="text-[11px] text-text-muted mt-1">Total orders for winners</p>
        </div>
        <div className="kpi-card">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-success/10 flex items-center justify-center">
              <DollarSign className="w-4.5 h-4.5 text-success" />
            </div>
            <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">Revenue</span>
          </div>
          <p className="text-3xl font-bold text-success">
            {kpis.totalRevenue >= 1000000
              ? `${(kpis.totalRevenue / 1000000).toFixed(1)}M`
              : `${(kpis.totalRevenue / 1000).toFixed(0)}K`}{' '}
            DA
          </p>
          <p className="text-[11px] text-text-muted mt-1">Total revenue from winners</p>
        </div>
        <div className="kpi-card">
          <div className="flex items-center gap-3 mb-2">
            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', kpis.totalProfit >= 0 ? 'bg-gold/10' : 'bg-danger/10')}>
              <TrendingUp className={cn('w-4.5 h-4.5', kpis.totalProfit >= 0 ? 'text-gold' : 'text-danger')} />
            </div>
            <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">Profit</span>
          </div>
          <p className={cn('text-3xl font-bold', kpis.totalProfit >= 0 ? 'text-gold' : 'text-danger')}>
            {kpis.totalProfit >= 0 ? '+' : ''}
            {kpis.totalProfit >= 1000000
              ? `${(kpis.totalProfit / 1000000).toFixed(1)}M`
              : `${(kpis.totalProfit / 1000).toFixed(0)}K`}{' '}
            DA
          </p>
          <p className="text-[11px] text-text-muted mt-1">Net profit from winners</p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="glass-card p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="header-search flex items-center gap-3 px-4 py-2.5 flex-1 min-w-0">
            <Search className="w-4 h-4 text-text-muted shrink-0" />
            <input
              type="text"
              placeholder="Search products..."
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
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-text-muted" />
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}
              className="select-field text-xs"
            >
              <option value="ALL">All ({filterCounts.ALL || 0})</option>
              <option value="WINNER">Explicitly Marked ({filterCounts.WINNER || 0})</option>
              {WINNER_STATUSES.map(s => (
                <option key={s} value={s}>
                  {statusConfig[s].label} ({filterCounts[s] || 0})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex gap-6">
        {/* Cards Grid */}
        <div className={cn('flex-1 min-w-0', selectedProduct && 'lg:mr-[380px]')}>
          {filteredProducts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <Trophy className="w-6 h-6" />
              </div>
              <p className="text-sm text-text-muted">
                {winnerProducts.length === 0
                  ? 'No winning products yet. Mark products as winners to see them here.'
                  : 'No products match your search.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredProducts.map(product => {
                const stats = getStats(product.id)
                const bestCreative = getBestCreative(product.id)
                const isActive = selectedProduct === product.id
                const confRate = stats.confirmationRate
                const delRate = stats.deliveryRate
                const retRate = stats.returnRate

                return (
                  <div
                    key={product.id}
                    onClick={() => setSelectedProduct(isActive ? null : product.id)}
                    className={cn(
                      'glass-card overflow-hidden cursor-pointer group transition-all',
                      isActive
                        ? 'border-gold/40 shadow-[0_0_20px_rgba(212,175,55,0.1)]'
                        : 'hover:border-gold/20',
                      product.isWinner && 'ring-1 ring-gold/10'
                    )}
                  >
                    {/* Image */}
                    <div className="aspect-[16/9] bg-white/[0.03] border-b border-border relative overflow-hidden">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt=""
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-10 h-10 text-text-muted" />
                        </div>
                      )}

                      {/* Badges */}
                      <div className="absolute top-3 left-3 flex items-center gap-2">
                        {product.isWinner && (
                          <div className="badge bg-gold/20 text-gold border border-gold/30 shadow-[0_0_12px_rgba(212,175,55,0.25)]">
                            <Trophy className="w-3 h-3 mr-1" />
                            Winner
                          </div>
                        )}
                        {product.status === 'SCALING' && (
                          <div className="badge bg-gold/15 text-gold border border-gold/25">
                            <Flame className="w-3 h-3 mr-1" />
                            Scaling
                          </div>
                        )}
                      </div>

                      {product.score != null && (
                        <div className="absolute top-3 right-3 badge bg-black/60 text-text-primary border border-white/10">
                          <Star className="w-3 h-3 mr-1 text-gold" />
                          {product.score}
                        </div>
                      )}

                      {/* Gold glow overlay for winners */}
                      {product.isWinner && (
                        <div className="absolute inset-0 bg-gradient-to-t from-gold/5 via-transparent to-transparent pointer-events-none" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-1">
                        <h3 className="text-base font-semibold group-hover:text-gold transition-colors line-clamp-1">
                          {product.name}
                        </h3>
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            toggleWinner(product)
                          }}
                          className={cn(
                            'p-1.5 rounded-lg transition-all shrink-0 ml-2',
                            product.isWinner
                              ? 'bg-gold/15 text-gold hover:bg-gold/25'
                              : 'bg-white/[0.03] text-text-muted hover:bg-gold/10 hover:text-gold'
                          )}
                          title={product.isWinner ? 'Remove winner status' : 'Mark as winner'}
                        >
                          <Trophy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-xs text-text-muted mb-4">{product.category || 'Uncategorized'}</p>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 gap-2.5 mb-3">
                        <div className="p-2.5 rounded-lg bg-white/[0.03] border border-border">
                          <div className="flex items-center gap-1.5 mb-1">
                            <ShoppingCart className="w-3 h-3 text-text-muted" />
                            <span className="text-[10px] text-text-muted uppercase">Orders</span>
                          </div>
                          <p className="text-sm font-bold">{stats.totalOrders}</p>
                        </div>
                        <div className="p-2.5 rounded-lg bg-white/[0.03] border border-border">
                          <div className="flex items-center gap-1.5 mb-1">
                            <DollarSign className="w-3 h-3 text-text-muted" />
                            <span className="text-[10px] text-text-muted uppercase">Revenue</span>
                          </div>
                          <p className="text-sm font-bold text-success">{(stats.revenue / 1000).toFixed(1)}K DA</p>
                        </div>
                        <div className="p-2.5 rounded-lg bg-white/[0.03] border border-border">
                          <div className="flex items-center gap-1.5 mb-1">
                            <TrendingUp className="w-3 h-3 text-text-muted" />
                            <span className="text-[10px] text-text-muted uppercase">Profit</span>
                          </div>
                          <p className={cn('text-sm font-bold', stats.profit >= 0 ? 'text-gold' : 'text-danger')}>
                            {stats.profit >= 0 ? '+' : ''}
                            {(stats.profit / 1000).toFixed(1)}K DA
                          </p>
                        </div>
                        <div className="p-2.5 rounded-lg bg-white/[0.03] border border-border">
                          <div className="flex items-center gap-1.5 mb-1">
                            <RotateCcw className="w-3 h-3 text-text-muted" />
                            <span className="text-[10px] text-text-muted uppercase">Returns</span>
                          </div>
                          <p className={cn('text-sm font-bold', retRate > 15 ? 'text-danger' : retRate > 8 ? 'text-warning' : 'text-success')}>
                            {retRate.toFixed(1)}%
                          </p>
                        </div>
                      </div>

                      {/* Rates Bar */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-text-muted uppercase">Confirm</span>
                            <span className="text-[10px] font-medium text-text-secondary">{confRate.toFixed(0)}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-success transition-all"
                              style={{ width: `${Math.min(100, confRate)}%` }}
                            />
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-text-muted uppercase">Delivery</span>
                            <span className="text-[10px] font-medium text-text-secondary">{delRate.toFixed(0)}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-info transition-all"
                              style={{ width: `${Math.min(100, delRate)}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Best Creative */}
                      {bestCreative && (
                        <div className="p-2.5 rounded-lg bg-success/5 border border-success/10 mb-3">
                          <div className="flex items-center gap-1.5 mb-1">
                            <ImageIcon className="w-3 h-3 text-success" />
                            <span className="text-[10px] text-success uppercase tracking-wider font-semibold">Best Creative</span>
                          </div>
                          <p className="text-xs font-medium text-text-primary">{bestCreative.name}</p>
                          {bestCreative.performance?.roas != null && (
                            <p className="text-[11px] text-success mt-0.5">{bestCreative.performance.roas}x ROAS</p>
                          )}
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={cn('badge text-[9px]', statusConfig[product.status].bgColor, statusConfig[product.status].color)}>
                            {statusConfig[product.status].label}
                          </span>
                          {isAlreadySelling(product.id) && (
                            <span className="badge text-[9px] bg-green/10 text-green">
                              <ShoppingBag className="w-2.5 h-2.5 mr-0.5" /> Selling
                            </span>
                          )}
                          {product.supplier && (
                            <span className="text-[11px] text-text-muted flex items-center gap-1">
                              <Truck className="w-3 h-3" />
                              {product.supplier.name}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            openNoteModal(product)
                          }}
                          className="p-1.5 rounded-lg hover:bg-white/[0.05] text-text-muted hover:text-text-secondary transition-all"
                          title="Winner notes"
                        >
                          <StickyNote className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ─── Detail Side Panel ──────────────────────────── */}
        {selectedProductData && selectedStats && (
          <div className="hidden lg:block w-[360px] shrink-0">
            <div className="glass-card sticky top-6 overflow-hidden">
              {/* Panel Header */}
              <div className="p-5 border-b border-border">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {selectedProductData.imageUrl ? (
                      <img
                        src={selectedProductData.imageUrl}
                        alt=""
                        className="w-12 h-12 rounded-xl object-cover border border-border"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-white/[0.05] border border-border flex items-center justify-center">
                        <Package className="w-5 h-5 text-text-muted" />
                      </div>
                    )}
                    <div>
                      <h3 className="text-sm font-semibold line-clamp-1">{selectedProductData.name}</h3>
                      <p className="text-[11px] text-text-muted">{selectedProductData.category || 'Uncategorized'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedProduct(null)}
                    className="p-1.5 rounded-lg hover:bg-white/[0.05] text-text-muted"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className={cn('badge text-[9px]', statusConfig[selectedProductData.status].bgColor, statusConfig[selectedProductData.status].color)}>
                    {statusConfig[selectedProductData.status].label}
                  </span>
                  {selectedProductData.isWinner && (
                    <span className="badge text-[9px] bg-gold/15 text-gold border border-gold/20">
                      <Trophy className="w-2.5 h-2.5 mr-0.5" /> Winner
                    </span>
                  )}
                  {selectedProductData.score != null && (
                    <span className="badge text-[9px] bg-white/[0.05] text-text-secondary border border-border">
                      <Star className="w-2.5 h-2.5 mr-0.5 text-gold" /> {selectedProductData.score}
                    </span>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="p-5 border-b border-border space-y-3">
                <h4 className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">Performance</h4>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-2.5 rounded-lg bg-white/[0.03] border border-border">
                    <p className="text-[10px] text-text-muted uppercase mb-0.5">Orders</p>
                    <p className="text-lg font-bold">{selectedStats.totalOrders}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/[0.03] border border-border">
                    <p className="text-[10px] text-text-muted uppercase mb-0.5">Delivered</p>
                    <p className="text-lg font-bold text-success">{selectedStats.deliveredOrders}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/[0.03] border border-border">
                    <p className="text-[10px] text-text-muted uppercase mb-0.5">Revenue</p>
                    <p className="text-lg font-bold text-success">{(selectedStats.revenue / 1000).toFixed(1)}K</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/[0.03] border border-border">
                    <p className="text-[10px] text-text-muted uppercase mb-0.5">Profit</p>
                    <p className={cn('text-lg font-bold', selectedStats.profit >= 0 ? 'text-gold' : 'text-danger')}>
                      {selectedStats.profit >= 0 ? '+' : ''}{(selectedStats.profit / 1000).toFixed(1)}K
                    </p>
                  </div>
                </div>

                {/* Rates */}
                <div className="space-y-2.5 mt-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-text-muted uppercase">Confirmation Rate</span>
                      <span className="text-[11px] font-medium text-success">{selectedStats.confirmationRate.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                      <div className="h-full rounded-full bg-success" style={{ width: `${Math.min(100, selectedStats.confirmationRate)}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-text-muted uppercase">Delivery Rate</span>
                      <span className="text-[11px] font-medium text-info">{selectedStats.deliveryRate.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                      <div className="h-full rounded-full bg-info" style={{ width: `${Math.min(100, selectedStats.deliveryRate)}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-text-muted uppercase">Return Rate</span>
                      <span className={cn('text-[11px] font-medium', selectedStats.returnRate > 15 ? 'text-danger' : selectedStats.returnRate > 8 ? 'text-warning' : 'text-success')}>
                        {selectedStats.returnRate.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', selectedStats.returnRate > 15 ? 'bg-danger' : selectedStats.returnRate > 8 ? 'bg-warning' : 'bg-success')}
                        style={{ width: `${Math.min(100, selectedStats.returnRate)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Supplier */}
              {selectedProductData.supplier && (
                <div className="p-5 border-b border-border">
                  <h4 className="text-[10px] uppercase tracking-wider text-text-muted font-semibold mb-2">Supplier</h4>
                  <div className="p-2.5 rounded-lg bg-white/[0.03] border border-border">
                    <p className="text-xs font-medium">{selectedProductData.supplier.name}</p>
                    <p className="text-[11px] text-text-muted">{selectedProductData.supplier.platform}</p>
                    {selectedProductData.supplier.rating && (
                      <div className="flex items-center gap-1 mt-1">
                        <Star className="w-3 h-3 text-gold fill-gold" />
                        <span className="text-[11px] text-text-secondary">{selectedProductData.supplier.rating}/5</span>
                      </div>
                    )}
                    {selectedProductData.supplier.url && (
                      <a
                        href={selectedProductData.supplier.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="flex items-center gap-1 text-[11px] text-gold hover:underline mt-1.5"
                      >
                        <ExternalLink className="w-3 h-3" /> View Supplier
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Best Creative */}
              {selectedBestCreative && (
                <div className="p-5 border-b border-border">
                  <h4 className="text-[10px] uppercase tracking-wider text-text-muted font-semibold mb-2">Best Creative</h4>
                  <div className="p-2.5 rounded-lg bg-success/5 border border-success/10">
                    <p className="text-xs font-medium text-text-primary">{selectedBestCreative.name}</p>
                    <p className="text-[11px] text-text-muted mt-0.5">{selectedBestCreative.type} &middot; {selectedBestCreative.platform}</p>
                    {selectedBestCreative.performance && (
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        <div>
                          <p className="text-[10px] text-text-muted">ROAS</p>
                          <p className="text-xs font-bold text-success">{selectedBestCreative.performance.roas}x</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-text-muted">CPA</p>
                          <p className="text-xs font-bold">{selectedBestCreative.performance.cpa.toLocaleString()} DA</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-text-muted">CTR</p>
                          <p className="text-xs font-bold">{selectedBestCreative.performance.ctr}%</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Winner Creatives */}
              {selectedWinnerCreatives.length > 0 && (
                <div className="p-5 border-b border-border">
                  <h4 className="text-[10px] uppercase tracking-wider text-text-muted font-semibold mb-2">
                    Winning Creatives ({selectedWinnerCreatives.length})
                  </h4>
                  <div className="space-y-1.5">
                    {selectedWinnerCreatives.map(c => (
                      <div key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-white/[0.03] border border-border">
                        <div className="flex items-center gap-2 min-w-0">
                          <ShieldCheck className="w-3 h-3 text-gold shrink-0" />
                          <span className="text-xs truncate">{c.name}</span>
                        </div>
                        {c.performance?.roas != null && (
                          <span className="text-[10px] text-success font-medium shrink-0">{c.performance.roas}x</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Winner Notes */}
              <div className="p-5 border-b border-border">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">Notes</h4>
                  <button
                    onClick={() => openNoteModal(selectedProductData)}
                    className="text-[10px] text-gold hover:underline"
                  >
                    {selectedProductData.notes ? 'Edit' : 'Add'}
                  </button>
                </div>
                {selectedProductData.notes ? (
                  <p className="text-xs text-text-secondary leading-relaxed">{selectedProductData.notes}</p>
                ) : (
                  <p className="text-[11px] text-text-muted italic">No notes yet</p>
                )}
              </div>

              {/* Actions */}
              <div className="p-5 space-y-2">
                <button
                  onClick={() => toggleWinner(selectedProductData)}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium transition-all',
                    selectedProductData.isWinner
                      ? 'bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20'
                      : 'bg-gold/10 text-gold border border-gold/20 hover:bg-gold/20'
                  )}
                >
                  {selectedProductData.isWinner ? (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5" /> Remove Winner Status
                    </>
                  ) : (
                    <>
                      <Trophy className="w-3.5 h-3.5" /> Mark as Winner
                    </>
                  )}
                </button>
                {isAlreadySelling(selectedProductData.id) ? (
                  <button
                    onClick={() => navigate('/app/product-selling')}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium bg-green/10 text-green border border-green/20 hover:bg-green/20 transition-all"
                  >
                    <Check className="w-3.5 h-3.5" /> Already Selling — View Product
                  </button>
                ) : (
                  <button
                    onClick={() => handleStartSelling(selectedProductData)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium bg-green/10 text-green border border-green/20 hover:bg-green/20 transition-all"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" /> Start Selling
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowCreativeDrawer(selectedProductData.id)
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium bg-white/[0.03] text-text-secondary border border-border hover:bg-white/[0.05] transition-all"
                >
                  <ImageIcon className="w-3.5 h-3.5" /> View All Creatives
                </button>
                <button
                  onClick={() => setShowPerformanceDrawer(selectedProductData.id)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium bg-white/[0.03] text-text-secondary border border-border hover:bg-white/[0.05] transition-all"
                >
                  <BarChart3 className="w-3.5 h-3.5" /> Historical Performance
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── NOTE MODAL ────────────────────────────────────── */}
      {showNoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowNoteModal(null)} />
          <div className="relative bg-bg-surface border border-border rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center">
                  <StickyNote className="w-4 h-4 text-gold" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Winner Notes</h2>
                  <p className="text-xs text-text-muted">
                    {products.find(p => p.id === showNoteModal)?.name}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowNoteModal(null)} className="p-2 rounded-lg hover:bg-white/[0.05] text-text-muted">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                className="textarea-field w-full"
                rows={5}
                placeholder="Add notes about this winning product (strategy, targeting, creative angles, etc.)..."
              />
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <button onClick={() => setShowNoteModal(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => saveNote(showNoteModal)} className="btn-primary">
                <CheckCircle className="w-4 h-4" /> Save Notes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── CREATIVE DRAWER ───────────────────────────────── */}
      {showCreativeDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreativeDrawer(null)} />
          <div className="relative w-full max-w-md bg-bg-surface border-l border-border h-full overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-bg-surface border-b border-border px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center">
                  <ImageIcon className="w-4 h-4 text-gold" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Creatives</h2>
                  <p className="text-xs text-text-muted">
                    {products.find(p => p.id === showCreativeDrawer)?.name}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowCreativeDrawer(null)} className="p-2 rounded-lg hover:bg-white/[0.05] text-text-muted">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              {creatives
                .filter(c => c.productId === showCreativeDrawer)
                .sort((a, b) => {
                  if (a.isWinner && !b.isWinner) return -1
                  if (!a.isWinner && b.isWinner) return 1
                  return (b.performance?.roas || 0) - (a.performance?.roas || 0)
                })
                .map(creative => (
                  <div
                    key={creative.id}
                    className={cn(
                      'p-4 rounded-xl border transition-all',
                      creative.isWinner
                        ? 'bg-gold/5 border-gold/20'
                        : 'bg-white/[0.02] border-border hover:border-white/10'
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm font-medium">{creative.name}</p>
                        <p className="text-[11px] text-text-muted">{creative.type} &middot; {creative.platform}</p>
                      </div>
                      {creative.isWinner && (
                        <span className="badge text-[9px] bg-gold/15 text-gold border border-gold/20">
                          <Trophy className="w-2.5 h-2.5 mr-0.5" /> Winner
                        </span>
                      )}
                    </div>
                    {creative.performance && (
                      <div className="grid grid-cols-4 gap-2 mt-3">
                        <div className="text-center">
                          <p className="text-[10px] text-text-muted">ROAS</p>
                          <p className={cn('text-xs font-bold', creative.performance.roas >= 2 ? 'text-success' : 'text-text-secondary')}>
                            {creative.performance.roas}x
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-text-muted">CPA</p>
                          <p className="text-xs font-bold">{creative.performance.cpa.toLocaleString()}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-text-muted">CTR</p>
                          <p className="text-xs font-bold">{creative.performance.ctr}%</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-text-muted">Orders</p>
                          <p className="text-xs font-bold">{creative.performance.orders}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              {creatives.filter(c => c.productId === showCreativeDrawer).length === 0 && (
                <div className="text-center py-8">
                  <ImageIcon className="w-8 h-8 text-text-muted mx-auto mb-3" />
                  <p className="text-sm text-text-muted">No creatives for this product yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── PERFORMANCE DRAWER ────────────────────────────── */}
      {showPerformanceDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowPerformanceDrawer(null)} />
          <div className="relative w-full max-w-md bg-bg-surface border-l border-border h-full overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-bg-surface border-b border-border px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-gold" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Historical Performance</h2>
                  <p className="text-xs text-text-muted">
                    {products.find(p => p.id === showPerformanceDrawer)?.name}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowPerformanceDrawer(null)} className="p-2 rounded-lg hover:bg-white/[0.05] text-text-muted">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Decision History */}
              <div>
                <h4 className="text-[10px] uppercase tracking-wider text-text-muted font-semibold mb-3">Status History</h4>
                {(() => {
                  const product = products.find(p => p.id === showPerformanceDrawer)
                  if (!product?.decisionHistory?.length) {
                    return <p className="text-[11px] text-text-muted italic">No status changes recorded.</p>
                  }
                  return (
                    <div className="space-y-2">
                      {product.decisionHistory
                        .slice()
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .map(dh => (
                          <div key={dh.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-white/[0.03] border border-border">
                            <div className="w-2 h-2 rounded-full bg-gold mt-1.5 shrink-0" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={cn('badge text-[8px]', statusConfig[dh.oldStatus]?.bgColor, statusConfig[dh.oldStatus]?.color)}>
                                  {dh.oldStatus}
                                </span>
                                <ArrowUpRight className="w-3 h-3 text-text-muted" />
                                <span className={cn('badge text-[8px]', statusConfig[dh.newStatus]?.bgColor, statusConfig[dh.newStatus]?.color)}>
                                  {dh.newStatus}
                                </span>
                              </div>
                              {dh.reason && <p className="text-[11px] text-text-muted mt-1">{dh.reason}</p>}
                              <p className="text-[10px] text-text-muted mt-1 flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" /> {formatDate(dh.createdAt)}
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>
                  )
                })()}
              </div>

              {/* Orders Timeline */}
              <div>
                <h4 className="text-[10px] uppercase tracking-wider text-text-muted font-semibold mb-3">
                  Recent Orders ({selectedProductOrders.length})
                </h4>
                {selectedProductOrders.length === 0 ? (
                  <p className="text-[11px] text-text-muted italic">No orders yet.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedProductOrders
                      .slice()
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .slice(0, 20)
                      .map(order => (
                        <div key={order.id} className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.03] border border-border">
                          <div>
                            <p className="text-xs font-medium">{order.orderNumber}</p>
                            <p className="text-[10px] text-text-muted">{order.customer.name}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-medium text-gold">{order.sellingPriceDzd.toLocaleString()} DA</p>
                            <span className={cn(
                              'badge text-[8px]',
                              order.status === 'DELIVERED' ? 'bg-success/12 text-success' :
                              order.status === 'RETURNED' ? 'bg-danger/12 text-danger' :
                              order.status === 'CANCELLED' ? 'bg-danger/12 text-danger' :
                              'bg-white/[0.05] text-text-muted'
                            )}>
                              {order.status}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Expenses Breakdown */}
              <div>
                <h4 className="text-[10px] uppercase tracking-wider text-text-muted font-semibold mb-3">Expenses</h4>
                {(() => {
                  const productExpenses = expenses.filter(e => e.productId === showPerformanceDrawer)
                  if (productExpenses.length === 0) {
                    return <p className="text-[11px] text-text-muted italic">No expenses recorded.</p>
                  }
                  const total = productExpenses.reduce((sum, e) => sum + e.amountDzd, 0)
                  return (
                    <div className="space-y-1.5">
                      {productExpenses.slice(0, 10).map(exp => (
                        <div key={exp.id} className="flex items-center justify-between p-2 rounded-lg bg-white/[0.03] border border-border">
                          <div>
                            <p className="text-xs">{exp.description}</p>
                            <p className="text-[10px] text-text-muted">{exp.category}</p>
                          </div>
                          <p className="text-xs font-medium text-danger">{exp.amountDzd.toLocaleString()} DA</p>
                        </div>
                      ))}
                      <div className="flex items-center justify-between p-2 rounded-lg bg-danger/5 border border-danger/10">
                        <p className="text-xs font-semibold">Total Expenses</p>
                        <p className="text-xs font-bold text-danger">{total.toLocaleString()} DA</p>
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
