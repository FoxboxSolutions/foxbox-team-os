import { useState, useMemo, useCallback } from 'react'
import {
  ShoppingCart,
  Plus,
  Search,
  Phone,
  MapPin,
  X,
  Eye,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  CheckCircle,
  Truck,
  Package,
  AlertTriangle,
  User,
  StickyNote,
  Home,
  Building2,
  Send,
  History,
} from 'lucide-react'
import { useAppState } from '@/stores/AppState'
import { cn } from '@/lib/utils'
import type {
  Order,
  OrderStatus,
  ConfirmationStatus,
} from '@/types'

// ─── Constants ──────────────────────────────────────────────

const ITEMS_PER_PAGE = 10

const statusConfig: Record<OrderStatus, { label: string; color: string; bgColor: string; icon: string }> = {
  NEW: { label: 'New', color: 'text-info', bgColor: 'bg-info/12', icon: '✦' },
  PENDING_CONFIRMATION: { label: 'Pending', color: 'text-warning', bgColor: 'bg-warning/12', icon: '⏳' },
  CONFIRMED: { label: 'Confirmed', color: 'text-success', bgColor: 'bg-success/12', icon: '✓' },
  CANCELLED: { label: 'Cancelled', color: 'text-danger', bgColor: 'bg-danger/12', icon: '✕' },
  PREPARING: { label: 'Preparing', color: 'text-purple', bgColor: 'bg-purple/12', icon: '📦' },
  SHIPPED: { label: 'Shipped', color: 'text-blue', bgColor: 'bg-blue/12', icon: '🚚' },
  IN_TRANSIT: { label: 'In Transit', color: 'text-orange', bgColor: 'bg-orange/12', icon: '🔄' },
  OUT_FOR_DELIVERY: { label: 'Out for Delivery', color: 'text-gold', bgColor: 'bg-gold/12', icon: '📍' },
  DELIVERED: { label: 'Delivered', color: 'text-success', bgColor: 'bg-success/12', icon: '✅' },
  RETURNED: { label: 'Returned', color: 'text-danger', bgColor: 'bg-danger/12', icon: '↩' },
}

const confirmationConfig: Record<ConfirmationStatus, { label: string; color: string; bgColor: string }> = {
  PENDING: { label: 'Pending', color: 'text-warning', bgColor: 'bg-warning/12' },
  CONFIRMED: { label: 'Confirmed', color: 'text-success', bgColor: 'bg-success/12' },
  NO_ANSWER: { label: 'No Answer', color: 'text-orange', bgColor: 'bg-orange/12' },
  CALL_BACK: { label: 'Call Back', color: 'text-info', bgColor: 'bg-info/12' },
  WRONG_NUMBER: { label: 'Wrong Number', color: 'text-danger', bgColor: 'bg-danger/12' },
  CANCELLED: { label: 'Cancelled', color: 'text-danger', bgColor: 'bg-danger/12' },
}

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  NEW: 'PENDING_CONFIRMATION',
  CONFIRMED: 'PREPARING',
  PREPARING: 'SHIPPED',
  SHIPPED: 'IN_TRANSIT',
  IN_TRANSIT: 'OUT_FOR_DELIVERY',
  OUT_FOR_DELIVERY: 'DELIVERED',
}

const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  NEW: 'Send for Confirmation',
  CONFIRMED: 'Start Preparing',
  PREPARING: 'Ship Order',
  SHIPPED: 'Mark In Transit',
  IN_TRANSIT: 'Out for Delivery',
  OUT_FOR_DELIVERY: 'Mark Delivered',
}

type SortField = 'createdAt' | 'sellingPriceDzd' | 'orderNumber'
type SortDir = 'asc' | 'desc'

interface OrderFormData {
  customerName: string
  customerPhone: string
  customerPhoneAlt: string
  wilayaId: string
  commune: string
  address: string
  deliveryType: 'HOME' | 'STOP_DESK'
  productId: string
  quantity: number
  sellingPriceDzd: number
  deliveryFeeDzd: number
  paymentMethod: 'COD' | 'CCP' | 'BARIDIMOB'
  carrierId: string
  trackingNumber: string
  notes: string
}

const emptyForm: OrderFormData = {
  customerName: '',
  customerPhone: '',
  customerPhoneAlt: '',
  wilayaId: '',
  commune: '',
  address: '',
  deliveryType: 'HOME',
  productId: '',
  quantity: 1,
  sellingPriceDzd: 0,
  deliveryFeeDzd: 0,
  paymentMethod: 'COD',
  carrierId: '',
  trackingNumber: '',
  notes: '',
}

// ─── Helpers ────────────────────────────────────────────────

function generateOrderNumber(): string {
  const year = new Date().getFullYear()
  const seq = String(Math.floor(Math.random() * 900) + 100)
  return `FOX-${year}-${seq}`
}

function formatDate(d: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(d))
}

function formatDateTime(d: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(d))
}

function formatDzd(amount: number): string {
  return `${amount.toLocaleString()} DA`
}

// ─── Component ──────────────────────────────────────────────

export function Orders() {
  const {
    orders,
    addOrder,
    updateOrder,
    deleteOrder,
    products,
    sellingProducts,
    currentUser,
    deliveryProviders,
    wilayas,
    addActivityLog,
    addNotification,
    addRevenue,
  } = useAppState()

  // ─── State ──────────────────────────────────────────────

  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<OrderStatus | 'ALL'>('ALL')
  const [filterConfirmation, setFilterConfirmation] = useState<ConfirmationStatus | 'ALL'>('ALL')
  const [filterPayment, setFilterPayment] = useState<string>('ALL')
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [currentPage, setCurrentPage] = useState(1)

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [showDetailDrawer, setShowDetailDrawer] = useState<string | null>(null)
  const [showStatusAdvance, setShowStatusAdvance] = useState<string | null>(null)
  const [showConfirmModal, setShowConfirmModal] = useState<string | null>(null)

  // Forms
  const [createForm, setCreateForm] = useState<OrderFormData>(emptyForm)
  const [editForm, setEditForm] = useState<OrderFormData>(emptyForm)

  // ─── Derived data ───────────────────────────────────────

  const selectedWilaya = useMemo(
    () => wilayas.find(w => w.id === (showCreateModal ? createForm.wilayaId : editForm.wilayaId)),
    [wilayas, createForm.wilayaId, editForm.wilayaId]
  )

  const communes = useMemo(() => selectedWilaya?.communes || [], [selectedWilaya])

  const selectedOrder = useMemo(
    () => orders.find(o => o.id === showDetailDrawer),
    [orders, showDetailDrawer]
  )

  const filteredOrders = useMemo(() => {
    let result = orders.filter(o => {
      const q = searchQuery.toLowerCase()
      const matchesSearch =
        !searchQuery ||
        o.orderNumber.toLowerCase().includes(q) ||
        o.customer.name.toLowerCase().includes(q) ||
        o.customer.phone.includes(searchQuery)
      const matchesStatus = filterStatus === 'ALL' || o.status === filterStatus
      const matchesConfirmation = filterConfirmation === 'ALL' || o.confirmationStatus === filterConfirmation
      const matchesPayment = filterPayment === 'ALL' || o.paymentMethod === filterPayment
      return matchesSearch && matchesStatus && matchesConfirmation && matchesPayment
    })

    result.sort((a, b) => {
      let cmp = 0
      if (sortField === 'createdAt') {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      } else if (sortField === 'sellingPriceDzd') {
        cmp = a.sellingPriceDzd - b.sellingPriceDzd
      } else if (sortField === 'orderNumber') {
        cmp = a.orderNumber.localeCompare(b.orderNumber)
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return result
  }, [orders, searchQuery, filterStatus, filterConfirmation, filterPayment, sortField, sortDir])

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / ITEMS_PER_PAGE))
  const paginatedOrders = useMemo(
    () => filteredOrders.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [filteredOrders, currentPage]
  )

  const getProduct = useCallback((id: string) => {
    const sp = sellingProducts.find(p => p.id === id)
    if (sp) return sp
    return products.find(p => p.id === id)
  }, [sellingProducts, products])
  const getCarrier = useCallback((id?: string) => deliveryProviders.find(d => d.id === id), [deliveryProviders])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: orders.length }
    orders.forEach(o => {
      counts[o.status] = (counts[o.status] || 0) + 1
    })
    return counts
  }, [orders])

  // ─── Handlers ───────────────────────────────────────────

  function resetCreateForm() {
    setCreateForm(emptyForm)
  }

  function resetEditForm() {
    setEditForm(emptyForm)
    setEditingOrder(null)
  }

  function openEditModal(order: Order) {
    setEditingOrder(order)
    setEditForm({
      customerName: order.customer.name,
      customerPhone: order.customer.phone,
      customerPhoneAlt: order.customer.phoneAlt || '',
      wilayaId: wilayas.find(w => w.name === order.customer.wilaya)?.id || '',
      commune: order.customer.commune,
      address: order.customer.address,
      deliveryType: order.customer.deliveryType,
      productId: order.productId,
      quantity: order.quantity,
      sellingPriceDzd: order.sellingPriceDzd,
      deliveryFeeDzd: order.deliveryFeeDzd,
      paymentMethod: order.paymentMethod,
      carrierId: order.carrierId || '',
      trackingNumber: order.trackingNumber || '',
      notes: order.notes || '',
    })
    setShowEditModal(true)
  }

  function handleCreateOrder() {
    if (!createForm.customerName || !createForm.customerPhone || !createForm.wilayaId || !createForm.productId) return
    const now = new Date()
    const wilayaName = wilayas.find(w => w.id === createForm.wilayaId)?.name || ''
    const orderId = `ord_${Date.now()}`
    const order: Order = {
      id: orderId,
      orderNumber: generateOrderNumber(),
      customer: {
        id: `cust_${Date.now()}`,
        name: createForm.customerName,
        phone: createForm.customerPhone,
        phoneAlt: createForm.customerPhoneAlt || undefined,
        wilaya: wilayaName,
        commune: createForm.commune,
        address: createForm.address,
        deliveryType: createForm.deliveryType,
      },
      productId: createForm.productId,
      quantity: createForm.quantity,
      sellingPriceDzd: createForm.sellingPriceDzd,
      deliveryFeeDzd: createForm.deliveryFeeDzd,
      paymentMethod: createForm.paymentMethod,
      carrierId: createForm.carrierId || undefined,
      trackingNumber: createForm.trackingNumber || undefined,
      status: 'NEW',
      confirmationStatus: 'PENDING',
      notes: createForm.notes || undefined,
      createdBy: currentUser?.id || 'unknown',
      createdAt: now,
      updatedAt: now,
    }
    addOrder(order)
    addActivityLog({
      id: `al_${Date.now()}`,
      action: 'ORDER_CREATED',
      userId: currentUser?.id || 'unknown',
      entityType: 'ORDER',
      entityId: orderId,
      entityName: order.orderNumber,
      details: `Order created for ${order.customer.name} - ${formatDzd(order.sellingPriceDzd)}`,
      createdAt: now,
    })
    addNotification({
      id: `n_${Date.now()}`,
      type: 'ORDER_RECEIVED',
      title: 'New Order Created',
      message: `Order ${order.orderNumber} received from ${order.customer.name}`,
      link: '/app/orders',
      isRead: false,
      userId: currentUser?.id || 'unknown',
      createdAt: now,
    })
    setShowCreateModal(false)
    resetCreateForm()
  }

  function handleEditOrder() {
    if (!editingOrder) return
    const now = new Date()
    const wilayaName = wilayas.find(w => w.id === editForm.wilayaId)?.name || ''
    const updated: Order = {
      ...editingOrder,
      customer: {
        ...editingOrder.customer,
        name: editForm.customerName,
        phone: editForm.customerPhone,
        phoneAlt: editForm.customerPhoneAlt || undefined,
        wilaya: wilayaName,
        commune: editForm.commune,
        address: editForm.address,
        deliveryType: editForm.deliveryType,
      },
      productId: editForm.productId,
      quantity: editForm.quantity,
      sellingPriceDzd: editForm.sellingPriceDzd,
      deliveryFeeDzd: editForm.deliveryFeeDzd,
      paymentMethod: editForm.paymentMethod,
      carrierId: editForm.carrierId || undefined,
      trackingNumber: editForm.trackingNumber || undefined,
      notes: editForm.notes || undefined,
      updatedAt: now,
    }
    updateOrder(updated)
    addActivityLog({
      id: `al_${Date.now()}`,
      action: 'ORDER_UPDATED',
      userId: currentUser?.id || 'unknown',
      entityType: 'ORDER',
      entityId: updated.id,
      entityName: updated.orderNumber,
      details: 'Order details updated',
      createdAt: now,
    })
    setShowEditModal(false)
    resetEditForm()
  }

  function handleDeleteOrder(id: string) {
    const order = orders.find(o => o.id === id)
    deleteOrder(id)
    if (order) {
      addActivityLog({
        id: `al_${Date.now()}`,
        action: 'ORDER_UPDATED',
        userId: currentUser?.id || 'unknown',
        entityType: 'ORDER',
        entityId: id,
        entityName: order.orderNumber,
        details: 'Order deleted',
        createdAt: new Date(),
      })
    }
    setShowDeleteConfirm(null)
    if (showDetailDrawer === id) setShowDetailDrawer(null)
  }

  function handleAdvanceStatus(order: Order) {
    const next = NEXT_STATUS[order.status]
    if (!next) return
    const now = new Date()
    const updated: Order = { ...order, status: next, updatedAt: now }
    if (next === 'CONFIRMED') {
      updated.confirmedAt = now
      updated.confirmationStatus = 'CONFIRMED'
    } else if (next === 'SHIPPED') {
      updated.shippedAt = now
    } else if (next === 'DELIVERED') {
      updated.deliveredAt = now
      // Add revenue on delivery
      addRevenue({
        id: `rev_${Date.now()}`,
        source: 'ORDER',
        amountDzd: order.sellingPriceDzd,
        orderId: order.id,
        productId: order.productId,
        createdAt: now,
      })
      addNotification({
        id: `n_${Date.now()}`,
        type: 'ORDER_RECEIVED',
        title: 'Order Delivered',
        message: `Order ${order.orderNumber} has been delivered. Revenue ${formatDzd(order.sellingPriceDzd)} recorded.`,
        link: '/app/orders',
        isRead: false,
        userId: currentUser?.id || 'unknown',
        createdAt: now,
      })
    }
    updateOrder(updated)
    addActivityLog({
      id: `al_${Date.now()}`,
      action: 'STATUS_CHANGED',
      userId: currentUser?.id || 'unknown',
      entityType: 'ORDER',
      entityId: order.id,
      entityName: order.orderNumber,
      details: `${statusConfig[order.status].label} → ${statusConfig[next].label}`,
      createdAt: now,
    })
    setShowStatusAdvance(null)
  }

  function handleSetConfirmation(order: Order, conf: ConfirmationStatus) {
    const now = new Date()
    const updated: Order = {
      ...order,
      confirmationStatus: conf,
      updatedAt: now,
    }
    if (conf === 'CONFIRMED') {
      updated.confirmedAt = now
      updated.status = 'CONFIRMED'
    } else if (conf === 'CANCELLED') {
      updated.status = 'CANCELLED'
    }
    updateOrder(updated)
    addActivityLog({
      id: `al_${Date.now()}`,
      action: 'STATUS_CHANGED',
      userId: currentUser?.id || 'unknown',
      entityType: 'ORDER',
      entityId: order.id,
      entityName: order.orderNumber,
      details: `Confirmation set to ${conf.replace(/_/g, ' ')}`,
      createdAt: now,
    })
    setShowConfirmModal(null)
  }

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
    setCurrentPage(1)
  }

  // ─── Timeline ───────────────────────────────────────────

  function buildTimeline(order: Order) {
    const events: { date: Date | string; label: string; color: string }[] = []
    events.push({ date: order.createdAt, label: 'Order Created', color: 'bg-info' })
    if (order.confirmationStatus === 'CONFIRMED' && order.confirmedAt) {
      events.push({ date: order.confirmedAt, label: 'Order Confirmed', color: 'bg-success' })
    }
    if (order.shippedAt) {
      events.push({ date: order.shippedAt, label: 'Shipped', color: 'bg-blue' })
    }
    if (order.deliveredAt) {
      events.push({ date: order.deliveredAt, label: 'Delivered', color: 'bg-success' })
    }
    if (order.returnedAt) {
      events.push({ date: order.returnedAt, label: 'Returned', color: 'bg-danger' })
    }
    if (order.status === 'CANCELLED') {
      events.push({ date: order.updatedAt, label: 'Cancelled', color: 'bg-danger' })
    }
    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  // ─── Form input helper ──────────────────────────────────

  function renderFormFields(
    form: OrderFormData,
    setForm: React.Dispatch<React.SetStateAction<OrderFormData>>,
  ) {
    return (
      <div className="space-y-4">
        {/* Customer Section */}
        <div className="border-b border-border pb-4">
          <h4 className="text-xs font-semibold text-gold uppercase tracking-wider mb-3 flex items-center gap-2">
            <User className="w-3 h-3" /> Customer Information
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-muted mb-1 block">Full Name *</label>
              <input
                type="text"
                value={form.customerName}
                onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
                className="input-field w-full"
                placeholder="Customer name"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Phone *</label>
              <input
                type="tel"
                value={form.customerPhone}
                onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))}
                className="input-field w-full"
                placeholder="0555123456"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Alt. Phone</label>
              <input
                type="tel"
                value={form.customerPhoneAlt}
                onChange={e => setForm(f => ({ ...f, customerPhoneAlt: e.target.value }))}
                className="input-field w-full"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Delivery Type</label>
              <select
                value={form.deliveryType}
                onChange={e => setForm(f => ({ ...f, deliveryType: e.target.value as 'HOME' | 'STOP_DESK' }))}
                className="select-field w-full"
              >
                <option value="HOME">Home Delivery</option>
                <option value="STOP_DESK">Stop Desk</option>
              </select>
            </div>
          </div>
        </div>

        {/* Address Section */}
        <div className="border-b border-border pb-4">
          <h4 className="text-xs font-semibold text-gold uppercase tracking-wider mb-3 flex items-center gap-2">
            <MapPin className="w-3 h-3" /> Delivery Address
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-muted mb-1 block">Wilaya *</label>
              <select
                value={form.wilayaId}
                onChange={e => setForm(f => ({ ...f, wilayaId: e.target.value, commune: '' }))}
                className="select-field w-full"
              >
                <option value="">Select wilaya</option>
                {wilayas.map(w => (
                  <option key={w.id} value={w.id}>{w.code} - {w.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Commune</label>
              <select
                value={form.commune}
                onChange={e => setForm(f => ({ ...f, commune: e.target.value }))}
                className="select-field w-full"
                disabled={!form.wilayaId}
              >
                <option value="">Select commune</option>
                {communes.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-text-muted mb-1 block">Address</label>
              <input
                type="text"
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                className="input-field w-full"
                placeholder="Street address, building, etc."
              />
            </div>
          </div>
        </div>

        {/* Product Section */}
        <div className="border-b border-border pb-4">
          <h4 className="text-xs font-semibold text-gold uppercase tracking-wider mb-3 flex items-center gap-2">
            <Package className="w-3 h-3" /> Product & Pricing
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-muted mb-1 block">Product *</label>
              <select
                value={form.productId}
                onChange={e => {
                  const sp = sellingProducts.find(p => p.id === e.target.value)
                  setForm(f => ({
                    ...f,
                    productId: e.target.value,
                    sellingPriceDzd: sp ? sp.sellingPriceDzd : f.sellingPriceDzd,
                  }))
                }}
                className="select-field w-full"
              >
                <option value="">Select product</option>
                {sellingProducts.filter(p => p.status === 'ACTIVE').map(p => (
                  <option key={p.id} value={p.id}>{p.name} — {p.sellingPriceDzd.toLocaleString('fr-DZ')} DA</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Quantity</label>
              <input
                type="number"
                min={1}
                value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Selling Price (DZD)</label>
              <input
                type="number"
                min={0}
                value={form.sellingPriceDzd}
                onChange={e => setForm(f => ({ ...f, sellingPriceDzd: Math.max(0, parseFloat(e.target.value) || 0) }))}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Delivery Fee (DZD)</label>
              <input
                type="number"
                min={0}
                value={form.deliveryFeeDzd}
                onChange={e => setForm(f => ({ ...f, deliveryFeeDzd: Math.max(0, parseFloat(e.target.value) || 0) }))}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Payment Method</label>
              <select
                value={form.paymentMethod}
                onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value as 'COD' | 'CCP' | 'BARIDIMOB' }))}
                className="select-field w-full"
              >
                <option value="COD">Cash on Delivery (COD)</option>
                <option value="CCP">CCP</option>
                <option value="BARIDIMOB">BaridiMob</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Total</label>
              <div className="input-field w-full bg-white/[0.02] text-gold font-semibold">
                {formatDzd(form.sellingPriceDzd + form.deliveryFeeDzd)}
              </div>
            </div>
          </div>
        </div>

        {/* Shipping Section */}
        <div className="border-b border-border pb-4">
          <h4 className="text-xs font-semibold text-gold uppercase tracking-wider mb-3 flex items-center gap-2">
            <Truck className="w-3 h-3" /> Shipping (Optional)
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-muted mb-1 block">Carrier</label>
              <select
                value={form.carrierId}
                onChange={e => setForm(f => ({ ...f, carrierId: e.target.value }))}
                className="select-field w-full"
              >
                <option value="">No carrier</option>
                {deliveryProviders.filter(d => d.isActive).map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Tracking Number</label>
              <input
                type="text"
                value={form.trackingNumber}
                onChange={e => setForm(f => ({ ...f, trackingNumber: e.target.value }))}
                className="input-field w-full"
                placeholder="Tracking number"
              />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <h4 className="text-xs font-semibold text-gold uppercase tracking-wider mb-3 flex items-center gap-2">
            <StickyNote className="w-3 h-3" /> Notes
          </h4>
          <textarea
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            className="textarea-field w-full"
            rows={2}
            placeholder="Order notes..."
          />
        </div>
      </div>
    )
  }

  // ─── Render ─────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-sm text-text-muted mt-1">Manage all COD orders.</p>
        </div>
        <button onClick={() => { resetCreateForm(); setShowCreateModal(true) }} className="btn-primary">
          <Plus className="w-4 h-4" />
          New Order
        </button>
      </div>

      {/* Search & Filters Bar */}
      <div className="glass-card p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="header-search flex items-center gap-3 px-4 py-2.5 flex-1 min-w-0">
            <Search className="w-4 h-4 text-text-muted shrink-0" />
            <input
              type="text"
              placeholder="Search order #, customer, phone..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1) }}
              className="bg-transparent border-none outline-none text-sm text-text-primary placeholder:text-text-muted w-full"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-text-muted hover:text-text-primary">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={filterConfirmation}
              onChange={e => { setFilterConfirmation(e.target.value as ConfirmationStatus | 'ALL'); setCurrentPage(1) }}
              className="select-field text-xs"
            >
              <option value="ALL">All Confirmations</option>
              {(Object.keys(confirmationConfig) as ConfirmationStatus[]).map(c => (
                <option key={c} value={c}>{confirmationConfig[c].label}</option>
              ))}
            </select>
            <select
              value={filterPayment}
              onChange={e => { setFilterPayment(e.target.value); setCurrentPage(1) }}
              className="select-field text-xs"
            >
              <option value="ALL">All Payments</option>
              <option value="COD">COD</option>
              <option value="CCP">CCP</option>
              <option value="BARIDIMOB">BaridiMob</option>
            </select>
          </div>
        </div>
      </div>

      {/* Status Filter Chips */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => { setFilterStatus('ALL'); setCurrentPage(1) }}
          className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
            filterStatus === 'ALL'
              ? 'bg-gold/15 text-gold border border-gold/20'
              : 'bg-white/[0.03] text-text-muted border border-border hover:text-text-secondary'
          )}
        >
          All ({statusCounts.ALL || 0})
        </button>
        {(Object.keys(statusConfig) as OrderStatus[]).map(status => {
          const count = statusCounts[status] || 0
          if (count === 0 && filterStatus !== status) return null
          const cfg = statusConfig[status]
          return (
            <button
              key={status}
              onClick={() => { setFilterStatus(status); setCurrentPage(1) }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                filterStatus === status
                  ? 'bg-gold/15 text-gold border border-gold/20'
                  : 'bg-white/[0.03] text-text-muted border border-border hover:text-text-secondary'
              )}
            >
              {cfg.label} ({count})
            </button>
          )
        })}
      </div>

      {/* Table */}
      {filteredOrders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <p className="text-sm text-text-muted">
            {orders.length === 0 ? 'No orders yet. Create your first order to get started.' : 'No orders match your filters.'}
          </p>
          {orders.length === 0 && (
            <button onClick={() => { resetCreateForm(); setShowCreateModal(true) }} className="btn-primary mt-4">
              <Plus className="w-4 h-4" />
              Create Order
            </button>
          )}
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>
                    <button
                      onClick={() => toggleSort('orderNumber')}
                      className="flex items-center gap-1 hover:text-gold transition-colors"
                    >
                      Order
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th>Customer</th>
                  <th>Product</th>
                  <th>
                    <button
                      onClick={() => toggleSort('sellingPriceDzd')}
                      className="flex items-center gap-1 hover:text-gold transition-colors"
                    >
                      Amount
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th>Wilaya</th>
                  <th>Status</th>
                  <th>Confirm</th>
                  <th>
                    <button
                      onClick={() => toggleSort('createdAt')}
                      className="flex items-center gap-1 hover:text-gold transition-colors"
                    >
                      Date
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedOrders.map(order => {
                  const product = getProduct(order.productId)
                  const carrier = getCarrier(order.carrierId)
                  const status = statusConfig[order.status]
                  const confirm = confirmationConfig[order.confirmationStatus]
                  const next = NEXT_STATUS[order.status]
                  const canAdvance = next && order.status !== 'CANCELLED' && order.status !== 'DELIVERED' && order.status !== 'RETURNED'

                  return (
                    <tr key={order.id} className="group">
                      <td>
                        <span className="font-medium text-text-primary text-sm">{order.orderNumber}</span>
                        {carrier && (
                          <p className="text-[10px] text-text-muted">{carrier.name}</p>
                        )}
                      </td>
                      <td>
                        <div>
                          <p className="text-sm font-medium">{order.customer.name}</p>
                          <p className="text-[11px] text-text-muted flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {order.customer.phone}
                          </p>
                        </div>
                      </td>
                      <td>
                        <span className="text-xs text-gold">{product?.name || '-'}</span>
                        {order.quantity > 1 && (
                          <span className="text-[10px] text-text-muted ml-1">x{order.quantity}</span>
                        )}
                      </td>
                      <td>
                        <div>
                          <p className="text-sm font-medium">{order.sellingPriceDzd.toLocaleString()} DA</p>
                          <p className="text-[11px] text-text-muted">+{order.deliveryFeeDzd.toLocaleString()} DA</p>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-text-muted" />
                          <span className="text-xs">{order.customer.wilaya}</span>
                        </div>
                      </td>
                      <td>
                        <span className={cn('badge text-[9px]', status.bgColor, status.color)}>
                          {status.label}
                        </span>
                      </td>
                      <td>
                        <span className={cn('badge text-[9px]', confirm.bgColor, confirm.color)}>
                          {confirm.label}
                        </span>
                      </td>
                      <td>
                        <span className="text-xs text-text-muted">{formatDate(order.createdAt)}</span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setShowDetailDrawer(order.id)}
                            className="p-1.5 rounded-lg hover:bg-white/[0.05] text-text-muted hover:text-info transition-all"
                            title="View Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => openEditModal(order)}
                            className="p-1.5 rounded-lg hover:bg-white/[0.05] text-text-muted hover:text-gold transition-all"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {canAdvance && (
                            <button
                              onClick={() => setShowStatusAdvance(order.id)}
                              className="px-2 py-1 rounded-md text-[10px] font-medium bg-gold/10 text-gold border border-gold/20 hover:bg-gold/20 transition-all"
                              title={NEXT_LABEL[order.status] || 'Advance'}
                            >
                              {NEXT_LABEL[order.status] || 'Advance'}
                            </button>
                          )}
                          <button
                            onClick={() => setShowDeleteConfirm(order.id)}
                            className="p-1.5 rounded-lg hover:bg-white/[0.05] text-text-muted hover:text-danger transition-all"
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-border">
              <p className="text-xs text-text-muted">
                Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredOrders.length)} of {filteredOrders.length}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg hover:bg-white/[0.05] text-text-muted disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={cn(
                      'w-7 h-7 rounded-lg text-xs font-medium transition-all',
                      currentPage === page
                        ? 'bg-gold/15 text-gold border border-gold/20'
                        : 'text-text-muted hover:bg-white/[0.05]'
                    )}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg hover:bg-white/[0.05] text-text-muted disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── CREATE MODAL ─────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
          <div className="relative bg-bg-surface border border-border rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-bg-surface border-b border-border px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center">
                  <Plus className="w-4 h-4 text-gold" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Create New Order</h2>
                  <p className="text-xs text-text-muted">Fill in the order details below</p>
                </div>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="p-2 rounded-lg hover:bg-white/[0.05] text-text-muted">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              {renderFormFields(createForm, setCreateForm)}
            </div>
            <div className="sticky bottom-0 bg-bg-surface border-t border-border px-6 py-4 flex items-center justify-end gap-3">
              <button onClick={() => setShowCreateModal(false)} className="btn-secondary">Cancel</button>
              <button
                onClick={handleCreateOrder}
                disabled={!createForm.customerName || !createForm.customerPhone || !createForm.wilayaId || !createForm.productId}
                className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ShoppingCart className="w-4 h-4" />
                Create Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── EDIT MODAL ───────────────────────────────────── */}
      {showEditModal && editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowEditModal(false); resetEditForm() }} />
          <div className="relative bg-bg-surface border border-border rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-bg-surface border-b border-border px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center">
                  <Pencil className="w-4 h-4 text-gold" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Edit {editingOrder.orderNumber}</h2>
                  <p className="text-xs text-text-muted">Update order details</p>
                </div>
              </div>
              <button onClick={() => { setShowEditModal(false); resetEditForm() }} className="p-2 rounded-lg hover:bg-white/[0.05] text-text-muted">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              {renderFormFields(editForm, setEditForm)}
            </div>
            <div className="sticky bottom-0 bg-bg-surface border-t border-border px-6 py-4 flex items-center justify-end gap-3">
              <button onClick={() => { setShowEditModal(false); resetEditForm() }} className="btn-secondary">Cancel</button>
              <button onClick={handleEditOrder} className="btn-primary">
                <CheckCircle className="w-4 h-4" />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── DELETE CONFIRM ───────────────────────────────── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(null)} />
          <div className="relative bg-bg-surface border border-border rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-danger" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Delete Order</h3>
            <p className="text-sm text-text-muted mb-6">
              Are you sure you want to delete order <span className="text-text-primary font-medium">{orders.find(o => o.id === showDeleteConfirm)?.orderNumber}</span>? This action cannot be undone.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => setShowDeleteConfirm(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => handleDeleteOrder(showDeleteConfirm)} className="btn-primary bg-danger/15 text-danger border-danger/20 hover:bg-danger/25">
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── STATUS ADVANCE MODAL ─────────────────────────── */}
      {showStatusAdvance && (() => {
        const order = orders.find(o => o.id === showStatusAdvance)
        if (!order) return null
        const next = NEXT_STATUS[order.status]
        if (!next) return null
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowStatusAdvance(null)} />
            <div className="relative bg-bg-surface border border-border rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center">
              <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-4">
                <Truck className="w-6 h-6 text-gold" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Advance Status</h3>
              <p className="text-sm text-text-muted mb-2">
                Move <span className="text-text-primary font-medium">{order.orderNumber}</span> from
              </p>
              <div className="flex items-center justify-center gap-3 mb-6">
                <span className={cn('badge text-xs', statusConfig[order.status].bgColor, statusConfig[order.status].color)}>
                  {statusConfig[order.status].label}
                </span>
                <span className="text-text-muted">→</span>
                <span className={cn('badge text-xs', statusConfig[next].bgColor, statusConfig[next].color)}>
                  {statusConfig[next].label}
                </span>
              </div>
              {next === 'DELIVERED' && (
                <p className="text-xs text-gold mb-4">This will record a revenue of {formatDzd(order.sellingPriceDzd)}</p>
              )}
              <div className="flex items-center justify-center gap-3">
                <button onClick={() => setShowStatusAdvance(null)} className="btn-secondary">Cancel</button>
                <button onClick={() => handleAdvanceStatus(order)} className="btn-primary">
                  <Send className="w-4 h-4" />
                  {NEXT_LABEL[order.status] || 'Advance'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ─── CONFIRMATION MODAL ───────────────────────────── */}
      {showConfirmModal && (() => {
        const order = orders.find(o => o.id === showConfirmModal)
        if (!order) return null
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowConfirmModal(null)} />
            <div className="relative bg-bg-surface border border-border rounded-2xl w-full max-w-sm p-6 shadow-2xl">
              <div className="text-center mb-5">
                <div className="w-12 h-12 rounded-full bg-info/10 flex items-center justify-center mx-auto mb-4">
                  <Phone className="w-6 h-6 text-info" />
                </div>
                <h3 className="text-lg font-semibold mb-1">Confirmation Status</h3>
                <p className="text-sm text-text-muted">
                  Set confirmation for <span className="text-text-primary font-medium">{order.orderNumber}</span>
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(['CONFIRMED', 'NO_ANSWER', 'CALL_BACK', 'WRONG_NUMBER', 'CANCELLED'] as ConfirmationStatus[]).map(conf => {
                  const cfg = confirmationConfig[conf]
                  return (
                    <button
                      key={conf}
                      onClick={() => handleSetConfirmation(order, conf)}
                      className={cn(
                        'p-3 rounded-xl border text-sm font-medium transition-all hover:scale-[1.02]',
                        conf === 'CONFIRMED' ? 'border-success/20 bg-success/5 text-success hover:bg-success/10' :
                        conf === 'CANCELLED' ? 'border-danger/20 bg-danger/5 text-danger hover:bg-danger/10' :
                        'border-border bg-white/[0.02] text-text-secondary hover:bg-white/[0.05]'
                      )}
                    >
                      {cfg.label}
                    </button>
                  )
                })}
              </div>
              <div className="mt-4 text-center">
                <button onClick={() => setShowConfirmModal(null)} className="text-xs text-text-muted hover:text-text-secondary">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ─── DETAIL DRAWER ────────────────────────────────── */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDetailDrawer(null)} />
          <div className="relative bg-bg-surface border-l border-border w-full max-w-lg overflow-y-auto shadow-2xl animate-in slide-in-from-right">
            {/* Header */}
            <div className="sticky top-0 bg-bg-surface border-b border-border px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center">
                  <Eye className="w-4 h-4 text-gold" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{selectedOrder.orderNumber}</h2>
                  <p className="text-xs text-text-muted">Created {formatDateTime(selectedOrder.createdAt)}</p>
                </div>
              </div>
              <button onClick={() => setShowDetailDrawer(null)} className="p-2 rounded-lg hover:bg-white/[0.05] text-text-muted">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Status Row */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className={cn('badge text-xs', statusConfig[selectedOrder.status].bgColor, statusConfig[selectedOrder.status].color)}>
                  {statusConfig[selectedOrder.status].label}
                </span>
                <span className={cn('badge text-xs', confirmationConfig[selectedOrder.confirmationStatus].bgColor, confirmationConfig[selectedOrder.confirmationStatus].color)}>
                  {confirmationConfig[selectedOrder.confirmationStatus].label}
                </span>
                <span className="badge text-xs bg-white/[0.05] text-text-muted">
                  {selectedOrder.paymentMethod}
                </span>
              </div>

              {/* Customer Info */}
              <div className="glass-card p-4">
                <h4 className="text-xs font-semibold text-gold uppercase tracking-wider mb-3 flex items-center gap-2">
                  <User className="w-3 h-3" /> Customer
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="w-3.5 h-3.5 text-text-muted" />
                    <span className="text-text-primary font-medium">{selectedOrder.customer.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-3.5 h-3.5 text-text-muted" />
                    <span>{selectedOrder.customer.phone}</span>
                    {selectedOrder.customer.phoneAlt && (
                      <span className="text-text-muted">/ {selectedOrder.customer.phoneAlt}</span>
                    )}
                  </div>
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="w-3.5 h-3.5 text-text-muted mt-0.5" />
                    <div>
                      <p>{selectedOrder.customer.address}</p>
                      <p className="text-text-muted">{selectedOrder.customer.commune}, {selectedOrder.customer.wilaya}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {selectedOrder.customer.deliveryType === 'HOME' ? (
                      <Home className="w-3.5 h-3.5 text-text-muted" />
                    ) : (
                      <Building2 className="w-3.5 h-3.5 text-text-muted" />
                    )}
                    <span>{selectedOrder.customer.deliveryType === 'HOME' ? 'Home Delivery' : 'Stop Desk'}</span>
                  </div>
                </div>
              </div>

              {/* Product & Pricing */}
              <div className="glass-card p-4">
                <h4 className="text-xs font-semibold text-gold uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Package className="w-3 h-3" /> Product & Pricing
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-muted">Product</span>
                    <span className="text-gold font-medium">{getProduct(selectedOrder.productId)?.name || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-muted">Quantity</span>
                    <span>{selectedOrder.quantity}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-muted">Selling Price</span>
                    <span className="font-medium">{formatDzd(selectedOrder.sellingPriceDzd)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-muted">Delivery Fee</span>
                    <span>{formatDzd(selectedOrder.deliveryFeeDzd)}</span>
                  </div>
                  <div className="border-t border-border pt-2 flex items-center justify-between text-sm">
                    <span className="text-text-muted font-semibold">Total</span>
                    <span className="text-gold font-bold">{formatDzd(selectedOrder.sellingPriceDzd + selectedOrder.deliveryFeeDzd)}</span>
                  </div>
                </div>
              </div>

              {/* Shipping */}
              {selectedOrder.carrierId && (
                <div className="glass-card p-4">
                  <h4 className="text-xs font-semibold text-gold uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Truck className="w-3 h-3" /> Shipping
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-text-muted">Carrier</span>
                      <span>{getCarrier(selectedOrder.carrierId)?.name || '-'}</span>
                    </div>
                    {selectedOrder.trackingNumber && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-text-muted">Tracking</span>
                        <span className="font-mono text-xs">{selectedOrder.trackingNumber}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedOrder.notes && (
                <div className="glass-card p-4">
                  <h4 className="text-xs font-semibold text-gold uppercase tracking-wider mb-3 flex items-center gap-2">
                    <StickyNote className="w-3 h-3" /> Notes
                  </h4>
                  <p className="text-sm text-text-secondary">{selectedOrder.notes}</p>
                </div>
              )}

              {/* Timeline */}
              <div className="glass-card p-4">
                <h4 className="text-xs font-semibold text-gold uppercase tracking-wider mb-4 flex items-center gap-2">
                  <History className="w-3 h-3" /> Order Timeline
                </h4>
                <div className="space-y-0">
                  {buildTimeline(selectedOrder).map((event, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={cn('w-2.5 h-2.5 rounded-full shrink-0 mt-1', event.color)} />
                        {i < buildTimeline(selectedOrder).length - 1 && (
                          <div className="w-px flex-1 bg-border my-1" />
                        )}
                      </div>
                      <div className="pb-4">
                        <p className="text-sm font-medium">{event.label}</p>
                        <p className="text-[11px] text-text-muted">{formatDateTime(event.date)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => { setShowDetailDrawer(null); openEditModal(selectedOrder) }}
                  className="btn-secondary text-xs"
                >
                  <Pencil className="w-3 h-3" />
                  Edit Order
                </button>
                <button
                  onClick={() => { setShowDetailDrawer(null); setShowConfirmModal(selectedOrder.id) }}
                  className="btn-secondary text-xs"
                >
                  <Phone className="w-3 h-3" />
                  Set Confirmation
                </button>
                {NEXT_STATUS[selectedOrder.status] && selectedOrder.status !== 'CANCELLED' && selectedOrder.status !== 'DELIVERED' && selectedOrder.status !== 'RETURNED' && (
                  <button
                    onClick={() => { setShowDetailDrawer(null); setShowStatusAdvance(selectedOrder.id) }}
                    className="btn-primary text-xs"
                  >
                    <Send className="w-3 h-3" />
                    {NEXT_LABEL[selectedOrder.status] || 'Advance'}
                  </button>
                )}
                <button
                  onClick={() => { setShowDetailDrawer(null); setShowDeleteConfirm(selectedOrder.id) }}
                  className="btn-secondary text-xs text-danger hover:bg-danger/10"
                >
                  <Trash2 className="w-3 h-3" />
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
