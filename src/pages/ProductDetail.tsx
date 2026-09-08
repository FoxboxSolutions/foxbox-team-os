import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  ArrowLeft,
  ExternalLink,
  Package,
  Truck,
  Calculator,
  TrendingUp,
  FileText,
  History,
  Edit3,
  Trash2,
  Save,
  X,
  ChevronDown,
  AlertTriangle
} from 'lucide-react'
import { useAppState } from '@/stores/AppState'
import { cn, formatCurrency, convertCurrency } from '@/lib/utils'
import { defaultCurrencyRates } from '@/lib/mock-data'
import type { ProductField, SourceType, Product, ProductStatus } from '@/types'

const sourceBadgeColors: Record<SourceType, string> = {
  AUTO: 'badge-auto',
  MANUAL: 'badge-manual',
  ESTIMATED: 'badge-estimated',
  MISSING: 'badge-missing',
}

const statusOptions: { value: ProductStatus; label: string; color: string }[] = [
  { value: 'APPROVED', label: 'Approved', color: 'text-success' },
  { value: 'REJECTED', label: 'Rejected', color: 'text-danger' },
  { value: 'STANDBY', label: 'Standby', color: 'text-orange' },
  { value: 'TESTING', label: 'Testing', color: 'text-blue' },
  { value: 'SCALING', label: 'Scaling', color: 'text-purple' },
  { value: 'RESEARCH', label: 'Research', color: 'text-info' },
]

export function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { products, updateProduct, deleteProduct, addActivityLog, currentUser } = useAppState()
  const [product, setProduct] = useState(products.find(p => p.id === id))
  const [activeTab, setActiveTab] = useState<'overview' | 'supplier' | 'logistics' | 'calculator' | 'cod' | 'score' | 'notes' | 'history'>('overview')
  
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editCategory, setEditCategory] = useState('')
  
  // Status dropdown state
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)
  
  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  
  // Notes state
  const [notes, setNotes] = useState('')

  // Load product from context
  useEffect(() => {
    if (!product && id) {
      const found = products.find(p => p.id === id)
      if (found) {
        setProduct(found)
        setNotes(found.notes || '')
      }
    } else if (product) {
      setNotes(product.notes || '')
    }
  }, [id, products, product])

  // Initialize edit fields when entering edit mode
  useEffect(() => {
    if (isEditing && product) {
      setEditName(product.name)
      setEditDescription(product.description || '')
      setEditCategory(product.category || '')
    }
  }, [isEditing, product])

  // Save product via context
  const saveProduct = (updatedProduct: Product) => {
    updateProduct(updatedProduct)
    setProduct(updatedProduct)
  }

  // Handle status change
  const handleStatusChange = (newStatus: ProductStatus) => {
    if (!product) return
    
    const oldStatus = product.status
    const updatedProduct: Product = {
      ...product,
      status: newStatus,
      updatedAt: new Date(),
      decisionHistory: [
        ...product.decisionHistory,
        {
          id: `dh_${Date.now()}`,
          productId: product.id,
          oldStatus,
          newStatus,
          reason: `Status changed from ${oldStatus} to ${newStatus}`,
          createdAt: new Date(),
          createdBy: 'User',
        }
      ]
    }
    
    saveProduct(updatedProduct)
    setShowStatusDropdown(false)
  }

  // Handle save edit
  const handleSaveEdit = () => {
    if (!product) return
    
    const updatedProduct: Product = {
      ...product,
      name: editName,
      description: editDescription,
      category: editCategory,
      updatedAt: new Date(),
    }
    
    saveProduct(updatedProduct)
    setIsEditing(false)
  }

  // Handle save notes
  const handleSaveNotes = () => {
    if (!product) return
    
    const updatedProduct: Product = {
      ...product,
      notes,
      updatedAt: new Date(),
    }
    
    saveProduct(updatedProduct)
  }

  // Handle delete
  const handleDelete = () => {
    if (!product) return
    deleteProduct(product.id)
    addActivityLog({
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 10),
      action: 'PRODUCT_UPDATED',
      userId: currentUser?.id || 'u1',
      entityType: 'PRODUCT',
      entityId: product.id,
      entityName: product.name,
      details: 'Product deleted',
      createdAt: new Date(),
    })
    setShowDeleteModal(false)
    navigate('/app/research')
  }

  if (!product) {
    return (
      <div className="text-center py-12">
        <Package className="w-12 h-12 text-text-muted mx-auto mb-4" />
        <p className="text-text-secondary">Product not found</p>
        <button onClick={() => navigate('/app/research')} className="btn-secondary mt-4">
          Back to Products
        </button>
      </div>
    )
  }

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: Package },
    { id: 'supplier' as const, label: 'Supplier', icon: ExternalLink },
    { id: 'logistics' as const, label: 'Logistics', icon: Truck },
    { id: 'calculator' as const, label: 'Cost', icon: Calculator },
    { id: 'cod' as const, label: 'COD', icon: TrendingUp },
    { id: 'score' as const, label: 'Score', icon: TrendingUp },
    { id: 'notes' as const, label: 'Notes', icon: FileText },
    { id: 'history' as const, label: 'History', icon: History },
  ]

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={() => navigate('/app/research')}
        className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm">Back to Products</span>
      </button>

      {/* Product Header */}
      <div className="glass-card p-6">
        <div className="flex flex-col md:flex-row md:items-start gap-6">
          {/* Product Image */}
          {product.imageUrl ? (
            <img 
              src={product.imageUrl} 
              alt={product.name}
              className="w-32 h-32 rounded-xl object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-32 h-32 rounded-xl bg-charcoal flex items-center justify-center flex-shrink-0">
              <span className="text-4xl text-text-muted">📦</span>
            </div>
          )}

          {/* Product Info */}
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {isEditing ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="input-field text-xl font-bold"
                      placeholder="Product name"
                    />
                    <input
                      type="text"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="input-field"
                      placeholder="Description"
                    />
                    <input
                      type="text"
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      className="input-field"
                      placeholder="Category"
                    />
                  </div>
                ) : (
                  <>
                    <h1 className="text-xl font-bold text-text-primary">{product.name}</h1>
                    {product.description && (
                      <p className="text-text-secondary mt-1">{product.description}</p>
                    )}
                  </>
                )}
                
                <div className="flex items-center gap-3 mt-3">
                  {/* Status Badge */}
                  <div className="relative">
                    <button
                      onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                      className={cn('status-badge flex items-center gap-1.5 cursor-pointer hover:opacity-80', `status-${product.status.toLowerCase()}`)}
                    >
                      {product.status}
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    
                    {/* Status Dropdown */}
                    {showStatusDropdown && (
                      <div className="absolute top-full left-0 mt-1 w-48 bg-charcoal border border-border rounded-lg shadow-lg z-50 py-1">
                        {statusOptions.map((option) => (
                          <button
                            key={option.value}
                            onClick={() => handleStatusChange(option.value)}
                            className={cn(
                              'w-full px-4 py-2 text-left text-sm hover:bg-surface-hover flex items-center gap-2',
                              product.status === option.value && 'bg-gold-muted'
                            )}
                          >
                            <span className={cn('w-2 h-2 rounded-full', option.color.replace('text-', 'bg-'))} />
                            {option.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {product.score && (
                    <span className="text-lg font-bold text-gold">{product.score}/100</span>
                  )}
                  {product.category && (
                    <span className="text-xs text-text-muted bg-charcoal px-2 py-1 rounded">
                      {product.category}
                    </span>
                  )}
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex items-center gap-2 ml-4">
                {isEditing ? (
                  <>
                    <button
                      onClick={handleSaveEdit}
                      className="btn-primary text-sm"
                    >
                      <Save className="w-4 h-4" />
                      Save
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="btn-secondary text-sm"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="btn-secondary text-sm"
                    >
                      <Edit3 className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => setShowDeleteModal(true)}
                      className="btn-secondary text-sm text-danger hover:bg-danger/10 hover:border-danger/30"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                    {product.sourceUrl && (
                      <a
                        href={product.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary text-sm"
                      >
                        <ExternalLink className="w-4 h-4" />
                        View Source
                      </a>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Quick Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border">
              <div>
                <p className="text-xs text-text-muted">Supplier</p>
                <p className="text-sm text-text-primary font-medium">{product.supplier?.name || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Platform</p>
                <p className="text-sm text-text-primary font-medium">{product.sourcePlatform}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Last Analyzed</p>
                <p className="text-sm text-text-primary font-medium">
                  {product.lastAnalyzedAt 
                    ? new Date(product.lastAnalyzedAt).toLocaleDateString()
                    : '—'
                  }
                </p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Variants</p>
                <p className="text-sm text-text-primary font-medium">{product.variants.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-2 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap border-b-2 -mb-px',
              activeTab === tab.id
                ? 'text-gold border-gold'
                : 'text-text-secondary border-transparent hover:text-text-primary'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="glass-card p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-text-primary">Product Overview</h2>
            
            {/* Gallery */}
            <div>
              <h3 className="text-sm font-medium text-text-secondary mb-3">Gallery</h3>
              <div className="grid grid-cols-4 gap-3">
                {product.creatives.length > 0 ? (
                  product.creatives.map((creative) => (
                    <div key={creative.id} className="aspect-square rounded-lg overflow-hidden bg-charcoal">
                      <img src={creative.thumbnailUrl || creative.storageUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))
                ) : (
                  <div className="col-span-4 text-center py-8 text-text-muted">
                    No creatives uploaded yet
                  </div>
                )}
              </div>
            </div>

            {/* Product Fields */}
            <div>
              <h3 className="text-sm font-medium text-text-secondary mb-3">Extracted Data</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {product.fields.map((field) => (
                  <FieldDisplay key={field.fieldName} field={field} />
                ))}
                {product.fields.length === 0 && (
                  <p className="col-span-3 text-text-muted text-sm">No data extracted yet</p>
                )}
              </div>
            </div>

            {/* Variants */}
            {product.variants.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-text-secondary mb-3">Variants</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-4 text-text-muted font-medium">Name</th>
                        <th className="text-left py-3 px-4 text-text-muted font-medium">SKU</th>
                        <th className="text-left py-3 px-4 text-text-muted font-medium">Price (RMB)</th>
                        <th className="text-left py-3 px-4 text-text-muted font-medium">Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {product.variants.map((variant) => (
                        <tr key={variant.id} className="border-b border-border/50">
                          <td className="py-3 px-4 text-text-primary">{variant.name}</td>
                          <td className="py-3 px-4 text-text-secondary">{variant.sku || '—'}</td>
                          <td className="py-3 px-4 text-gold font-medium">{formatCurrency(variant.priceRmb, 'RMB')}</td>
                          <td className="py-3 px-4 text-text-secondary">{variant.stock || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'supplier' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-text-primary">Supplier Data</h2>
            {product.supplier ? (
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-text-muted">Supplier Name</label>
                    <p className="text-text-primary">{product.supplier.name}</p>
                  </div>
                  <div>
                    <label className="text-xs text-text-muted">Platform</label>
                    <p className="text-text-primary">{product.supplier.platform}</p>
                  </div>
                  <div>
                    <label className="text-xs text-text-muted">Rating</label>
                    <p className="text-text-primary">{product.supplier.rating || '—'}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-text-muted">Supplier URL</label>
                    <a href={product.supplier.url} target="_blank" rel="noopener noreferrer" className="text-gold hover:underline block">
                      {product.supplier.url}
                    </a>
                  </div>
                  <div>
                    <label className="text-xs text-text-muted">Notes</label>
                    <p className="text-text-primary">{product.supplier.notes || '—'}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-text-muted">No supplier data available</p>
            )}
          </div>
        )}

        {activeTab === 'logistics' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-text-primary">Logistics</h2>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-text-muted">Unit Weight</label>
                  <p className="text-text-primary">
                    {product.fields.find(f => f.fieldName === 'weight')?.currentValue || '—'}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-text-muted">Dimensions</label>
                  <p className="text-text-primary">
                    {product.fields.find(f => f.fieldName === 'dimensions')?.currentValue || '—'}
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-text-muted">Shipping Profile</label>
                  <p className="text-text-primary">{product.shippingProfile?.name || '—'}</p>
                </div>
                <div>
                  <label className="text-xs text-text-muted">Shipping Rate</label>
                  <p className="text-text-primary">
                    {product.shippingProfile 
                      ? `$${product.shippingProfile.rate}/${product.shippingProfile.rateUnit}`
                      : '—'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'calculator' && (
          <CostCalculator product={product} />
        )}

        {activeTab === 'cod' && (
          <CODCalculator product={product} />
        )}

        {activeTab === 'score' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-text-primary">Product Score</h2>
            {product.score ? (
              <div className="text-center py-8">
                <div className="text-6xl font-bold text-gold mb-2">{product.score}</div>
                <div className="text-xl text-text-secondary">/100</div>
                <div className={cn(
                  'mt-4 text-lg font-semibold',
                  product.score >= 80 ? 'text-success' : 
                  product.score >= 60 ? 'text-warning' : 'text-danger'
                )}>
                  {product.score >= 80 ? 'EXCELLENT POTENTIAL' : 
                   product.score >= 60 ? 'MODERATE POTENTIAL' : 'LOW POTENTIAL'}
                </div>
              </div>
            ) : (
              <p className="text-text-muted text-center py-8">Score not calculated yet</p>
            )}
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary">Notes</h2>
              <button
                onClick={handleSaveNotes}
                className="btn-primary text-sm"
              >
                <Save className="w-4 h-4" />
                Save Notes
              </button>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this product..."
              className="w-full h-48 bg-charcoal border border-border rounded-lg p-4 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold-muted resize-none"
            />
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-text-primary">Decision History</h2>
            {product.decisionHistory.length > 0 ? (
              <div className="space-y-4">
                {product.decisionHistory.map((decision) => (
                  <div key={decision.id} className="flex items-start gap-4 p-4 bg-surface rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-gold-muted flex items-center justify-center flex-shrink-0">
                      <History className="w-5 h-5 text-gold" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={cn('status-badge text-[10px]', `status-${decision.oldStatus.toLowerCase()}`)}>
                          {decision.oldStatus}
                        </span>
                        <span className="text-text-muted">→</span>
                        <span className={cn('status-badge text-[10px]', `status-${decision.newStatus.toLowerCase()}`)}>
                          {decision.newStatus}
                        </span>
                      </div>
                      {decision.reason && (
                        <p className="text-sm text-text-secondary mt-2">{decision.reason}</p>
                      )}
                      <p className="text-xs text-text-muted mt-2">
                        {new Date(decision.createdAt).toLocaleString()} by {decision.createdBy}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-text-muted text-center py-8">No decision history yet</p>
            )}
          </div>
        )}
      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="glass-card p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-danger/20">
                <AlertTriangle className="w-5 h-5 text-danger" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary">Delete Product</h3>
            </div>
            <p className="text-text-secondary mb-6">
              Are you sure you want to delete <span className="text-text-primary font-medium">{product.name}</span>? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="btn-primary bg-danger hover:bg-danger/90"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Sub-components
function FieldDisplay({ field }: { field: ProductField }) {
  return (
    <div className="bg-surface rounded-lg p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-text-muted capitalize">{field.fieldName}</span>
        <span className={cn('badge text-[10px]', sourceBadgeColors[field.sourceType])}>
          {field.sourceType}
        </span>
      </div>
      <p className="text-sm text-text-primary font-medium">
        {field.currentValue || (
          <span className="text-text-muted italic">Missing</span>
        )}
      </p>
    </div>
  )
}

function CostCalculator({ product }: { product: Product }) {
  const [quantity, setQuantity] = useState(product.costScenario?.quantity || 100)
  const rates = defaultCurrencyRates

  const unitPriceRmb = product.variants[0]?.priceRmb || 0
  const totalProductCostRmb = unitPriceRmb * quantity
  const weightKg = 0.18 // From fields
  const shippingCost = product.shippingProfile 
    ? Math.max(quantity * weightKg, product.shippingProfile.minimumCharge) * product.shippingProfile.rate
    : 0
  
  const otherCosts = 20
  const totalUsd = convertCurrency(totalProductCostRmb, 'RMB', 'USD', rates) + shippingCost + otherCosts
  const totalDzd = totalUsd * rates.usdToDzd
  const unitCostUsd = totalUsd / quantity
  const unitCostDzd = totalDzd / quantity

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-text-primary">Cost Calculator</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Inputs */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-text-secondary">Inputs</h3>
          
          <div>
            <label className="text-xs text-text-muted">Unit Price (RMB)</label>
            <p className="text-gold font-medium">{formatCurrency(unitPriceRmb, 'RMB')}</p>
          </div>
          
          <div>
            <label className="text-xs text-text-muted">Quantity</label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="input-field mt-1"
            />
          </div>

          <div>
            <label className="text-xs text-text-muted">Shipping Profile</label>
            <p className="text-text-primary">{product.shippingProfile?.name || 'None'}</p>
          </div>
        </div>

        {/* Outputs */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-text-secondary">Outputs</h3>
          
          <div className="bg-surface rounded-lg p-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-text-muted">Product Cost</span>
              <span className="text-text-primary">{formatCurrency(totalProductCostRmb, 'RMB')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Shipping</span>
              <span className="text-text-primary">${shippingCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Other Costs</span>
              <span className="text-text-primary">${otherCosts.toFixed(2)}</span>
            </div>
            <div className="border-t border-border pt-3 flex justify-between">
              <span className="text-text-primary font-medium">Total Investment</span>
              <div className="text-right">
                <p className="text-gold font-bold">{formatCurrency(totalUsd, 'USD')}</p>
                <p className="text-xs text-text-muted">{formatCurrency(totalDzd, 'DZD')}</p>
              </div>
            </div>
          </div>

          <div className="bg-gold-muted rounded-lg p-4">
            <p className="text-xs text-text-muted mb-1">Landed Cost per Unit</p>
            <p className="text-2xl font-bold text-gold">{formatCurrency(unitCostUsd, 'USD')}</p>
            <p className="text-sm text-text-secondary">{formatCurrency(unitCostDzd, 'DZD')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function CODCalculator({ product }: { product: Product }) {
  const cod = product.codScenario

  if (!cod) {
    return (
      <div className="text-center py-8 text-text-muted">
        <p>Configure COD scenario to see calculations</p>
      </div>
    )
  }

  const landedCostDzd = product.costScenario?.landedCostDzd || 0
  const grossMargin = cod.sellingPriceDzd - landedCostDzd - cod.deliveryFeeDzd
  const costPerOrder = cod.advertisingCpaDzd + (cod.confirmationCostDzd * cod.confirmationRate) + (cod.returnCostDzd * cod.returnRate)
  const expectedProfit = (grossMargin * cod.confirmationRate * cod.deliveryRate) - costPerOrder

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-text-primary">COD Economics</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Revenue */}
        <div className="bg-surface rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-medium text-text-secondary">Revenue</h3>
          <div className="flex justify-between">
            <span className="text-text-muted">Selling Price</span>
            <span className="text-text-primary">{formatCurrency(cod.sellingPriceDzd, 'DZD')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Delivery Fee</span>
            <span className="text-text-primary">{formatCurrency(cod.deliveryFeeDzd, 'DZD')}</span>
          </div>
        </div>

        {/* Costs */}
        <div className="bg-surface rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-medium text-text-secondary">Costs</h3>
          <div className="flex justify-between">
            <span className="text-text-muted">CPA</span>
            <span className="text-text-primary">{formatCurrency(cod.advertisingCpaDzd, 'DZD')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Confirmation</span>
            <span className="text-text-primary">{formatCurrency(cod.confirmationCostDzd, 'DZD')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Return Cost</span>
            <span className="text-text-primary">{formatCurrency(cod.returnCostDzd, 'DZD')}</span>
          </div>
        </div>

        {/* Assumptions */}
        <div className="bg-surface rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-medium text-text-secondary">Assumptions</h3>
          <div className="flex justify-between">
            <span className="text-text-muted">Confirmation Rate</span>
            <span className="text-text-primary">{(cod.confirmationRate * 100).toFixed(0)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Delivery Rate</span>
            <span className="text-text-primary">{(cod.deliveryRate * 100).toFixed(0)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Return Rate</span>
            <span className="text-text-primary">{(cod.returnRate * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={cn(
          'rounded-lg p-4 text-center',
          expectedProfit > 0 ? 'bg-success/10 border border-success/20' : 'bg-danger/10 border border-danger/20'
        )}>
          <p className="text-xs text-text-muted mb-1">Expected Profit/Order</p>
          <p className={cn('text-2xl font-bold', expectedProfit > 0 ? 'text-success' : 'text-danger')}>
            {formatCurrency(expectedProfit, 'DZD')}
          </p>
        </div>
        <div className="bg-surface rounded-lg p-4 text-center">
          <p className="text-xs text-text-muted mb-1">Gross Margin</p>
          <p className="text-2xl font-bold text-gold">{formatCurrency(grossMargin, 'DZD')}</p>
        </div>
        <div className="bg-surface rounded-lg p-4 text-center">
          <p className="text-xs text-text-muted mb-1">Break-even CPA</p>
          <p className="text-2xl font-bold text-text-primary">
            {formatCurrency((grossMargin * cod.confirmationRate * cod.deliveryRate) - (cod.confirmationCostDzd * cod.confirmationRate) - (cod.returnCostDzd * cod.returnRate), 'DZD')}
          </p>
        </div>
      </div>
    </div>
  )
}
