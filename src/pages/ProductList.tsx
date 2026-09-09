import { useState, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Plus,
  Search,
  ExternalLink,
  Package,
  Trash2,
  Rocket,
  X,
  AlertTriangle,
} from 'lucide-react'
import { useAppState } from '@/stores/AppState'
import { cn, formatCurrency } from '@/lib/utils'
import type { Product, ProductStatus, SellingProduct } from '@/types'

const statusFilters: (ProductStatus | 'ALL')[] = ['ALL', 'TESTING', 'APPROVED', 'STANDBY', 'REJECTED', 'SCALING']

function formatDzd(amount: number): string {
  return amount.toLocaleString('fr-DZ') + ' DA'
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 10)
}

export function ProductList() {
  const navigate = useNavigate()
  const {
    products, sellingProducts, deleteProduct, addSellingProduct,
    addActivityLog, addNotification, currentUser,
  } = useAppState()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [deleteModalId, setDeleteModalId] = useState<string | null>(null)
  const [pushModalProduct, setPushModalProduct] = useState<Product | null>(null)
  const [pushForm, setPushForm] = useState({
    sellingPriceDzd: '',
    costPriceDzd: '',
    stock: '',
    weight: '',
  })
  const [pushError, setPushError] = useState('')
  const [pushSuccess, setPushSuccess] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }, [])

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.supplier?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'ALL' || product.status === statusFilter
    return matchesSearch && matchesStatus
  })

  // ─── Delete Product Research ─────────────────────────────
  const handleDelete = useCallback((id: string) => {
    const product = products.find(p => p.id === id)
    deleteProduct(id)
    setDeleteModalId(null)
    showToast(`"${product?.name}" removed from Product Research`)
    addActivityLog({
      id: generateId(),
      action: 'PRODUCT_UPDATED',
      userId: currentUser?.id || '',
      entityType: 'PRODUCT',
      entityId: id,
      entityName: product?.name || '',
      details: 'Product deleted from Product Research',
      createdAt: new Date(),
    })
  }, [products, deleteProduct, addActivityLog, currentUser, showToast])

  // ─── Check if already in selling products ────────────────
  const isAlreadySelling = useCallback((productId: string): boolean => {
    return sellingProducts.some(sp => sp.researchProductId === productId)
  }, [sellingProducts])

  // ─── Open Push Modal ─────────────────────────────────────
  const openPushModal = useCallback((product: Product) => {
    if (isAlreadySelling(product.id)) {
      showToast('This product is already in Selling Products', 'error')
      return
    }
    setPushError('')
    setPushSuccess(null)
    // Prefill from product research data
    const sellingPrice = product.codScenario?.sellingPriceDzd || 0
    const costPrice = product.costScenario?.landedCostDzd
      ? Math.round(product.costScenario.landedCostDzd / product.costScenario.quantity)
      : 0
    const quantity = product.costScenario?.quantity || 0
    const weightField = product.fields?.find(f => f.fieldName === 'weight')
    const weight = weightField?.currentValue?.replace(/[^0-9]/g, '') || ''

    setPushForm({
      sellingPriceDzd: sellingPrice ? String(sellingPrice) : '',
      costPriceDzd: costPrice ? String(costPrice) : '',
      stock: quantity ? String(quantity) : '',
      weight,
    })
    setPushModalProduct(product)
  }, [isAlreadySelling, showToast])

  // ─── Handle Push to Selling ──────────────────────────────
  const handlePush = useCallback(async () => {
    if (!pushModalProduct) return
    setPushError('')

    const sellingPrice = Number(pushForm.sellingPriceDzd) || 0
    const costPrice = Number(pushForm.costPriceDzd) || 0
    const stock = Number(pushForm.stock) || 0
    const weight = Number(pushForm.weight) || undefined

    if (!sellingPrice) {
      setPushError('Selling Price is required')
      return
    }
    if (!stock) {
      setPushError('Quantity (stock) is required')
      return
    }

    // Check duplicate again before pushing
    if (isAlreadySelling(pushModalProduct.id)) {
      setPushError('This product is already in Selling Products')
      return
    }

    const now = new Date()
    const newSellingProduct: SellingProduct = {
      id: generateId(),
      name: pushModalProduct.name,
      sku: pushModalProduct.sourceProductId || `SKU-${generateId().slice(-6).toUpperCase()}`,
      description: pushModalProduct.description,
      imageUrl: pushModalProduct.imageUrl,
      sellingPriceDzd: sellingPrice,
      costPriceDzd: costPrice,
      stock: stock,
      availableStock: stock,
      status: 'ACTIVE',
      weight: weight,
      supplier: pushModalProduct.supplier?.name,
      supplierRef: pushModalProduct.sourceProductId,
      notes: `Pushed from Product Research. Original status: ${pushModalProduct.status}`,
      researchProductId: pushModalProduct.id,
      createdAt: now,
      updatedAt: now,
    }

    addSellingProduct(newSellingProduct)
    addActivityLog({
      id: generateId(),
      action: 'PRODUCT_CREATED',
      userId: currentUser?.id || '',
      entityType: 'SELLING_PRODUCT',
      entityId: newSellingProduct.id,
      entityName: newSellingProduct.name,
      details: `Product pushed from Research to Selling: ${pushModalProduct.name}`,
      createdAt: now,
    })
    addNotification({
      id: generateId(),
      type: 'PRODUCT_STATUS_CHANGED',
      title: 'Product Added to Selling',
      message: `${pushModalProduct.name} is now available in Product Selling.`,
      link: '/app/product-selling',
      isRead: false,
      userId: currentUser?.id || '',
      createdAt: now,
    })

    setPushSuccess(pushModalProduct.name)
    setTimeout(() => {
      setPushModalProduct(null)
      setPushSuccess(null)
    }, 2000)
  }, [pushModalProduct, pushForm, isAlreadySelling, addSellingProduct, addActivityLog, addNotification, currentUser])

  // Gross margin for push preview
  const pushMargin = pushModalProduct
    ? (Number(pushForm.sellingPriceDzd) || 0) - (Number(pushForm.costPriceDzd) || 0)
    : 0

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-2xl text-sm font-medium transition-all',
          toast.type === 'success' ? 'bg-green-500/90 text-white' : 'bg-danger/90 text-white'
        )}>
          {toast.message}
        </div>
      )}

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Product Research</h1>
          <p className="text-text-secondary mt-1">{products.length} total products</p>
        </div>
        <button
          onClick={() => navigate('/app/research/new')}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" />
          Add Product
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-charcoal border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold-muted transition-colors"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {statusFilters.map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
                statusFilter === status
                  ? 'bg-gold-muted text-gold border border-gold/30'
                  : 'bg-charcoal text-text-secondary border border-border hover:border-border-light'
              )}
            >
              {status === 'ALL' ? 'All' : status}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts.map((product) => {
          const alreadySelling = isAlreadySelling(product.id)
          return (
            <div key={product.id} className="glass-card p-4 hover:border-border-light transition-all group">
              <Link to={`/app/research/${product.id}`} className="block">
                <div className="flex items-start gap-4">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-lg bg-charcoal flex items-center justify-center flex-shrink-0">
                      <span className="text-2xl text-text-muted">📦</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-text-primary truncate group-hover:text-gold transition-colors">
                      {product.name}
                    </h3>
                    <p className="text-xs text-text-muted mt-1 truncate">
                      {product.supplier?.name || 'No supplier'}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={cn('status-badge text-[10px]', `status-${product.status.toLowerCase()}`)}>
                        {product.status}
                      </span>
                      {product.score && (
                        <span className="text-xs font-semibold text-gold">
                          {product.score}/100
                        </span>
                      )}
                      {alreadySelling && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green/10 text-green font-medium">
                          ✓ Selling
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Product Details */}
                <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-text-muted">Cost</p>
                    <p className="text-text-primary font-medium">
                      {product.costScenario
                        ? formatCurrency(product.costScenario.purchaseCostRmb, 'RMB')
                        : '—'
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-text-muted">Selling</p>
                    <p className="text-text-primary font-medium">
                      {product.codScenario
                        ? formatCurrency(product.codScenario.sellingPriceDzd, 'DZD')
                        : '—'
                      }
                    </p>
                  </div>
                </div>
              </Link>

              {/* Actions */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                <span className="text-xs text-text-muted">
                  {new Date(product.updatedAt).toLocaleDateString()}
                </span>
                <div className="flex items-center gap-1">
                  {product.sourceUrl && (
                    <a
                      href={product.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted hover:text-text-secondary transition-colors"
                      title="Open source"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      openPushModal(product)
                    }}
                    className={cn(
                      'p-1.5 rounded-lg transition-colors',
                      alreadySelling
                        ? 'text-green hover:bg-green/10'
                        : 'text-text-muted hover:bg-gold/10 hover:text-gold'
                    )}
                    title={alreadySelling ? 'Already in Selling Products' : 'Push to Selling Products'}
                  >
                    <Rocket className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteModalId(product.id)
                    }}
                    className="p-1.5 rounded-lg hover:bg-danger/10 text-text-muted hover:text-danger transition-colors"
                    title="Delete from Research"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {filteredProducts.length === 0 && (
        <div className="text-center py-12">
          <Package className="w-12 h-12 text-text-muted mx-auto mb-4" />
          <p className="text-text-secondary">No products found</p>
          <p className="text-text-muted text-sm mt-1">Try adjusting your search or filters</p>
        </div>
      )}

      {/* ─── Delete Confirmation Modal ────────────────────────── */}
      {deleteModalId && (() => {
        const product = products.find(p => p.id === deleteModalId)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="glass-card w-full max-w-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-danger/10">
                  <AlertTriangle className="w-5 h-5 text-danger" />
                </div>
                <h3 className="text-lg font-heading font-semibold text-text-primary">Delete Product</h3>
              </div>
              <p className="text-sm text-text-muted mb-2">
                Are you sure you want to delete <strong className="text-text-primary">"{product?.name}"</strong> from Product Research?
              </p>
              <p className="text-xs text-text-muted mb-6">
                This will remove the product from Product Research only. Any linked Selling Product will not be affected.
              </p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setDeleteModalId(null)} className="btn-secondary">Cancel</button>
                <button onClick={() => handleDelete(deleteModalId)} className="btn-primary bg-danger hover:bg-danger/80">Delete</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ─── Push to Selling Products Modal ──────────────────── */}
      {pushModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            {pushSuccess ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-green/10 flex items-center justify-center mx-auto mb-4">
                  <Rocket className="w-8 h-8 text-green" />
                </div>
                <h3 className="text-lg font-heading font-semibold text-text-primary mb-2">Product Pushed!</h3>
                <p className="text-sm text-text-muted">{pushSuccess} is now in Selling Products</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-heading font-semibold text-text-primary">
                    Push Product to Selling Products
                  </h2>
                  <button onClick={() => setPushModalProduct(null)} className="p-1 rounded-lg hover:bg-white/[0.05]">
                    <X className="w-5 h-5 text-text-muted" />
                  </button>
                </div>

                {/* Product Info */}
                <div className="flex items-center gap-3 mb-6 p-3 rounded-xl bg-white/[0.02] border border-border">
                  {pushModalProduct.imageUrl && (
                    <img src={pushModalProduct.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-text-primary">{pushModalProduct.name}</p>
                    <p className="text-xs text-text-muted">{pushModalProduct.supplier?.name || 'No supplier'}</p>
                  </div>
                </div>

                {/* Form */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-text-muted mb-1 block">Selling Price (DA) *</label>
                    <input
                      type="number"
                      value={pushForm.sellingPriceDzd}
                      onChange={e => setPushForm(f => ({ ...f, sellingPriceDzd: e.target.value }))}
                      className="input-field w-full"
                      placeholder="4500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-text-muted mb-1 block">Cost Price (DA) *</label>
                    <input
                      type="number"
                      value={pushForm.costPriceDzd}
                      onChange={e => setPushForm(f => ({ ...f, costPriceDzd: e.target.value }))}
                      className="input-field w-full"
                      placeholder="2760"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-text-muted mb-1 block">Quantity *</label>
                    <input
                      type="number"
                      value={pushForm.stock}
                      onChange={e => setPushForm(f => ({ ...f, stock: e.target.value }))}
                      className="input-field w-full"
                      placeholder="50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-text-muted mb-1 block">Weight (g)</label>
                    <input
                      type="number"
                      value={pushForm.weight}
                      onChange={e => setPushForm(f => ({ ...f, weight: e.target.value }))}
                      className="input-field w-full"
                      placeholder="185"
                    />
                  </div>
                </div>

                {/* Gross Margin Preview */}
                <div className="mt-4 p-3 rounded-xl bg-white/[0.02] border border-border">
                  <p className="text-xs text-text-muted mb-2">Gross Margin / Unit</p>
                  <p className={cn(
                    'text-lg font-semibold',
                    pushMargin > 0 ? 'text-green' : pushMargin < 0 ? 'text-danger' : 'text-text-muted'
                  )}>
                    {formatDzd(pushMargin)}
                  </p>
                </div>

                {/* Error */}
                {pushError && (
                  <p className="mt-3 text-sm text-danger">{pushError}</p>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-2 mt-6">
                  <button onClick={() => setPushModalProduct(null)} className="btn-secondary">Cancel</button>
                  <button onClick={handlePush} className="btn-primary flex items-center gap-2">
                    <Rocket className="w-4 h-4" /> Push Product
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
