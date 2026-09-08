import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { 
  Plus, 
  Search, 
  ExternalLink,
  Copy,
  Package
} from 'lucide-react'
import { useAppState } from '@/stores/AppState'
import { cn, formatCurrency } from '@/lib/utils'
import type { ProductStatus } from '@/types'

const statusFilters: (ProductStatus | 'ALL')[] = ['ALL', 'TESTING', 'APPROVED', 'STANDBY', 'REJECTED', 'SCALING']

export function ProductList() {
  const navigate = useNavigate()
  const { products } = useAppState()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.supplier?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = statusFilter === 'ALL' || product.status === statusFilter

    return matchesSearch && matchesStatus
  })

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Products</h1>
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
        {filteredProducts.map((product) => (
          <Link
            key={product.id}
            to={`/app/research/${product.id}`}
            className="glass-card p-4 hover:border-border-light transition-all group"
          >
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

            {/* Actions */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
              <span className="text-xs text-text-muted">
                {new Date(product.updatedAt).toLocaleDateString()}
              </span>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {product.sourceUrl && (
                  <a
                    href={product.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted hover:text-text-secondary transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    // Duplicate functionality
                  }}
                  className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted hover:text-text-secondary transition-colors"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <div className="text-center py-12">
          <Package className="w-12 h-12 text-text-muted mx-auto mb-4" />
          <p className="text-text-secondary">No products found</p>
          <p className="text-text-muted text-sm mt-1">Try adjusting your search or filters</p>
        </div>
      )}
    </div>
  )
}
