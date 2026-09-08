import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import {
  Search, Plus, Package, Edit3, Trash2, Eye,
  X, AlertTriangle, ShoppingBag, DollarSign, Archive, Power, PowerOff,
} from 'lucide-react'
import { useAppState } from '@/stores/AppState'
import type { SellingProduct, SellingProductStatus } from '@/types'
import { cn } from '@/lib/utils'

// ─── Helpers ───────────────────────────────────────────────────
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 10)

function formatDzd(amount: number): string {
  return amount.toLocaleString('fr-DZ') + ' DA'
}

function formatDate(d: Date | string | undefined): string {
  if (!d) return '-'
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('fr-DZ', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ─── Form ──────────────────────────────────────────────────────
interface FormData {
  name: string
  sku: string
  description: string
  imageUrl: string
  sellingPriceDzd: string
  costPriceDzd: string
  stock: string
  availableStock: string
  status: SellingProductStatus
  weight: string
  supplier: string
  supplierRef: string
  notes: string
  researchProductId: string
}

const INITIAL_FORM: FormData = {
  name: '', sku: '', description: '', imageUrl: '',
  sellingPriceDzd: '', costPriceDzd: '', stock: '', availableStock: '',
  status: 'ACTIVE', weight: '', supplier: '', supplierRef: '',
  notes: '', researchProductId: '',
}

// ─── Main Component ────────────────────────────────────────────
export default function ProductSelling() {
  const {
    sellingProducts, addSellingProduct, updateSellingProduct, deleteSellingProduct,
    orders, products, currentUser, addActivityLog,
  } = useAppState()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | SellingProductStatus>('ALL')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(INITIAL_FORM)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), 3000)
  }, [])

  // ─── Compute product stats from orders ─────────────────────────
  const productStats = useMemo(() => {
    const stats: Record<string, { totalOrders: number; confirmed: number; delivered: number; returned: number; revenue: number }> = {}
    orders.forEach(o => {
      if (!stats[o.productId]) {
        stats[o.productId] = { totalOrders: 0, confirmed: 0, delivered: 0, returned: 0, revenue: 0 }
      }
      const s = stats[o.productId]
      s.totalOrders++
      if (o.status === 'CONFIRMED' || o.status === 'DELIVERED' || o.status === 'RETURNED') s.confirmed++
      if (o.status === 'DELIVERED') { s.delivered++; s.revenue += o.sellingPriceDzd }
      if (o.status === 'RETURNED') s.returned++
    })
    return stats
  }, [orders])

  // ─── Filtered products ─────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...sellingProducts]
    if (statusFilter !== 'ALL') list = list.filter(p => p.status === statusFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.supplier?.toLowerCase().includes(q)
      )
    }
    return list.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
  }, [sellingProducts, statusFilter, search])

  // ─── KPIs ──────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const active = sellingProducts.filter(p => p.status === 'ACTIVE').length
    const inactive = sellingProducts.filter(p => p.status === 'INACTIVE').length
    const totalStock = sellingProducts.reduce((s, p) => s + p.stock, 0)
    const totalRevenue = Object.values(productStats).reduce((s, ps) => s + ps.revenue, 0)
    return { active, inactive, totalStock, totalRevenue, total: sellingProducts.length }
  }, [sellingProducts, productStats])

  // ─── Open create modal ─────────────────────────────────────────
  const openCreate = useCallback(() => {
    setEditingId(null)
    setForm(INITIAL_FORM)
    setShowModal(true)
  }, [])

  // ─── Open edit modal ──────────────────────────────────────────
  const openEdit = useCallback((p: SellingProduct) => {
    setEditingId(p.id)
    setForm({
      name: p.name,
      sku: p.sku,
      description: p.description || '',
      imageUrl: p.imageUrl || '',
      sellingPriceDzd: String(p.sellingPriceDzd),
      costPriceDzd: String(p.costPriceDzd),
      stock: String(p.stock),
      availableStock: String(p.availableStock),
      status: p.status,
      weight: String(p.weight || ''),
      supplier: p.supplier || '',
      supplierRef: p.supplierRef || '',
      notes: p.notes || '',
      researchProductId: p.researchProductId || '',
    })
    setShowModal(true)
  }, [])

  // ─── Save product ──────────────────────────────────────────────
  const handleSave = useCallback(() => {
    if (!form.name.trim() || !form.sku.trim()) {
      showToast('Name and SKU are required', 'error')
      return
    }
    const selling = Number(form.sellingPriceDzd) || 0
    const cost = Number(form.costPriceDzd) || 0
    const stock = Number(form.stock) || 0
    const avail = Number(form.availableStock) || stock

    const now = new Date()
    if (editingId) {
      const existing = sellingProducts.find(p => p.id === editingId)
      if (!existing) return
      const updated: SellingProduct = {
        ...existing,
        name: form.name.trim(),
        sku: form.sku.trim(),
        description: form.description.trim() || undefined,
        imageUrl: form.imageUrl.trim() || undefined,
        sellingPriceDzd: selling,
        costPriceDzd: cost,
        stock,
        availableStock: avail,
        status: form.status,
        weight: Number(form.weight) || undefined,
        supplier: form.supplier.trim() || undefined,
        supplierRef: form.supplierRef.trim() || undefined,
        notes: form.notes.trim() || undefined,
        researchProductId: form.researchProductId || undefined,
        updatedAt: now,
      }
      updateSellingProduct(updated)
      showToast('Product updated')
    } else {
      const newProduct: SellingProduct = {
        id: generateId(),
        name: form.name.trim(),
        sku: form.sku.trim(),
        description: form.description.trim() || undefined,
        imageUrl: form.imageUrl.trim() || undefined,
        sellingPriceDzd: selling,
        costPriceDzd: cost,
        stock,
        availableStock: avail,
        status: form.status,
        weight: Number(form.weight) || undefined,
        supplier: form.supplier.trim() || undefined,
        supplierRef: form.supplierRef.trim() || undefined,
        notes: form.notes.trim() || undefined,
        researchProductId: form.researchProductId || undefined,
        createdAt: now,
        updatedAt: now,
      }
      addSellingProduct(newProduct)
      addActivityLog({
        id: generateId(),
        action: 'PRODUCT_CREATED',
        userId: currentUser?.id || '',
        entityType: 'SELLING_PRODUCT',
        entityId: newProduct.id,
        entityName: newProduct.name,
        details: `Added to Product Selling: ${newProduct.name}`,
        createdAt: now,
      })
      showToast('Product added to selling catalog')
    }
    setShowModal(false)
    setEditingId(null)
    setForm(INITIAL_FORM)
  }, [form, editingId, sellingProducts, addSellingProduct, updateSellingProduct, addActivityLog, currentUser, showToast])

  // ─── Toggle status ─────────────────────────────────────────────
  const toggleStatus = useCallback((p: SellingProduct) => {
    const newStatus: SellingProductStatus = p.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    const updated: SellingProduct = { ...p, status: newStatus, updatedAt: new Date() }
    updateSellingProduct(updated)
    showToast(`Product ${newStatus === 'ACTIVE' ? 'activated' : 'deactivated'}`)
  }, [updateSellingProduct, showToast])

  // ─── Delete product ────────────────────────────────────────────
  const handleDelete = useCallback((id: string) => {
    const p = sellingProducts.find(sp => sp.id === id)
    deleteSellingProduct(id)
    setDeleteConfirmId(null)
    if (detailId === id) setDetailId(null)
    showToast(`"${p?.name}" deleted`)
    addActivityLog({
      id: generateId(),
      action: 'PRODUCT_UPDATED',
      userId: currentUser?.id || '',
      entityType: 'SELLING_PRODUCT',
      entityId: id,
      entityName: p?.name || '',
      details: `Deleted from Product Selling: ${p?.name}`,
      createdAt: new Date(),
    })
  }, [sellingProducts, deleteSellingProduct, detailId, addActivityLog, currentUser, showToast])

  // ─── Detail product ────────────────────────────────────────────
  const detailProduct = useMemo(() =>
    sellingProducts.find(p => p.id === detailId) || null,
  [sellingProducts, detailId])

  const detailStats = useMemo(() =>
    detailId ? productStats[detailId] || { totalOrders: 0, confirmed: 0, delivered: 0, returned: 0, revenue: 0 } : null,
  [detailId, productStats])

  const relatedOrders = useMemo(() =>
    detailId ? orders.filter(o => o.productId === detailId).slice(0, 20) : [],
  [orders, detailId])

  const getProduct = useCallback((id: string) => products.find(p => p.id === id), [products])

  // ─── Keyboard shortcut ─────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showModal) { setShowModal(false); setEditingId(null) }
        if (detailId) setDetailId(null)
        if (deleteConfirmId) setDeleteConfirmId(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showModal, detailId, deleteConfirmId])

  // ─── Margin calc ──────────────────────────────────────────────
  const getMargin = (p: SellingProduct) => {
    if (!p.sellingPriceDzd) return 0
    return ((p.sellingPriceDzd - p.costPriceDzd) / p.sellingPriceDzd * 100)
  }

  // ─── Render ────────────────────────────────────────────────────
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

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-text-primary">Product Selling</h1>
          <p className="text-sm text-text-muted mt-1">Products you actually sell — your commercial catalog</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Product
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: kpis.total, icon: Package, color: 'text-text-primary' },
          { label: 'Active', value: kpis.active, icon: Power, color: 'text-green' },
          { label: 'Inactive', value: kpis.inactive, icon: PowerOff, color: 'text-text-muted' },
          { label: 'Total Stock', value: kpis.totalStock, icon: Archive, color: 'text-blue' },
          { label: 'Revenue', value: formatDzd(kpis.totalRevenue), icon: DollarSign, color: 'text-gold' },
        ].map(k => (
          <div key={k.label} className="glass-card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/[0.03]">
              <k.icon className={cn('w-4 h-4', k.color)} />
            </div>
            <div>
              <p className="text-xs text-text-muted">{k.label}</p>
              <p className={cn('text-lg font-semibold', k.color)}>{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search products..."
              className="input-field pl-9 w-64"
            />
          </div>
          <div className="flex items-center gap-1">
            {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  statusFilter === s ? 'bg-gold/10 text-gold border border-gold/30' : 'text-text-muted hover:text-text-primary border border-transparent'
                )}
              >
                {s === 'ALL' ? 'All' : s}
              </button>
            ))}
          </div>
        </div>
        <span className="text-xs text-text-muted">{filtered.length} product(s)</span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <ShoppingBag className="w-12 h-12 text-text-muted mx-auto mb-3 opacity-40" />
          <p className="text-text-primary font-medium">No selling products yet</p>
          <p className="text-sm text-text-muted mt-1">
            {sellingProducts.length === 0
              ? 'Add your first product to start selling.'
              : 'No products match your filters.'}
          </p>
          {sellingProducts.length === 0 && (
            <button onClick={openCreate} className="btn-primary mt-4 inline-flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Product
            </button>
          )}
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted">Product</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted">SKU</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-text-muted">Selling Price</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-text-muted">Cost</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-text-muted">Margin</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-text-muted">Stock</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-text-muted">Orders</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-text-muted">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-text-muted">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const stats = productStats[p.id]
                  const margin = getMargin(p)
                  return (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.name} className="w-10 h-10 rounded-lg object-cover bg-white/[0.03]" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-white/[0.03] flex items-center justify-center">
                              <Package className="w-5 h-5 text-text-muted" />
                            </div>
                          )}
                          <div>
                            <span className="text-sm font-medium text-text-primary block">{p.name}</span>
                            {p.supplier && <span className="text-[11px] text-text-muted">{p.supplier}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-text-muted font-mono">{p.sku}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-semibold text-gold">{formatDzd(p.sellingPriceDzd)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-text-muted">{formatDzd(p.costPriceDzd)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={cn('text-sm font-medium', margin > 0 ? 'text-green' : 'text-danger')}>
                          {margin.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={cn('text-sm', p.availableStock <= 0 ? 'text-danger' : 'text-text-primary')}>
                          {p.availableStock}/{p.stock}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm text-text-primary">{stats?.totalOrders || 0}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn(
                          'px-2 py-1 rounded-full text-[11px] font-medium',
                          p.status === 'ACTIVE' ? 'bg-green/10 text-green' : 'bg-white/[0.05] text-text-muted'
                        )}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setDetailId(p.id)}
                            className="p-1.5 rounded-lg hover:bg-white/[0.05] text-text-muted hover:text-text-primary transition-colors"
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEdit(p)}
                            className="p-1.5 rounded-lg hover:bg-white/[0.05] text-text-muted hover:text-text-primary transition-colors"
                            title="Edit"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => toggleStatus(p)}
                            className="p-1.5 rounded-lg hover:bg-white/[0.05] text-text-muted hover:text-text-primary transition-colors"
                            title={p.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                          >
                            {p.status === 'ACTIVE' ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(p.id)}
                            className="p-1.5 rounded-lg hover:bg-white/[0.05] text-text-muted hover:text-danger transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Create/Edit Modal ───────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-heading font-semibold text-text-primary">
                {editingId ? 'Edit Product' : 'Add Product to Selling'}
              </h2>
              <button onClick={() => { setShowModal(false); setEditingId(null) }} className="p-1 rounded-lg hover:bg-white/[0.05]">
                <X className="w-5 h-5 text-text-muted" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Name */}
              <div className="col-span-2">
                <label className="text-xs text-text-muted mb-1 block">Product Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field w-full" placeholder="Wireless Bluetooth Earbuds" />
              </div>
              {/* SKU */}
              <div>
                <label className="text-xs text-text-muted mb-1 block">SKU *</label>
                <input value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} className="input-field w-full" placeholder="WB-001" />
              </div>
              {/* Image */}
              <div>
                <label className="text-xs text-text-muted mb-1 block">Image URL</label>
                <input value={form.imageUrl} onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))} className="input-field w-full" placeholder="https://..." />
              </div>
              {/* Description */}
              <div className="col-span-2">
                <label className="text-xs text-text-muted mb-1 block">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="input-field w-full h-20 resize-none" placeholder="Product description..." />
              </div>
              {/* Selling Price */}
              <div>
                <label className="text-xs text-text-muted mb-1 block">Selling Price (DA) *</label>
                <input type="number" value={form.sellingPriceDzd} onChange={e => setForm(f => ({ ...f, sellingPriceDzd: e.target.value }))} className="input-field w-full" placeholder="4500" />
              </div>
              {/* Cost Price */}
              <div>
                <label className="text-xs text-text-muted mb-1 block">Cost Price (DA)</label>
                <input type="number" value={form.costPriceDzd} onChange={e => setForm(f => ({ ...f, costPriceDzd: e.target.value }))} className="input-field w-full" placeholder="1500" />
              </div>
              {/* Stock */}
              <div>
                <label className="text-xs text-text-muted mb-1 block">Stock</label>
                <input type="number" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value, availableStock: e.target.value }))} className="input-field w-full" placeholder="100" />
              </div>
              {/* Available Stock */}
              <div>
                <label className="text-xs text-text-muted mb-1 block">Available Stock</label>
                <input type="number" value={form.availableStock} onChange={e => setForm(f => ({ ...f, availableStock: e.target.value }))} className="input-field w-full" placeholder="85" />
              </div>
              {/* Weight */}
              <div>
                <label className="text-xs text-text-muted mb-1 block">Weight (g)</label>
                <input type="number" value={form.weight} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} className="input-field w-full" placeholder="250" />
              </div>
              {/* Status */}
              <div>
                <label className="text-xs text-text-muted mb-1 block">Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as SellingProductStatus }))} className="select-field w-full">
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
              {/* Supplier */}
              <div>
                <label className="text-xs text-text-muted mb-1 block">Supplier</label>
                <input value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} className="input-field w-full" placeholder="Supplier name" />
              </div>
              {/* Supplier Ref */}
              <div>
                <label className="text-xs text-text-muted mb-1 block">Supplier Reference</label>
                <input value={form.supplierRef} onChange={e => setForm(f => ({ ...f, supplierRef: e.target.value }))} className="input-field w-full" placeholder="REF-123" />
              </div>
              {/* Notes */}
              <div className="col-span-2">
                <label className="text-xs text-text-muted mb-1 block">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="input-field w-full h-16 resize-none" placeholder="Additional notes..." />
              </div>
            </div>

            {/* Preview */}
            {form.name && (
              <div className="mt-4 p-3 rounded-xl bg-white/[0.02] border border-border">
                <p className="text-xs text-text-muted mb-2">Preview</p>
                <div className="flex items-center gap-3">
                  {form.imageUrl ? (
                    <img src={form.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-white/[0.03] flex items-center justify-center">
                      <Package className="w-6 h-6 text-text-muted" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-text-primary">{form.name}</p>
                    <p className="text-xs text-text-muted">SKU: {form.sku || '-'}</p>
                    <p className="text-xs text-gold">{Number(form.sellingPriceDzd || 0).toLocaleString('fr-DZ')} DA</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => { setShowModal(false); setEditingId(null) }} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} className="btn-primary">
                {editingId ? 'Save Changes' : 'Add Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Detail Drawer ──────────────────────────────────────── */}
      {detailProduct && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDetailId(null)} />
          <div className="relative w-full max-w-lg bg-charcoal border-l border-border overflow-y-auto">
            <div className="sticky top-0 bg-charcoal/95 backdrop-blur-sm border-b border-border px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-heading font-semibold text-text-primary truncate">{detailProduct.name}</h2>
              <button onClick={() => setDetailId(null)} className="p-1 rounded-lg hover:bg-white/[0.05]">
                <X className="w-5 h-5 text-text-muted" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Product Image */}
              {detailProduct.imageUrl && (
                <img src={detailProduct.imageUrl} alt={detailProduct.name} className="w-full h-48 object-cover rounded-xl" />
              )}

              {/* General */}
              <section>
                <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">General</h3>
                <div className="space-y-2">
                  <div className="flex justify-between"><span className="text-sm text-text-muted">Name</span><span className="text-sm text-text-primary">{detailProduct.name}</span></div>
                  <div className="flex justify-between"><span className="text-sm text-text-muted">SKU</span><span className="text-sm text-text-primary font-mono">{detailProduct.sku}</span></div>
                  <div className="flex justify-between"><span className="text-sm text-text-muted">Status</span>
                    <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium', detailProduct.status === 'ACTIVE' ? 'bg-green/10 text-green' : 'bg-white/[0.05] text-text-muted')}>
                      {detailProduct.status}
                    </span>
                  </div>
                  {detailProduct.description && (
                    <div><span className="text-sm text-text-muted">Description</span><p className="text-sm text-text-primary mt-1">{detailProduct.description}</p></div>
                  )}
                  {detailProduct.supplier && <div className="flex justify-between"><span className="text-sm text-text-muted">Supplier</span><span className="text-sm text-text-primary">{detailProduct.supplier}</span></div>}
                  {detailProduct.supplierRef && <div className="flex justify-between"><span className="text-sm text-text-muted">Supplier Ref</span><span className="text-sm text-text-primary font-mono">{detailProduct.supplierRef}</span></div>}
                  <div className="flex justify-between"><span className="text-sm text-text-muted">Date Added</span><span className="text-sm text-text-primary">{formatDate(detailProduct.createdAt)}</span></div>
                  <div className="flex justify-between"><span className="text-sm text-text-muted">Last Updated</span><span className="text-sm text-text-primary">{formatDate(detailProduct.updatedAt)}</span></div>
                </div>
              </section>

              {/* Pricing */}
              <section>
                <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Pricing</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-white/[0.02] text-center">
                    <p className="text-xs text-text-muted">Selling</p>
                    <p className="text-sm font-semibold text-gold">{formatDzd(detailProduct.sellingPriceDzd)}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.02] text-center">
                    <p className="text-xs text-text-muted">Cost</p>
                    <p className="text-sm font-semibold text-text-primary">{formatDzd(detailProduct.costPriceDzd)}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.02] text-center">
                    <p className="text-xs text-text-muted">Margin</p>
                    <p className={cn('text-sm font-semibold', getMargin(detailProduct) > 0 ? 'text-green' : 'text-danger')}>
                      {getMargin(detailProduct).toFixed(1)}%
                    </p>
                  </div>
                </div>
              </section>

              {/* Stock */}
              <section>
                <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Stock</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-white/[0.02] text-center">
                    <p className="text-xs text-text-muted">Total</p>
                    <p className="text-sm font-semibold text-text-primary">{detailProduct.stock}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.02] text-center">
                    <p className="text-xs text-text-muted">Available</p>
                    <p className={cn('text-sm font-semibold', detailProduct.availableStock <= 0 ? 'text-danger' : 'text-green')}>
                      {detailProduct.availableStock}
                    </p>
                  </div>
                </div>
              </section>

              {/* Sales */}
              {detailStats && (
                <section>
                  <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Sales</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-white/[0.02] text-center">
                      <p className="text-xs text-text-muted">Orders</p>
                      <p className="text-sm font-semibold text-text-primary">{detailStats.totalOrders}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.02] text-center">
                      <p className="text-xs text-text-muted">Delivered</p>
                      <p className="text-sm font-semibold text-green">{detailStats.delivered}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.02] text-center">
                      <p className="text-xs text-text-muted">Returned</p>
                      <p className="text-sm font-semibold text-danger">{detailStats.returned}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.02] text-center">
                      <p className="text-xs text-text-muted">Revenue</p>
                      <p className="text-sm font-semibold text-gold">{formatDzd(detailStats.revenue)}</p>
                    </div>
                  </div>
                </section>
              )}

              {/* Notes */}
              {detailProduct.notes && (
                <section>
                  <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Notes</h3>
                  <p className="text-sm text-text-primary whitespace-pre-wrap">{detailProduct.notes}</p>
                </section>
              )}

              {/* Research Link */}
              {detailProduct.researchProductId && (() => {
                const researchProduct = getProduct(detailProduct.researchProductId)
                return researchProduct ? (
                  <section>
                    <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Research Product</h3>
                    <div className="p-3 rounded-xl bg-white/[0.02] flex items-center gap-3">
                      {researchProduct.imageUrl && <img src={researchProduct.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />}
                      <div>
                        <p className="text-sm font-medium text-text-primary">{researchProduct.name}</p>
                        <p className="text-xs text-text-muted">{researchProduct.status}</p>
                      </div>
                    </div>
                  </section>
                ) : null
              })()}

              {/* Recent Orders */}
              {relatedOrders.length > 0 && (
                <section>
                  <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Recent Orders</h3>
                  <div className="space-y-2">
                    {relatedOrders.map(o => (
                      <div key={o.id} className="p-3 rounded-xl bg-white/[0.02] flex items-center justify-between">
                        <div>
                          <p className="text-sm text-text-primary">{o.orderNumber}</p>
                          <p className="text-xs text-text-muted">{o.customer.name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gold">{formatDzd(o.sellingPriceDzd)}</p>
                          <span className={cn(
                            'text-[11px] px-2 py-0.5 rounded-full',
                            o.status === 'DELIVERED' ? 'bg-green/10 text-green' :
                            o.status === 'RETURNED' ? 'bg-danger/10 text-danger' :
                            'bg-white/[0.05] text-text-muted'
                          )}>{o.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-border">
                <button onClick={() => { setDetailId(null); openEdit(detailProduct) }} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  <Edit3 className="w-4 h-4" /> Edit
                </button>
                <button onClick={() => toggleStatus(detailProduct)} className="btn-secondary flex items-center justify-center gap-2">
                  {detailProduct.status === 'ACTIVE' ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                  {detailProduct.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete Confirm Modal ───────────────────────────────── */}
      {deleteConfirmId && (() => {
        const p = sellingProducts.find(sp => sp.id === deleteConfirmId)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="glass-card w-full max-w-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-danger/10">
                  <AlertTriangle className="w-5 h-5 text-danger" />
                </div>
                <h3 className="text-lg font-heading font-semibold text-text-primary">Delete Product</h3>
              </div>
              <p className="text-sm text-text-muted mb-6">
                Are you sure you want to delete <strong className="text-text-primary">"{p?.name}"</strong>?
                This action cannot be undone.
              </p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setDeleteConfirmId(null)} className="btn-secondary">Cancel</button>
                <button onClick={() => handleDelete(deleteConfirmId)} className="btn-primary bg-danger hover:bg-danger/80">Delete</button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
