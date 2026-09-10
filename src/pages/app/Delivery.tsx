import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import {
  Truck,
  Package,
  CheckCircle,
  RotateCcw,
  MapPin,
  Plus,
  Search,
  X,
  Eye,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Clock,
  AlertTriangle,
  StickyNote,
  Send,
  Calendar,
  DollarSign,
  ExternalLink,
  ChevronDown,
  Building2,
  RefreshCw,
  Copy,
  FileText,
  Wifi,
  WifiOff,
  Link as LinkIcon,
  Zap,
  PackageCheck,
  PackageX,
  CircleDollarSign,
  Wallet,
} from 'lucide-react'
import { useAppState } from '@/stores/AppState'
import { cn } from '@/lib/utils'
import type {
  Shipment,
  DeliveryProvider,
  DeliveryServiceType,
  EcomDelivery,
  EcomDeliveryStatus,
} from '@/types'
import {
  createColis,
  getColisStatuts,
  testEcomConnection,
  getBordereau,
  deleteColis,
  syncRecentDeliveries,
  getWebhookEvents,
} from '@/lib/api'

// ─── Constants ──────────────────────────────────────────────

const ITEMS_PER_PAGE = 10

const ECOM_STATUS_CONFIG: Record<EcomDeliveryStatus, { label: string; color: string; bgColor: string }> = {
  PREPARING: { label: 'En Préparation', color: 'text-yellow-400', bgColor: 'bg-yellow-400/12' },
  PROCESSING: { label: 'En Traitement', color: 'text-blue-400', bgColor: 'bg-blue-400/12' },
  DISPATCHED: { label: 'Expédié', color: 'text-indigo-400', bgColor: 'bg-indigo-400/12' },
  AT_OFFICE: { label: 'Au Bureau', color: 'text-purple-400', bgColor: 'bg-purple-400/12' },
  OUT_FOR_DELIVERY: { label: 'En Livraison', color: 'text-orange', bgColor: 'bg-orange/12' },
  DELIVERED: { label: 'Livrée', color: 'text-success', bgColor: 'bg-success/12' },
  NO_ANSWER: { label: 'Pas de Réponse', color: 'text-yellow-400', bgColor: 'bg-yellow-400/12' },
  POSTPONED: { label: 'Reportée', color: 'text-yellow-400', bgColor: 'bg-yellow-400/12' },
  CANCELLED: { label: 'Annulée', color: 'text-danger', bgColor: 'bg-danger/12' },
  RETURNED: { label: 'Retournée', color: 'text-danger', bgColor: 'bg-danger/12' },
  DISPATCH_RETURN: { label: 'Retour Dispatch', color: 'text-danger', bgColor: 'bg-danger/12' },
  NAVETTE_RETURN: { label: 'Retour Navette', color: 'text-danger', bgColor: 'bg-danger/12' },
  COLLECTED: { label: 'Collectée', color: 'text-success', bgColor: 'bg-success/12' },
  RECOVERED: { label: 'Récupérée', color: 'text-success', bgColor: 'bg-success/12' },
  CONFIRMED: { label: 'Confirmée', color: 'text-info', bgColor: 'bg-info/12' },
  TRACKING: { label: 'Suivi', color: 'text-info', bgColor: 'bg-info/12' },
  IN_PROGRESS: { label: 'En Cours', color: 'text-info', bgColor: 'bg-info/12' },
}

const SHIPMENT_STATUSES: Shipment['status'][] = [
  'PICKED_UP', 'IN_TRANSIT', 'AT_HUB', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED', 'LOST',
]

const shipmentStatusConfig: Record<Shipment['status'], { label: string; color: string; bgColor: string; icon: string }> = {
  PICKED_UP: { label: 'Picked Up', color: 'text-info', bgColor: 'bg-info/12', icon: '📦' },
  IN_TRANSIT: { label: 'In Transit', color: 'text-orange', bgColor: 'bg-orange/12', icon: '🚚' },
  AT_HUB: { label: 'At Hub', color: 'text-purple', bgColor: 'bg-purple/12', icon: '🏢' },
  OUT_FOR_DELIVERY: { label: 'Out for Delivery', color: 'text-gold', bgColor: 'bg-gold/12', icon: '📍' },
  DELIVERED: { label: 'Delivered', color: 'text-success', bgColor: 'bg-success/12', icon: '✅' },
  RETURNED: { label: 'Returned', color: 'text-danger', bgColor: 'bg-danger/12', icon: '↩' },
  LOST: { label: 'Lost', color: 'text-danger', bgColor: 'bg-danger/12', icon: '❌' },
}

const serviceTypeLabels: Record<DeliveryServiceType, string> = {
  HOME_DELIVERY: 'Home Delivery',
  STOP_DESK: 'Stop Desk',
  EXPRESS: 'Express',
}

const NEXT_SHIPMENT_STATUS: Partial<Record<Shipment['status'], Shipment['status']>> = {
  PICKED_UP: 'IN_TRANSIT',
  IN_TRANSIT: 'AT_HUB',
  AT_HUB: 'OUT_FOR_DELIVERY',
  OUT_FOR_DELIVERY: 'DELIVERED',
}

type EcomTab = 'ecom' | 'shipments' | 'providers'
type ShipmentSortField = 'createdAt' | 'cost' | 'trackingNumber' | 'status'
type SortDir = 'asc' | 'desc'

interface ShipmentFormData {
  orderId: string
  providerId: string
  trackingNumber: string
  serviceType: DeliveryServiceType
  cost: number
  weightKg: number
  estimatedDelivery: string
  notes: string
}

interface ProviderFormData {
  name: string
  code: string
  trackingUrl: string
  services: DeliveryServiceType[]
  pricePerKg: number
  pricePerOrder: number
  isActive: boolean
  notes: string
}

const emptyShipmentForm: ShipmentFormData = {
  orderId: '', providerId: '', trackingNumber: '', serviceType: 'HOME_DELIVERY',
  cost: 0, weightKg: 0, estimatedDelivery: '', notes: '',
}

const emptyProviderForm: ProviderFormData = {
  name: '', code: '', trackingUrl: '', services: ['HOME_DELIVERY'],
  pricePerKg: 0, pricePerOrder: 0, isActive: true, notes: '',
}

// ─── Helpers ────────────────────────────────────────────────

function formatDate(d: Date | string | undefined): string {
  if (!d) return '-'
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(d))
}

function formatDateTime(d: Date | string | undefined): string {
  if (!d) return '-'
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d))
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec} sec`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} min`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h`
  const days = Math.floor(hr / 24)
  return `${days}j`
}

function formatDzd(amount: number): string {
  return `${amount.toLocaleString()} DA`
}

function isDelayed(shipment: Shipment): boolean {
  if (!shipment.estimatedDelivery) return false
  if (shipment.status === 'DELIVERED' || shipment.status === 'RETURNED' || shipment.status === 'LOST') return false
  return new Date() > new Date(shipment.estimatedDelivery)
}

// ─── Component ──────────────────────────────────────────────

export function Delivery() {
  const {
    orders, shipments, deliveryProviders, ecomDeliveries, confirmations,
    addShipment, updateShipment, addDeliveryProvider, updateDeliveryProvider,
    deleteDeliveryProvider, updateOrder, currentUser, addActivityLog,
    addNotification, addEcomDelivery, updateEcomDelivery, deleteEcomDelivery,
    getDeliveryHistory, products, sellingProducts,
  } = useAppState()

  // ─── Tab State ──────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<EcomTab>('ecom')

  // ─── E-com Delivery State ───────────────────────────────
  const [ecomSearch, setEcomSearch] = useState('')
  const [ecomStatusFilter, setEcomStatusFilter] = useState<EcomDeliveryStatus | 'ALL'>('ALL')
  const [ecomModeFilter, setEcomModeFilter] = useState<'ALL' | 'HOME' | 'STOP_DESK'>('ALL')
  const [ecomDateFrom, setEcomDateFrom] = useState('')
  const [ecomDateTo, setEcomDateTo] = useState('')
  const [ecomPage, setEcomPage] = useState(1)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle')
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)
  const [syncResult, setSyncResult] = useState<string>('')
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle')
  const [webhookEvents, setWebhookEvents] = useState<Array<{ id: string; tracking: string; situation: string; receivedAt: string; result: string }>>([])
  const [showWebhookPanel, setShowWebhookPanel] = useState(false)

  // ─── Shipment State ─────────────────────────────────────
  const [shipmentSearch, setShipmentSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<Shipment['status'] | 'ALL'>('ALL')
  const [filterProvider, setFilterProvider] = useState<string>('ALL')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [shipmentSortField, setShipmentSortField] = useState<ShipmentSortField>('createdAt')
  const [shipmentSortDir, setShipmentSortDir] = useState<SortDir>('desc')
  const [shipmentPage, setShipmentPage] = useState(1)

  // ─── Provider State ─────────────────────────────────────
  const [providerSearch, setProviderSearch] = useState('')

  // ─── Modals ─────────────────────────────────────────────
  const [showCreateShipment, setShowCreateShipment] = useState(false)
  const [showEditShipment, setShowEditShipment] = useState(false)
  const [editingShipment, setEditingShipment] = useState<Shipment | null>(null)
  const [showShipmentDetail, setShowShipmentDetail] = useState<string | null>(null)
  const [showDeleteShipment, setShowDeleteShipment] = useState<string | null>(null)
  const [showStatusAdvance, setShowStatusAdvance] = useState<string | null>(null)
  const [showCreateProvider, setShowCreateProvider] = useState(false)
  const [showEditProvider, setShowEditProvider] = useState(false)
  const [editingProvider, setEditingProvider] = useState<DeliveryProvider | null>(null)
  const [showDeleteProvider, setShowDeleteProvider] = useState<string | null>(null)
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null)
  const [showCreateEcomColis, setShowCreateEcomColis] = useState(false)
  const [selectedEcomOrderId, setSelectedEcomOrderId] = useState('')
  const [ecomDeliveryMode, setEcomDeliveryMode] = useState<'HOME' | 'STOP_DESK'>('HOME')
  const [showEcomDetail, setShowEcomDetail] = useState<string | null>(null)
  const [showDeleteEcom, setShowDeleteEcom] = useState<string | null>(null)
  const [ecomCreateLoading, setEcomCreateLoading] = useState(false)
  const [ecomCreateError, setEcomCreateError] = useState('')
  const [ecomSyncLoading, setEcomSyncLoading] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ─── Forms ──────────────────────────────────────────────
  const [shipmentForm, setShipmentForm] = useState<ShipmentFormData>(emptyShipmentForm)
  const [providerForm, setProviderForm] = useState<ProviderFormData>(emptyProviderForm)

  // ─── Derived data ───────────────────────────────────────

  const getOrder = useCallback((id: string) => orders.find(o => o.id === id), [orders])
  const getProvider = useCallback((id: string) => deliveryProviders.find(d => d.id === id), [deliveryProviders])
  const getProduct = useCallback((id: string) => {
    const sp = sellingProducts.find(p => p.id === id)
    if (sp) return sp
    return products.find(p => p.id === id)
  }, [sellingProducts, products])

  const selectedShipment = useMemo(
    () => shipments.find(s => s.id === showShipmentDetail),
    [shipments, showShipmentDetail]
  )

  const selectedEcomDelivery = useMemo(
    () => ecomDeliveries.find(d => d.id === showEcomDetail),
    [ecomDeliveries, showEcomDetail]
  )

  const ecomDeliveryHistory = useMemo(() => {
    if (!showEcomDetail) return []
    return getDeliveryHistory(showEcomDetail)
  }, [showEcomDetail, getDeliveryHistory, ecomDeliveries])

  // ─── Confirmations with E-com Tracking ───────────────────

  const confirmationDeliveries = useMemo(() => {
    return confirmations
      .filter(c => c.ecomTracking)
      .map(c => ({
        id: c.id,
        orderId: c.id,
        foxboxOrderNumber: c.id,
        provider: 'ecom_delivery' as const,
        ecomTracking: c.ecomTracking!,
        ecomIdColis: c.ecomParcelId,
        ecomIdExterne: c.ecomIdExterne,
        ecomSituation: c.ecomStatusText || c.ecomStatus || '',
        ecomSituationId: c.ecomStatusId || 0,
        ecomEtatLogistique: c.ecomLogisticsState || '',
        ecomEtatLogistiqueId: c.ecomLogisticsStateId || 0,
        status: (c.ecomStatus || 'PREPARING') as EcomDeliveryStatus,
        statusLabel: c.ecomStatusText || 'Envoyé',
        customerName: c.fullName,
        customerPhone: c.phone,
        wilayaCode: c.wilayaCode,
        wilayaName: c.wilayaName,
        commune: c.baladiya,
        deliveryMode: (c.shippingMethod === 'HOME' ? 'HOME' : 'STOP_DESK') as 'HOME' | 'STOP_DESK',
        address: c.address,
        stopdeskCode: c.officeRef,
        stopdeskName: c.officeName,
        product: c.productId || '',
        quantity: c.quantity,
        total: c.total,
        ecomTarifLivraison: c.deliveryPrice,
        ecomRecouvert: 0,
        ecomLastActionAt: c.ecomSentAt || c.updatedAt?.toISOString(),
        createdAt: c.ecomSentAt ? new Date(c.ecomSentAt) : c.createdAt,
        updatedAt: c.ecomLastSyncAt ? new Date(c.ecomLastSyncAt) : c.updatedAt,
      }))
  }, [confirmations])

  // ─── E-com KPIs ────────────────────────────────────────

  const ecomKPIs = useMemo(() => {
    const allDeliveries = [...ecomDeliveries, ...confirmationDeliveries]
    const total = allDeliveries.length
    const preparing = allDeliveries.filter(d => d.status === 'PREPARING').length
    const inDelivery = allDeliveries.filter(d => ['OUT_FOR_DELIVERY', 'IN_PROGRESS', 'TRACKING', 'DISPATCHED', 'AT_OFFICE'].includes(d.status)).length
    const delivered = allDeliveries.filter(d => d.status === 'DELIVERED').length
    const returned = allDeliveries.filter(d => ['RETURNED', 'DISPATCH_RETURN', 'NAVETTE_RETURN'].includes(d.status)).length
    const cancelled = allDeliveries.filter(d => d.status === 'CANCELLED').length
    const encaisses = allDeliveries.filter(d => d.status === 'COLLECTED' || d.status === 'RECOVERED').length
    const recouverts = allDeliveries.filter(d => ('ecomRecouvert' in d ? (d.ecomRecouvert as number) || 0 : 0) > 0).length
    return { total, preparing, inDelivery, delivered, returned, cancelled, encaisses, recouverts }
  }, [ecomDeliveries, confirmationDeliveries])

  // ─── E-com Status Counts for Chips ──────────────────────

  const ecomStatusCounts = useMemo(() => {
    const allDeliveries = [...ecomDeliveries, ...confirmationDeliveries]
    const counts: Record<string, number> = { ALL: allDeliveries.length }
    allDeliveries.forEach(d => {
      counts[d.status] = (counts[d.status] || 0) + 1
    })
    return counts
  }, [ecomDeliveries, confirmationDeliveries])

  // ─── Filtered E-com Deliveries ──────────────────────────

  const filteredEcomDeliveries = useMemo(() => {
    const allDeliveries = [...ecomDeliveries, ...confirmationDeliveries]
    let result = allDeliveries.filter(d => {
      const q = ecomSearch.toLowerCase()
      const matchesSearch =
        !ecomSearch ||
        d.ecomTracking.toLowerCase().includes(q) ||
        (d.foxboxOrderNumber || '').toLowerCase().includes(q) ||
        d.customerName.toLowerCase().includes(q) ||
        d.customerPhone.includes(q)
      const matchesStatus = ecomStatusFilter === 'ALL' || d.status === ecomStatusFilter
      const matchesMode = ecomModeFilter === 'ALL' || d.deliveryMode === ecomModeFilter
      const matchesDateFrom = !ecomDateFrom || new Date(d.createdAt) >= new Date(ecomDateFrom)
      const matchesDateTo = !ecomDateTo || new Date(d.createdAt) <= new Date(ecomDateTo + 'T23:59:59')
      return matchesSearch && matchesStatus && matchesMode && matchesDateFrom && matchesDateTo
    })
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return result
  }, [ecomDeliveries, confirmationDeliveries, ecomSearch, ecomStatusFilter, ecomModeFilter, ecomDateFrom, ecomDateTo])

  const ecomTotalPages = Math.max(1, Math.ceil(filteredEcomDeliveries.length / ITEMS_PER_PAGE))
  const paginatedEcomDeliveries = useMemo(
    () => filteredEcomDeliveries.slice((ecomPage - 1) * ITEMS_PER_PAGE, ecomPage * ITEMS_PER_PAGE),
    [filteredEcomDeliveries, ecomPage]
  )

  // ─── Unshipped Orders for E-com Colis ───────────────────

  const unshippedOrders = useMemo(() => {
    const shippedOrderIds = new Set(shipments.map(s => s.orderId))
    const ecomOrderIds = new Set(ecomDeliveries.filter(d => d.orderId).map(d => d.orderId))
    return orders.filter(o =>
      !shippedOrderIds.has(o.id) &&
      !ecomOrderIds.has(o.id) &&
      o.status !== 'CANCELLED' &&
      o.status !== 'RETURNED'
    )
  }, [orders, shipments, ecomDeliveries])

  // ─── Shipment KPIs ──────────────────────────────────────

  const shipmentKPIs = useMemo(() => {
    const total = shipments.length
    const inTransit = shipments.filter(s => s.status === 'IN_TRANSIT' || s.status === 'AT_HUB').length
    const delivered = shipments.filter(s => s.status === 'DELIVERED').length
    const returned = shipments.filter(s => s.status === 'RETURNED').length
    const delayed = shipments.filter(isDelayed).length
    return { total, inTransit, delivered, returned, delayed }
  }, [shipments])

  // ─── Filtered Shipments ─────────────────────────────────

  const filteredShipments = useMemo(() => {
    let result = shipments.filter(s => {
      const order = getOrder(s.orderId)
      const provider = getProvider(s.providerId)
      const q = shipmentSearch.toLowerCase()
      const matchesSearch =
        !shipmentSearch ||
        s.trackingNumber.toLowerCase().includes(q) ||
        (order?.orderNumber.toLowerCase().includes(q)) ||
        (provider?.name.toLowerCase().includes(q))
      const matchesStatus = filterStatus === 'ALL' || s.status === filterStatus
      const matchesProvider = filterProvider === 'ALL' || s.providerId === filterProvider
      const matchesDateFrom = !filterDateFrom || new Date(s.createdAt) >= new Date(filterDateFrom)
      const matchesDateTo = !filterDateTo || new Date(s.createdAt) <= new Date(filterDateTo + 'T23:59:59')
      return matchesSearch && matchesStatus && matchesProvider && matchesDateFrom && matchesDateTo
    })
    result.sort((a, b) => {
      let cmp = 0
      if (shipmentSortField === 'createdAt') cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      else if (shipmentSortField === 'cost') cmp = a.cost - b.cost
      else if (shipmentSortField === 'trackingNumber') cmp = a.trackingNumber.localeCompare(b.trackingNumber)
      else if (shipmentSortField === 'status') cmp = a.status.localeCompare(b.status)
      return shipmentSortDir === 'asc' ? cmp : -cmp
    })
    return result
  }, [shipments, shipmentSearch, filterStatus, filterProvider, filterDateFrom, filterDateTo, shipmentSortField, shipmentSortDir, getOrder, getProvider])

  const shipmentTotalPages = Math.max(1, Math.ceil(filteredShipments.length / ITEMS_PER_PAGE))
  const paginatedShipments = useMemo(
    () => filteredShipments.slice((shipmentPage - 1) * ITEMS_PER_PAGE, shipmentPage * ITEMS_PER_PAGE),
    [filteredShipments, shipmentPage]
  )

  const filteredProviders = useMemo(() => {
    if (!providerSearch) return deliveryProviders
    const q = providerSearch.toLowerCase()
    return deliveryProviders.filter(p => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q))
  }, [deliveryProviders, providerSearch])

  const shipmentStatusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: shipments.length }
    shipments.forEach(s => { counts[s.status] = (counts[s.status] || 0) + 1 })
    return counts
  }, [shipments])

  // ─── Sync Logic ─────────────────────────────────────────

  const handleSync = useCallback(async () => {
    setEcomSyncLoading(true)
    setSyncStatus('syncing')
    try {
      const result = await syncRecentDeliveries() as { updated?: number; created?: number; message?: string }
      setSyncStatus('success')
      setLastSyncAt(new Date().toISOString())
      setSyncResult(`${result.created || 0} créées, ${result.updated || 0} mises à jour`)
      setTimeout(() => setSyncStatus('idle'), 3000)
    } catch {
      setSyncStatus('error')
      setTimeout(() => setSyncStatus('idle'), 5000)
    } finally {
      setEcomSyncLoading(false)
    }
  }, [])

  // ─── Auto-sync timer ────────────────────────────────────

  useEffect(() => {
    syncIntervalRef.current = setInterval(() => {
      if (lastSyncAt) setLastSyncAt(prev => prev)
    }, 30000)
    return () => { if (syncIntervalRef.current) clearInterval(syncIntervalRef.current) }
  }, [lastSyncAt])

  // ─── Test Connection ────────────────────────────────────

  const handleTestConnection = useCallback(async () => {
    setConnectionStatus('testing')
    try {
      await testEcomConnection()
      setConnectionStatus('ok')
      setTimeout(() => setConnectionStatus('idle'), 3000)
    } catch {
      setConnectionStatus('error')
      setTimeout(() => setConnectionStatus('idle'), 5000)
    }
  }, [])

  // ─── Load Webhook Events ────────────────────────────────

  const loadWebhookEvents = useCallback(async () => {
    try {
      const events = await getWebhookEvents() as Array<{ id: string; tracking: string; situation: string; receivedAt: string; result: string }>
      setWebhookEvents(events.slice(0, 10))
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (showWebhookPanel) loadWebhookEvents()
  }, [showWebhookPanel, loadWebhookEvents])

  // ─── Create E-com Colis ────────────────────────────────

  const handleCreateEcomColis = useCallback(async () => {
    const order = orders.find(o => o.id === selectedEcomOrderId)
    if (!order) return
    setEcomCreateLoading(true)
    setEcomCreateError('')
    try {
      const payload = {
        client: {
          nom_complet: order.customer.name,
          telephone: order.customer.phone,
          telephone_2: order.customer.phoneAlt || '',
          adresse: order.customer.address,
          wilaya: order.customer.wilaya,
          commune: order.customer.commune,
        },
        colis: {
         Produit: order.productId ? getProduct(order.productId)?.name || 'Produit' : 'Produit',
          quantite: order.quantity,
          prix_total: order.sellingPriceDzd + order.deliveryFeeDzd,
          prix_livraison: order.deliveryFeeDzd,
          mode_livraison: ecomDeliveryMode === 'HOME' ? 1 : 2,
          seleccion: 1,
        },
      }
      const result = await createColis(payload) as { tracking?: string; id_colis?: number; id_externe?: string; situation?: string; etat_logistique?: string }
      const now = new Date()
      const tracking = result.tracking || `ECOM-${Date.now()}`
      const ecomDelivery: EcomDelivery = {
        id: `ecom_${Date.now()}`,
        orderId: order.id,
        foxboxOrderNumber: order.orderNumber,
        provider: 'ecom_delivery',
        ecomTracking: tracking,
        ecomIdColis: result.id_colis,
        ecomIdExterne: result.id_externe,
        ecomSituation: result.situation || 'En attente',
        ecomSituationId: 0,
        ecomEtatLogistique: result.etat_logistique || 'En attente',
        ecomEtatLogistiqueId: 0,
        status: 'PREPARING',
        statusLabel: 'En Préparation',
        customerName: order.customer.name,
        customerPhone: order.customer.phone,
        customerPhoneAlt: order.customer.phoneAlt,
        wilayaCode: order.customer.wilaya,
        wilayaName: order.customer.wilaya,
        commune: order.customer.commune,
        deliveryMode: ecomDeliveryMode,
        address: order.customer.address,
        product: order.productId ? getProduct(order.productId)?.name || 'Produit' : 'Produit',
        quantity: order.quantity,
        total: order.sellingPriceDzd + order.deliveryFeeDzd,
        createdAt: now,
        updatedAt: now,
      }
      addEcomDelivery(ecomDelivery)
      updateOrder({ ...order, status: 'SHIPPED', shippedAt: now, trackingNumber: tracking, updatedAt: now })
      addActivityLog({
        id: `al_${Date.now()}`, action: 'ORDER_UPDATED', userId: currentUser?.id || 'unknown',
        entityType: 'ORDER', entityId: ecomDelivery.id, entityName: tracking,
        details: `E-com colis created for order ${order.orderNumber}`, createdAt: now,
      })
      addNotification({
        id: `n_${Date.now()}`, type: 'ORDER_RECEIVED', title: 'E-com Colis Created',
        message: `Tracking ${tracking} assigned to ${order.orderNumber}`, link: '/app/delivery',
        isRead: false, userId: currentUser?.id || 'unknown', createdAt: now,
      })
      setShowCreateEcomColis(false)
      setSelectedEcomOrderId('')
    } catch (err) {
      setEcomCreateError(err instanceof Error ? err.message : 'Erreur lors de la création du colis')
    } finally {
      setEcomCreateLoading(false)
    }
  }, [selectedEcomOrderId, ecomDeliveryMode, orders, getProduct, addEcomDelivery, updateOrder, addActivityLog, addNotification, currentUser])

  // ─── Delete E-com Delivery ──────────────────────────────

  const handleDeleteEcom = useCallback(async (id: string) => {
    const delivery = ecomDeliveries.find(d => d.id === id)
    if (delivery?.ecomTracking) {
      try { await deleteColis(delivery.ecomTracking) } catch { /* best effort */ }
    }
    deleteEcomDelivery(id)
    addActivityLog({
      id: `al_${Date.now()}`, action: 'ORDER_UPDATED', userId: currentUser?.id || 'unknown',
      entityType: 'ORDER', entityId: id, entityName: delivery?.ecomTracking || '',
      details: 'E-com delivery deleted', createdAt: new Date(),
    })
    setShowDeleteEcom(null)
    if (showEcomDetail === id) setShowEcomDetail(null)
  }, [ecomDeliveries, deleteEcomDelivery, addActivityLog, currentUser, showEcomDetail])

  // ─── Sync Single Delivery Status ────────────────────────

  const handleSyncSingleStatus = useCallback(async (delivery: EcomDelivery) => {
    try {
      const statuses = await getColisStatuts([delivery.ecomTracking]) as Array<{ tracking: string; situation: string; etat_logistique: string }>
      if (statuses.length > 0) {
        const s = statuses[0]
        const now = new Date()
        updateEcomDelivery({ ...delivery, ecomSituation: s.situation, ecomEtatLogistique: s.etat_logistique, ecomLastSyncAt: now.toISOString(), updatedAt: now })
      }
    } catch { /* ignore */ }
  }, [updateEcomDelivery])

  // ─── Copy Tracking ──────────────────────────────────────

  const handleCopyTracking = useCallback((tracking: string) => {
    navigator.clipboard.writeText(tracking)
    setCopySuccess(true)
    setTimeout(() => setCopySuccess(false), 2000)
  }, [])

  // ─── View Bordereau ─────────────────────────────────────

  const handleViewBordereau = useCallback(async (tracking: string) => {
    try {
      const result = await getBordereau(tracking) as { url?: string; pdf?: string }
      if (result.url) window.open(result.url, '_blank')
      else if (result.pdf) {
        const byteChars = atob(result.pdf)
        const bytes = new Uint8Array(byteChars.length)
        for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
        const blob = new Blob([bytes], { type: 'application/pdf' })
        window.open(URL.createObjectURL(blob), '_blank')
      }
    } catch { /* ignore */ }
  }, [])

  // ─── Shipment Handlers ──────────────────────────────────

  function resetShipmentForm() { setShipmentForm(emptyShipmentForm) }
  function resetProviderForm() { setProviderForm(emptyProviderForm) }

  function handleCreateShipment() {
    if (!shipmentForm.orderId || !shipmentForm.providerId || !shipmentForm.trackingNumber) return
    const now = new Date()
    const shipmentId = `shp_${Date.now()}`
    const shipment: Shipment = {
      id: shipmentId, orderId: shipmentForm.orderId, providerId: shipmentForm.providerId,
      trackingNumber: shipmentForm.trackingNumber, serviceType: shipmentForm.serviceType,
      status: 'PICKED_UP', shippedAt: now,
      estimatedDelivery: shipmentForm.estimatedDelivery ? new Date(shipmentForm.estimatedDelivery) : undefined,
      cost: shipmentForm.cost, weightKg: shipmentForm.weightKg || undefined,
      notes: shipmentForm.notes || undefined, createdAt: now, updatedAt: now,
    }
    addShipment(shipment)
    const order = getOrder(shipmentForm.orderId)
    if (order) {
      updateOrder({ ...order, carrierId: shipmentForm.providerId, trackingNumber: shipmentForm.trackingNumber, status: 'SHIPPED', shippedAt: now, updatedAt: now })
    }
    addActivityLog({
      id: `al_${Date.now()}`, action: 'ORDER_UPDATED', userId: currentUser?.id || 'unknown',
      entityType: 'ORDER', entityId: shipmentId, entityName: shipmentForm.trackingNumber,
      details: `Shipment created via ${getProvider(shipmentForm.providerId)?.name || 'provider'}`, createdAt: now,
    })
    addNotification({
      id: `n_${Date.now()}`, type: 'ORDER_RECEIVED', title: 'Shipment Created',
      message: `Tracking ${shipmentForm.trackingNumber} assigned to ${order?.orderNumber || 'order'}`,
      link: '/app/delivery', isRead: false, userId: currentUser?.id || 'unknown', createdAt: now,
    })
    setShowCreateShipment(false)
    resetShipmentForm()
  }

  function handleEditShipment() {
    if (!editingShipment) return
    const now = new Date()
    const updated: Shipment = {
      ...editingShipment, providerId: shipmentForm.providerId, trackingNumber: shipmentForm.trackingNumber,
      serviceType: shipmentForm.serviceType, cost: shipmentForm.cost,
      weightKg: shipmentForm.weightKg || undefined,
      estimatedDelivery: shipmentForm.estimatedDelivery ? new Date(shipmentForm.estimatedDelivery) : undefined,
      notes: shipmentForm.notes || undefined, updatedAt: now,
    }
    updateShipment(updated)
    addActivityLog({
      id: `al_${Date.now()}`, action: 'ORDER_UPDATED', userId: currentUser?.id || 'unknown',
      entityType: 'ORDER', entityId: updated.id, entityName: updated.trackingNumber,
      details: 'Shipment details updated', createdAt: now,
    })
    setShowEditShipment(false)
    setEditingShipment(null)
    resetShipmentForm()
  }

  function handleDeleteShipment(id: string) {
    const shipment = shipments.find(s => s.id === id)
    if (shipment) {
      const order = getOrder(shipment.orderId)
      if (order) updateOrder({ ...order, carrierId: undefined, trackingNumber: undefined, updatedAt: new Date() })
      addActivityLog({
        id: `al_${Date.now()}`, action: 'ORDER_UPDATED', userId: currentUser?.id || 'unknown',
        entityType: 'ORDER', entityId: id, entityName: shipment.trackingNumber,
        details: 'Shipment removed', createdAt: new Date(),
      })
    }
    setShowDeleteShipment(null)
    if (showShipmentDetail === id) setShowShipmentDetail(null)
  }

  function handleAdvanceShipmentStatus(shipment: Shipment) {
    const next = NEXT_SHIPMENT_STATUS[shipment.status]
    if (!next) return
    const now = new Date()
    const updated: Shipment = {
      ...shipment, status: next,
      deliveredAt: next === 'DELIVERED' ? now : shipment.deliveredAt, updatedAt: now,
    }
    updateShipment(updated)
    const order = getOrder(shipment.orderId)
    if (order && next === 'DELIVERED') {
      updateOrder({ ...order, status: 'DELIVERED', deliveredAt: now, updatedAt: now })
    }
    addActivityLog({
      id: `al_${Date.now()}`, action: 'STATUS_CHANGED', userId: currentUser?.id || 'unknown',
      entityType: 'ORDER', entityId: shipment.id, entityName: shipment.trackingNumber,
      details: `${shipmentStatusConfig[shipment.status].label} → ${shipmentStatusConfig[next].label}`, createdAt: now,
    })
    setShowStatusAdvance(null)
  }

  function handleCreateProvider() {
    if (!providerForm.name || !providerForm.code) return
    const now = new Date()
    const provider: DeliveryProvider = {
      id: `dp_${Date.now()}`, name: providerForm.name, code: providerForm.code,
      trackingUrl: providerForm.trackingUrl || undefined, services: providerForm.services,
      pricePerKg: providerForm.pricePerKg || undefined, pricePerOrder: providerForm.pricePerOrder || undefined,
      isActive: providerForm.isActive, notes: providerForm.notes || undefined,
    }
    addDeliveryProvider(provider)
    addActivityLog({
      id: `al_${Date.now()}`, action: 'ORDER_CREATED', userId: currentUser?.id || 'unknown',
      entityType: 'ORDER', entityId: provider.id, entityName: provider.name,
      details: `Delivery provider "${provider.name}" created`, createdAt: now,
    })
    setShowCreateProvider(false)
    resetProviderForm()
  }

  function handleEditProvider() {
    if (!editingProvider) return
    const now = new Date()
    const updated: DeliveryProvider = {
      ...editingProvider, name: providerForm.name, code: providerForm.code,
      trackingUrl: providerForm.trackingUrl || undefined, services: providerForm.services,
      pricePerKg: providerForm.pricePerKg || undefined, pricePerOrder: providerForm.pricePerOrder || undefined,
      isActive: providerForm.isActive, notes: providerForm.notes || undefined,
    }
    updateDeliveryProvider(updated)
    addActivityLog({
      id: `al_${Date.now()}`, action: 'ORDER_UPDATED', userId: currentUser?.id || 'unknown',
      entityType: 'ORDER', entityId: updated.id, entityName: updated.name,
      details: `Delivery provider "${updated.name}" updated`, createdAt: now,
    })
    setShowEditProvider(false)
    setEditingProvider(null)
    resetProviderForm()
  }

  function handleDeleteProvider(id: string) {
    const provider = deliveryProviders.find(p => p.id === id)
    deleteDeliveryProvider(id)
    if (provider) {
      addActivityLog({
        id: `al_${Date.now()}`, action: 'ORDER_UPDATED', userId: currentUser?.id || 'unknown',
        entityType: 'ORDER', entityId: id, entityName: provider.name,
        details: `Delivery provider "${provider.name}" deleted`, createdAt: new Date(),
      })
    }
    setShowDeleteProvider(null)
  }

  function toggleShipmentSort(field: ShipmentSortField) {
    if (shipmentSortField === field) setShipmentSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setShipmentSortField(field); setShipmentSortDir('desc') }
    setShipmentPage(1)
  }

  // ─── Render ─────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Delivery Center</h1>
          <p className="text-sm text-text-muted mt-1">E-com deliveries, shipments, and provider management.</p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'ecom' && (
            <>
              <button onClick={handleSync} disabled={ecomSyncLoading} className="btn-secondary text-xs">
                <RefreshCw className={cn('w-4 h-4', ecomSyncLoading && 'animate-spin')} />
                Sync Now
              </button>
              <button onClick={() => setShowWebhookPanel(!showWebhookPanel)} className="btn-secondary text-xs">
                <LinkIcon className="w-4 h-4" />
                Webhook
              </button>
              <button onClick={() => setShowCreateEcomColis(true)} className="btn-primary">
                <Plus className="w-4 h-4" />
                Create E-com Colis
              </button>
            </>
          )}
          {activeTab === 'shipments' && (
            <button onClick={() => { resetShipmentForm(); setShowCreateShipment(true) }} className="btn-primary">
              <Plus className="w-4 h-4" />
              New Shipment
            </button>
          )}
          {activeTab === 'providers' && (
            <button onClick={() => { resetProviderForm(); setShowCreateProvider(true) }} className="btn-primary">
              <Plus className="w-4 h-4" />
              Add Provider
            </button>
          )}
        </div>
      </div>

      {/* Sync Status Banner */}
      {activeTab === 'ecom' && (
        <div className="flex items-center gap-4 flex-wrap">
          <div className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium',
            syncStatus === 'success' ? 'bg-success/10 text-success' :
            syncStatus === 'error' ? 'bg-danger/10 text-danger' :
            syncStatus === 'syncing' ? 'bg-info/10 text-info' :
            'bg-white/[0.03] text-text-muted'
          )}>
            <div className={cn(
              'w-2 h-2 rounded-full',
              syncStatus === 'success' ? 'bg-success' :
              syncStatus === 'error' ? 'bg-danger' :
              syncStatus === 'syncing' ? 'bg-info animate-pulse' :
              'bg-text-muted'
            )} />
            {syncStatus === 'syncing' ? 'Synchronisation en cours...' :
             syncStatus === 'success' ? `E-com synchronisé — ${syncResult}` :
             syncStatus === 'error' ? 'Erreur de synchronisation' :
             lastSyncAt ? `E-com synchronisé — il y a ${formatTimeAgo(lastSyncAt)}` :
             'E-com non synchronisé'}
          </div>
          <button onClick={handleTestConnection} disabled={connectionStatus === 'testing'} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.03] text-text-muted border border-border hover:text-text-secondary transition-all">
            {connectionStatus === 'testing' ? <WifiOff className="w-3 h-3 animate-pulse" /> :
             connectionStatus === 'ok' ? <Wifi className="w-3 h-3 text-success" /> :
             connectionStatus === 'error' ? <WifiOff className="w-3 h-3 text-danger" /> :
             <Wifi className="w-3 h-3" />}
            {connectionStatus === 'ok' ? 'Connecté' : connectionStatus === 'error' ? 'Erreur' : 'Tester Connexion'}
          </button>
        </div>
      )}

      {/* ─── KPIs ────────────────────────────────────────── */}
      {activeTab === 'ecom' && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {[
            { label: 'Total', value: ecomKPIs.total, icon: Package, color: 'text-info', bg: 'bg-info/10' },
            { label: 'En Préparation', value: ecomKPIs.preparing, icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
            { label: 'En Livraison', value: ecomKPIs.inDelivery, icon: Truck, color: 'text-orange', bg: 'bg-orange/10' },
            { label: 'Livrées', value: ecomKPIs.delivered, icon: CheckCircle, color: 'text-success', bg: 'bg-success/10' },
            { label: 'Retours', value: ecomKPIs.returned, icon: RotateCcw, color: 'text-danger', bg: 'bg-danger/10' },
            { label: 'Annulés', value: ecomKPIs.cancelled, icon: PackageX, color: 'text-danger', bg: 'bg-danger/10' },
            { label: 'Encaissés', value: ecomKPIs.encaisses, icon: CircleDollarSign, color: 'text-gold', bg: 'bg-gold/10' },
            { label: 'Recouverts', value: ecomKPIs.recouverts, icon: Wallet, color: 'text-success', bg: 'bg-success/10' },
          ].map(kpi => (
            <div key={kpi.label} className="kpi-card">
              <div className="flex items-center justify-between mb-3">
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', kpi.bg)}>
                  <kpi.icon className={cn('w-5 h-5', kpi.color)} />
                </div>
              </div>
              <p className="text-2xl font-bold">{kpi.value}</p>
              <p className="text-xs text-text-muted mt-1">{kpi.label}</p>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'shipments' && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Total Shipments', value: shipmentKPIs.total, icon: Package, color: 'text-info', bg: 'bg-info/10' },
            { label: 'In Transit', value: shipmentKPIs.inTransit, icon: Truck, color: 'text-orange', bg: 'bg-orange/10' },
            { label: 'Delivered', value: shipmentKPIs.delivered, icon: CheckCircle, color: 'text-success', bg: 'bg-success/10' },
            { label: 'Returned', value: shipmentKPIs.returned, icon: RotateCcw, color: 'text-danger', bg: 'bg-danger/10' },
            { label: 'Delayed', value: shipmentKPIs.delayed, icon: Clock, color: 'text-warning', bg: 'bg-warning/10' },
          ].map(kpi => (
            <div key={kpi.label} className="kpi-card">
              <div className="flex items-center justify-between mb-3">
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', kpi.bg)}>
                  <kpi.icon className={cn('w-5 h-5', kpi.color)} />
                </div>
              </div>
              <p className="text-2xl font-bold">{kpi.value}</p>
              <p className="text-xs text-text-muted mt-1">{kpi.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-border">
        {([
          { key: 'ecom' as EcomTab, label: 'E-com Deliveries', icon: Zap, count: ecomDeliveries.length },
          { key: 'shipments' as EcomTab, label: 'Shipments', icon: Truck, count: shipments.length },
          { key: 'providers' as EcomTab, label: 'Providers', icon: Building2, count: deliveryProviders.length },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px',
              activeTab === tab.key ? 'text-gold border-gold' : 'text-text-muted border-transparent hover:text-text-secondary'
            )}
          >
            <tab.icon className="w-4 h-4 inline mr-2" />
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/* E-COM DELIVERIES TAB                               */}
      {/* ═══════════════════════════════════════════════════ */}
      {activeTab === 'ecom' && (
        <div className="space-y-6">
          {/* Search & Filters */}
          <div className="glass-card p-4">
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-3">
              <div className="header-search flex items-center gap-3 px-4 py-2.5 flex-1 min-w-0">
                <Search className="w-4 h-4 text-text-muted shrink-0" />
                <input
                  type="text"
                  placeholder="Search tracking, order #, customer, phone..."
                  value={ecomSearch}
                  onChange={e => { setEcomSearch(e.target.value); setEcomPage(1) }}
                  className="bg-transparent border-none outline-none text-sm text-text-primary placeholder:text-text-muted w-full"
                />
                {ecomSearch && (
                  <button onClick={() => setEcomSearch('')} className="text-text-muted hover:text-text-primary">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={ecomModeFilter}
                  onChange={e => { setEcomModeFilter(e.target.value as typeof ecomModeFilter); setEcomPage(1) }}
                  className="select-field text-xs"
                >
                  <option value="ALL">All Modes</option>
                  <option value="HOME">Home Delivery</option>
                  <option value="STOP_DESK">Stop Desk</option>
                </select>
                <input type="date" value={ecomDateFrom} onChange={e => { setEcomDateFrom(e.target.value); setEcomPage(1) }} className="select-field text-xs" placeholder="From" />
                <input type="date" value={ecomDateTo} onChange={e => { setEcomDateTo(e.target.value); setEcomPage(1) }} className="select-field text-xs" placeholder="To" />
              </div>
            </div>
          </div>

          {/* Status Filter Chips */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => { setEcomStatusFilter('ALL'); setEcomPage(1) }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                ecomStatusFilter === 'ALL' ? 'bg-gold/15 text-gold border border-gold/20' : 'bg-white/[0.03] text-text-muted border border-border hover:text-text-secondary'
              )}
            >
              All ({ecomStatusCounts.ALL || 0})
            </button>
            {(Object.keys(ECOM_STATUS_CONFIG) as EcomDeliveryStatus[]).map(status => {
              const count = ecomStatusCounts[status] || 0
              if (count === 0 && ecomStatusFilter !== status) return null
              const cfg = ECOM_STATUS_CONFIG[status]
              return (
                <button
                  key={status}
                  onClick={() => { setEcomStatusFilter(status); setEcomPage(1) }}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                    ecomStatusFilter === status ? 'bg-gold/15 text-gold border border-gold/20' : 'bg-white/[0.03] text-text-muted border border-border hover:text-text-secondary'
                  )}
                >
                  {cfg.label} ({count})
                </button>
              )
            })}
          </div>

          {/* E-com Deliveries Table */}
          {filteredEcomDeliveries.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><Zap className="w-6 h-6" /></div>
              <p className="text-sm text-text-muted">
                {ecomDeliveries.length === 0 ? 'No E-com deliveries yet. Create your first E-com colis to get started.' : 'No deliveries match your filters.'}
              </p>
              {ecomDeliveries.length === 0 && (
                <button onClick={() => setShowCreateEcomColis(true)} className="btn-primary mt-4">
                  <Plus className="w-4 h-4" /> Create E-com Colis
                </button>
              )}
            </div>
          ) : (
            <div className="glass-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Order #</th>
                      <th>Client</th>
                      <th>Produit</th>
                      <th>Wilaya</th>
                      <th>Tracking</th>
                      <th>Situation</th>
                      <th>État Logistique</th>
                      <th>Total</th>
                      <th>Dernière Action</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedEcomDeliveries.map(delivery => {
                      const statusCfg = ECOM_STATUS_CONFIG[delivery.status]
                      return (
                        <tr key={delivery.id} className="group cursor-pointer" onClick={() => setShowEcomDetail(delivery.id)}>
                          <td>
                            <span className="text-sm font-medium">{delivery.foxboxOrderNumber || '-'}</span>
                          </td>
                          <td>
                            <div>
                              <p className="text-sm font-medium">{delivery.customerName}</p>
                              <p className="text-[10px] text-text-muted">{delivery.customerPhone}</p>
                            </div>
                          </td>
                          <td><span className="text-xs">{delivery.product}</span></td>
                          <td>
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-text-muted" />
                              <span className="text-xs">{delivery.wilayaName || delivery.wilayaCode}</span>
                            </div>
                          </td>
                          <td>
                            <span className="font-mono text-xs text-gold">{delivery.ecomTracking}</span>
                          </td>
                          <td><span className="text-xs text-text-muted">{delivery.ecomSituation}</span></td>
                          <td><span className={cn('badge text-[9px]', statusCfg.bgColor, statusCfg.color)}>{statusCfg.label}</span></td>
                          <td><span className="text-sm font-medium">{formatDzd(delivery.total)}</span></td>
                          <td><span className="text-xs text-text-muted">{delivery.ecomLastActionAt ? formatDateTime(delivery.ecomLastActionAt) : '-'}</span></td>
                          <td>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                              <button onClick={() => setShowEcomDetail(delivery.id)} className="p-1.5 rounded-lg hover:bg-white/[0.05] text-text-muted hover:text-info transition-all" title="View Details">
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleCopyTracking(delivery.ecomTracking)} className="p-1.5 rounded-lg hover:bg-white/[0.05] text-text-muted hover:text-gold transition-all" title="Copy Tracking">
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => setShowDeleteEcom(delivery.id)} className="p-1.5 rounded-lg hover:bg-white/[0.05] text-text-muted hover:text-danger transition-all" title="Delete">
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
              {ecomTotalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-border">
                  <p className="text-xs text-text-muted">
                    Showing {((ecomPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(ecomPage * ITEMS_PER_PAGE, filteredEcomDeliveries.length)} of {filteredEcomDeliveries.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setEcomPage(p => Math.max(1, p - 1))} disabled={ecomPage === 1} className="p-1.5 rounded-lg hover:bg-white/[0.05] text-text-muted disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {Array.from({ length: ecomTotalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => setEcomPage(page)}
                        className={cn('w-7 h-7 rounded-lg text-xs font-medium transition-all', ecomPage === page ? 'bg-gold/15 text-gold border border-gold/20' : 'text-text-muted hover:bg-white/[0.05]')}
                      >
                        {page}
                      </button>
                    ))}
                    <button onClick={() => setEcomPage(p => Math.min(ecomTotalPages, p + 1))} disabled={ecomPage === ecomTotalPages} className="p-1.5 rounded-lg hover:bg-white/[0.05] text-text-muted disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* SHIPMENTS TAB                                      */}
      {/* ═══════════════════════════════════════════════════ */}
      {activeTab === 'shipments' && (
        <div className="space-y-6">
          <div className="glass-card p-4">
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-3">
              <div className="header-search flex items-center gap-3 px-4 py-2.5 flex-1 min-w-0">
                <Search className="w-4 h-4 text-text-muted shrink-0" />
                <input
                  type="text" placeholder="Search tracking #, order #, provider..."
                  value={shipmentSearch} onChange={e => { setShipmentSearch(e.target.value); setShipmentPage(1) }}
                  className="bg-transparent border-none outline-none text-sm text-text-primary placeholder:text-text-muted w-full"
                />
                {shipmentSearch && (
                  <button onClick={() => setShipmentSearch('')} className="text-text-muted hover:text-text-primary">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <select value={filterProvider} onChange={e => { setFilterProvider(e.target.value); setShipmentPage(1) }} className="select-field text-xs">
                  <option value="ALL">All Providers</option>
                  {deliveryProviders.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
                </select>
                <input type="date" value={filterDateFrom} onChange={e => { setFilterDateFrom(e.target.value); setShipmentPage(1) }} className="select-field text-xs" placeholder="From" />
                <input type="date" value={filterDateTo} onChange={e => { setFilterDateTo(e.target.value); setShipmentPage(1) }} className="select-field text-xs" placeholder="To" />
              </div>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button onClick={() => { setFilterStatus('ALL'); setShipmentPage(1) }} className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all', filterStatus === 'ALL' ? 'bg-gold/15 text-gold border border-gold/20' : 'bg-white/[0.03] text-text-muted border border-border hover:text-text-secondary')}>
              All ({shipmentStatusCounts.ALL || 0})
            </button>
            {SHIPMENT_STATUSES.map(status => {
              const count = shipmentStatusCounts[status] || 0
              if (count === 0 && filterStatus !== status) return null
              const cfg = shipmentStatusConfig[status]
              return (
                <button key={status} onClick={() => { setFilterStatus(status); setShipmentPage(1) }} className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all', filterStatus === status ? 'bg-gold/15 text-gold border border-gold/20' : 'bg-white/[0.03] text-text-muted border border-border hover:text-text-secondary')}>
                  {cfg.label} ({count})
                </button>
              )
            })}
          </div>

          {filteredShipments.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><Truck className="w-6 h-6" /></div>
              <p className="text-sm text-text-muted">{shipments.length === 0 ? 'No shipments yet.' : 'No shipments match your filters.'}</p>
            </div>
          ) : (
            <div className="glass-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th><button onClick={() => toggleShipmentSort('trackingNumber')} className="flex items-center gap-1 hover:text-gold transition-colors">Tracking <ArrowUpDown className="w-3 h-3" /></button></th>
                      <th>Order</th>
                      <th>Provider</th>
                      <th>Service</th>
                      <th><button onClick={() => toggleShipmentSort('status')} className="flex items-center gap-1 hover:text-gold transition-colors">Status <ArrowUpDown className="w-3 h-3" /></button></th>
                      <th>Shipped</th>
                      <th>Est. Delivery</th>
                      <th><button onClick={() => toggleShipmentSort('cost')} className="flex items-center gap-1 hover:text-gold transition-colors">Cost <ArrowUpDown className="w-3 h-3" /></button></th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedShipments.map(shipment => {
                      const order = getOrder(shipment.orderId)
                      const provider = getProvider(shipment.providerId)
                      const statusCfg = shipmentStatusConfig[shipment.status]
                      const next = NEXT_SHIPMENT_STATUS[shipment.status]
                      const delayed = isDelayed(shipment)
                      return (
                        <tr key={shipment.id} className="group">
                          <td>
                            <span className="font-mono text-sm text-gold">{shipment.trackingNumber}</span>
                            {delayed && <span className="ml-2 text-[9px] text-warning font-medium bg-warning/10 px-1.5 py-0.5 rounded">DELAYED</span>}
                          </td>
                          <td><div><p className="text-sm font-medium">{order?.orderNumber || 'Unknown'}</p><p className="text-[10px] text-text-muted">{order?.customer?.name || ''}</p></div></td>
                          <td><div className="flex items-center gap-2"><div className="w-6 h-6 rounded bg-gold/10 flex items-center justify-center"><Truck className="w-3 h-3 text-gold" /></div><span className="text-xs">{provider?.name || 'Unknown'}</span></div></td>
                          <td><span className="text-xs text-text-muted">{serviceTypeLabels[shipment.serviceType]}</span></td>
                          <td><span className={cn('badge text-[9px]', statusCfg.bgColor, statusCfg.color)}>{statusCfg.label}</span></td>
                          <td><span className="text-xs text-text-muted">{formatDate(shipment.shippedAt)}</span></td>
                          <td><span className={cn('text-xs', delayed ? 'text-warning font-medium' : 'text-text-muted')}>{formatDate(shipment.estimatedDelivery)}</span></td>
                          <td><span className="text-sm font-medium">{formatDzd(shipment.cost)}</span></td>
                          <td>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => setShowShipmentDetail(shipment.id)} className="p-1.5 rounded-lg hover:bg-white/[0.05] text-text-muted hover:text-info transition-all" title="View Details"><Eye className="w-3.5 h-3.5" /></button>
                              <button onClick={() => { setEditingShipment(shipment); setShipmentForm({ orderId: shipment.orderId, providerId: shipment.providerId, trackingNumber: shipment.trackingNumber, serviceType: shipment.serviceType, cost: shipment.cost, weightKg: shipment.weightKg || 0, estimatedDelivery: shipment.estimatedDelivery ? new Date(shipment.estimatedDelivery).toISOString().split('T')[0] : '', notes: shipment.notes || '' }); setShowEditShipment(true) }} className="p-1.5 rounded-lg hover:bg-white/[0.05] text-text-muted hover:text-gold transition-all" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                              {next && <button onClick={() => setShowStatusAdvance(shipment.id)} className="px-2 py-1 rounded-md text-[10px] font-medium bg-gold/10 text-gold border border-gold/20 hover:bg-gold/20 transition-all" title={`Advance to ${shipmentStatusConfig[next].label}`}>{shipmentStatusConfig[next].label}</button>}
                              <button onClick={() => setShowDeleteShipment(shipment.id)} className="p-1.5 rounded-lg hover:bg-white/[0.05] text-text-muted hover:text-danger transition-all" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {shipmentTotalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-border">
                  <p className="text-xs text-text-muted">Showing {((shipmentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(shipmentPage * ITEMS_PER_PAGE, filteredShipments.length)} of {filteredShipments.length}</p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setShipmentPage(p => Math.max(1, p - 1))} disabled={shipmentPage === 1} className="p-1.5 rounded-lg hover:bg-white/[0.05] text-text-muted disabled:opacity-30 disabled:cursor-not-allowed transition-all"><ChevronLeft className="w-4 h-4" /></button>
                    {Array.from({ length: shipmentTotalPages }, (_, i) => i + 1).map(page => (
                      <button key={page} onClick={() => setShipmentPage(page)} className={cn('w-7 h-7 rounded-lg text-xs font-medium transition-all', shipmentPage === page ? 'bg-gold/15 text-gold border border-gold/20' : 'text-text-muted hover:bg-white/[0.05]')}>{page}</button>
                    ))}
                    <button onClick={() => setShipmentPage(p => Math.min(shipmentTotalPages, p + 1))} disabled={shipmentPage === shipmentTotalPages} className="p-1.5 rounded-lg hover:bg-white/[0.05] text-text-muted disabled:opacity-30 disabled:cursor-not-allowed transition-all"><ChevronRight className="w-4 h-4" /></button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* PROVIDERS TAB                                      */}
      {/* ═══════════════════════════════════════════════════ */}
      {activeTab === 'providers' && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="header-search flex items-center gap-3 px-4 py-2.5 flex-1 min-w-0">
              <Search className="w-4 h-4 text-text-muted shrink-0" />
              <input type="text" placeholder="Search providers..." value={providerSearch} onChange={e => setProviderSearch(e.target.value)} className="bg-transparent border-none outline-none text-sm text-text-primary placeholder:text-text-muted w-full" />
              {providerSearch && <button onClick={() => setProviderSearch('')} className="text-text-muted hover:text-text-primary"><X className="w-3 h-3" /></button>}
            </div>
            <button onClick={() => { resetProviderForm(); setShowCreateProvider(true) }} className="btn-primary"><Plus className="w-4 h-4" /> Add Provider</button>
          </div>

          {filteredProviders.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><Truck className="w-6 h-6" /></div>
              <p className="text-sm text-text-muted">{deliveryProviders.length === 0 ? 'No delivery providers yet.' : 'No providers match your search.'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredProviders.map(provider => {
                const isActive = provider.isActive
                const isExpanded = expandedProvider === provider.id
                const providerShipments = shipments.filter(s => s.providerId === provider.id)
                const deliveredCount = providerShipments.filter(s => s.status === 'DELIVERED').length
                return (
                  <div key={provider.id} className="glass-card overflow-hidden">
                    <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/[0.02] transition-colors" onClick={() => setExpandedProvider(isExpanded ? null : provider.id)}>
                      <div className="flex items-center gap-4">
                        <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', isActive ? 'bg-gold/10' : 'bg-white/[0.03]')}>
                          <Truck className={cn('w-6 h-6', isActive ? 'text-gold' : 'text-text-muted')} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold">{provider.name}</p>
                            <span className={cn('text-[9px] px-2 py-0.5 rounded-full font-medium', isActive ? 'bg-success/12 text-success' : 'bg-white/[0.05] text-text-muted')}>{isActive ? 'Active' : 'Inactive'}</span>
                          </div>
                          <p className="text-xs text-text-muted mt-0.5">Code: <span className="font-mono text-text-secondary">{provider.code}</span></p>
                          <div className="flex items-center gap-2 mt-1">{provider.services.map(s => (<span key={s} className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.05] text-text-muted">{serviceTypeLabels[s]}</span>))}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                          <p className="text-xs text-text-muted">{providerShipments.length} shipments</p>
                          <p className="text-[10px] text-success">{deliveredCount} delivered</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={e => { e.stopPropagation(); setEditingProvider(provider); setProviderForm({ name: provider.name, code: provider.code, trackingUrl: provider.trackingUrl || '', services: provider.services, pricePerKg: provider.pricePerKg || 0, pricePerOrder: provider.pricePerOrder || 0, isActive: provider.isActive, notes: provider.notes || '' }); setShowEditProvider(true) }} className="p-1.5 rounded-lg hover:bg-white/[0.05] text-text-muted hover:text-gold transition-all" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={e => { e.stopPropagation(); setShowDeleteProvider(provider.id) }} className="p-1.5 rounded-lg hover:bg-white/[0.05] text-text-muted hover:text-danger transition-all" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                          <ChevronDown className={cn('w-4 h-4 text-text-muted transition-transform', isExpanded && 'rotate-180')} />
                        </div>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="border-t border-border px-4 py-4 space-y-3">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <div><p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Price / Kg</p><p className="text-sm font-medium">{provider.pricePerKg ? formatDzd(provider.pricePerKg) : '-'}</p></div>
                          <div><p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Price / Order</p><p className="text-sm font-medium">{provider.pricePerOrder ? formatDzd(provider.pricePerOrder) : '-'}</p></div>
                          <div><p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Total Shipments</p><p className="text-sm font-medium">{providerShipments.length}</p></div>
                          <div><p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Delivery Rate</p><p className="text-sm font-medium text-success">{providerShipments.length > 0 ? ((deliveredCount / providerShipments.length) * 100).toFixed(0) : 0}%</p></div>
                        </div>
                        {provider.trackingUrl && <div className="flex items-center gap-2 text-xs text-text-muted"><ExternalLink className="w-3 h-3" /><span>Tracking URL:</span><a href={provider.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">{provider.trackingUrl}</a></div>}
                        {provider.notes && <div className="flex items-start gap-2 text-xs text-text-muted"><StickyNote className="w-3 h-3 mt-0.5" /><span>{provider.notes}</span></div>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* WEBHOOK PANEL                                      */}
      {/* ═══════════════════════════════════════════════════ */}
      {showWebhookPanel && activeTab === 'ecom' && (
        <div className="glass-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2"><LinkIcon className="w-4 h-4 text-gold" /> Webhook Events</h3>
            <div className="flex items-center gap-2">
              <button onClick={loadWebhookEvents} className="text-xs text-text-muted hover:text-text-secondary"><RefreshCw className="w-3.5 h-3.5" /></button>
              <button onClick={() => setShowWebhookPanel(false)} className="text-text-muted hover:text-text-primary"><X className="w-4 h-4" /></button>
            </div>
          </div>
          {webhookEvents.length === 0 ? (
            <p className="text-xs text-text-muted text-center py-4">No webhook events recorded yet.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {webhookEvents.map(event => (
                <div key={event.id} className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] border border-border">
                  <div className="flex items-center gap-3">
                    <div className={cn('w-2 h-2 rounded-full', event.result === 'success' ? 'bg-success' : 'bg-danger')} />
                    <div>
                      <p className="text-xs font-mono text-gold">{event.tracking}</p>
                      <p className="text-[10px] text-text-muted">{event.situation}</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-text-muted">{formatDateTime(event.receivedAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* CREATE E-COM COLIS MODAL                           */}
      {/* ═══════════════════════════════════════════════════ */}
      {showCreateEcomColis && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateEcomColis(false)} />
          <div className="relative bg-bg-surface border border-border rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-bg-surface border-b border-border px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center"><Zap className="w-4 h-4 text-gold" /></div>
                <div>
                  <h2 className="text-lg font-semibold">Create E-com Colis</h2>
                  <p className="text-xs text-text-muted">Ship an order via E-com Delivery API</p>
                </div>
              </div>
              <button onClick={() => setShowCreateEcomColis(false)} className="p-2 rounded-lg hover:bg-white/[0.05] text-text-muted"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs text-text-muted mb-1 block">Order *</label>
                <select value={selectedEcomOrderId} onChange={e => setSelectedEcomOrderId(e.target.value)} className="select-field w-full">
                  <option value="">Select order</option>
                  {unshippedOrders.map(o => (
                    <option key={o.id} value={o.id}>{o.orderNumber} - {o.customer.name} ({o.customer.wilaya})</option>
                  ))}
                </select>
                {unshippedOrders.length === 0 && <p className="text-[10px] text-text-muted mt-1">All orders have been shipped or have E-com colis.</p>}
              </div>

              {selectedEcomOrderId && (() => {
                const order = orders.find(o => o.id === selectedEcomOrderId)
                if (!order) return null
                const product = order.productId ? getProduct(order.productId) : null
                return (
                  <div className="glass-card p-4 space-y-2">
                    <h4 className="text-xs font-semibold text-gold uppercase tracking-wider mb-2">Order Preview</h4>
                    <div className="flex items-center justify-between text-sm"><span className="text-text-muted">Customer</span><span>{order.customer.name}</span></div>
                    <div className="flex items-center justify-between text-sm"><span className="text-text-muted">Phone</span><span>{order.customer.phone}</span></div>
                    <div className="flex items-center justify-between text-sm"><span className="text-text-muted">Wilaya</span><span>{order.customer.wilaya}</span></div>
                    <div className="flex items-center justify-between text-sm"><span className="text-text-muted">Commune</span><span>{order.customer.commune}</span></div>
                    <div className="flex items-center justify-between text-sm"><span className="text-text-muted">Address</span><span className="text-right text-xs">{order.customer.address}</span></div>
                    <div className="flex items-center justify-between text-sm"><span className="text-text-muted">Product</span><span>{product?.name || 'N/A'}</span></div>
                    <div className="flex items-center justify-between text-sm"><span className="text-text-muted">Quantity</span><span>{order.quantity}</span></div>
                    <div className="flex items-center justify-between text-sm"><span className="text-text-muted">Total</span><span className="font-medium text-gold">{formatDzd(order.sellingPriceDzd + order.deliveryFeeDzd)}</span></div>
                  </div>
                )
              })()}

              <div>
                <label className="text-xs text-text-muted mb-2 block">Delivery Mode *</label>
                <div className="flex gap-2">
                  {(['HOME', 'STOP_DESK'] as const).map(mode => (
                    <button key={mode} onClick={() => setEcomDeliveryMode(mode)} className={cn('px-4 py-2 rounded-lg text-xs font-medium transition-all border flex-1', ecomDeliveryMode === mode ? 'bg-gold/15 text-gold border-gold/20' : 'bg-white/[0.03] text-text-muted border-border hover:text-text-secondary')}>
                      {mode === 'HOME' ? '🏠 Home Delivery' : '🏢 Stop Desk'}
                    </button>
                  ))}
                </div>
              </div>

              {ecomCreateError && (
                <div className="p-3 rounded-lg bg-danger/10 border border-danger/20">
                  <p className="text-xs text-danger">{ecomCreateError}</p>
                </div>
              )}
            </div>
            <div className="sticky bottom-0 bg-bg-surface border-t border-border px-6 py-4 flex items-center justify-end gap-3">
              <button onClick={() => setShowCreateEcomColis(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleCreateEcomColis} disabled={!selectedEcomOrderId || ecomCreateLoading} className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed">
                {ecomCreateLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {ecomCreateLoading ? 'Creating...' : 'Create E-com Colis'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* E-COM DELIVERY DETAIL DRAWER                       */}
      {/* ═══════════════════════════════════════════════════ */}
      {selectedEcomDelivery && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowEcomDetail(null)} />
          <div className="relative bg-bg-surface border-l border-border w-full max-w-xl overflow-y-auto shadow-2xl animate-in slide-in-from-right">
            {/* Header */}
            <div className="sticky top-0 bg-bg-surface border-b border-border px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center"><Zap className="w-4 h-4 text-gold" /></div>
                <div>
                  <h2 className="text-lg font-semibold font-mono">{selectedEcomDelivery.ecomTracking}</h2>
                  <p className="text-xs text-text-muted">{selectedEcomDelivery.foxboxOrderNumber || 'No order linked'}</p>
                </div>
              </div>
              <button onClick={() => setShowEcomDetail(null)} className="p-2 rounded-lg hover:bg-white/[0.05] text-text-muted"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 space-y-6">
              {/* Status Row */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className={cn('badge text-xs', ECOM_STATUS_CONFIG[selectedEcomDelivery.status].bgColor, ECOM_STATUS_CONFIG[selectedEcomDelivery.status].color)}>
                  {ECOM_STATUS_CONFIG[selectedEcomDelivery.status].label}
                </span>
                <span className="badge text-xs bg-white/[0.05] text-text-muted">
                  {selectedEcomDelivery.deliveryMode === 'HOME' ? '🏠 Home' : '🏢 Stop Desk'}
                </span>
              </div>

              {/* Customer Info */}
              <div className="glass-card p-4">
                <h4 className="text-xs font-semibold text-gold uppercase tracking-wider mb-3 flex items-center gap-2"><Package className="w-3 h-3" /> Customer Info</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm"><span className="text-text-muted">Name</span><span>{selectedEcomDelivery.customerName}</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-text-muted">Phone</span><span>{selectedEcomDelivery.customerPhone}</span></div>
                  {selectedEcomDelivery.customerPhoneAlt && <div className="flex items-center justify-between text-sm"><span className="text-text-muted">Phone Alt</span><span>{selectedEcomDelivery.customerPhoneAlt}</span></div>}
                  <div className="flex items-center justify-between text-sm"><span className="text-text-muted">Wilaya</span><span>{selectedEcomDelivery.wilayaName || selectedEcomDelivery.wilayaCode}</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-text-muted">Commune</span><span>{selectedEcomDelivery.commune}</span></div>
                  {selectedEcomDelivery.address && <div className="flex items-center justify-between text-sm"><span className="text-text-muted">Address</span><span className="text-right text-xs max-w-[60%]">{selectedEcomDelivery.address}</span></div>}
                </div>
              </div>

              {/* Product Info */}
              <div className="glass-card p-4">
                <h4 className="text-xs font-semibold text-gold uppercase tracking-wider mb-3 flex items-center gap-2"><PackageCheck className="w-3 h-3" /> Product</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm"><span className="text-text-muted">Product</span><span>{selectedEcomDelivery.product}</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-text-muted">Quantity</span><span>{selectedEcomDelivery.quantity}</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-text-muted">Total</span><span className="font-medium text-gold">{formatDzd(selectedEcomDelivery.total)}</span></div>
                </div>
              </div>

              {/* E-com Status Info */}
              <div className="glass-card p-4">
                <h4 className="text-xs font-semibold text-gold uppercase tracking-wider mb-3 flex items-center gap-2"><Truck className="w-3 h-3" /> E-com Status</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm"><span className="text-text-muted">Situation</span><span>{selectedEcomDelivery.ecomSituation}</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-text-muted">État Logistique</span><span>{selectedEcomDelivery.ecomEtatLogistique}</span></div>
                  {selectedEcomDelivery.ecomIdColis && <div className="flex items-center justify-between text-sm"><span className="text-text-muted">ID Colis</span><span className="font-mono text-xs">{selectedEcomDelivery.ecomIdColis}</span></div>}
                  {selectedEcomDelivery.ecomIdExterne && <div className="flex items-center justify-between text-sm"><span className="text-text-muted">ID Externe</span><span className="font-mono text-xs">{selectedEcomDelivery.ecomIdExterne}</span></div>}
                </div>
              </div>

              {/* Financials */}
              <div className="glass-card p-4">
                <h4 className="text-xs font-semibold text-gold uppercase tracking-wider mb-3 flex items-center gap-2"><DollarSign className="w-3 h-3" /> Financials</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm"><span className="text-text-muted">Tarif Livraison</span><span>{selectedEcomDelivery.ecomTarifLivraison ? formatDzd(selectedEcomDelivery.ecomTarifLivraison) : '-'}</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-text-muted">Tarif Annulation</span><span>{selectedEcomDelivery.ecomTarifAnnulation ? formatDzd(selectedEcomDelivery.ecomTarifAnnulation) : '-'}</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-text-muted">Encaisser</span><span>{selectedEcomDelivery.ecomEncaisser ? formatDzd(selectedEcomDelivery.ecomEncaisser) : '-'}</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-text-muted">Recouvert</span><span>{selectedEcomDelivery.ecomRecouvert ? formatDzd(selectedEcomDelivery.ecomRecouvert) : '-'}</span></div>
                </div>
              </div>

              {/* Dates */}
              <div className="glass-card p-4">
                <h4 className="text-xs font-semibold text-gold uppercase tracking-wider mb-3 flex items-center gap-2"><Calendar className="w-3 h-3" /> Dates</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm"><span className="text-text-muted">Created</span><span>{formatDateTime(selectedEcomDelivery.createdAt)}</span></div>
                  {selectedEcomDelivery.ecomLastActionAt && <div className="flex items-center justify-between text-sm"><span className="text-text-muted">Last Action</span><span>{formatDateTime(selectedEcomDelivery.ecomLastActionAt)}</span></div>}
                  {selectedEcomDelivery.ecomLastSyncAt && <div className="flex items-center justify-between text-sm"><span className="text-text-muted">Last Sync</span><span>{formatDateTime(selectedEcomDelivery.ecomLastSyncAt)}</span></div>}
                </div>
              </div>

              {/* Delivery History Timeline */}
              <div className="glass-card p-4">
                <h4 className="text-xs font-semibold text-gold uppercase tracking-wider mb-3 flex items-center gap-2"><Clock className="w-3 h-3" /> History</h4>
                {ecomDeliveryHistory.length === 0 ? (
                  <p className="text-xs text-text-muted text-center py-3">No history events yet.</p>
                ) : (
                  <div className="space-y-0">
                    {[...ecomDeliveryHistory].sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()).map((entry, idx) => (
                      <div key={entry.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className={cn('w-2.5 h-2.5 rounded-full shrink-0 mt-1', entry.source === 'webhook' ? 'bg-success' : entry.source === 'sync' ? 'bg-info' : 'bg-gold')} />
                          {idx < ecomDeliveryHistory.length - 1 && <div className="w-px flex-1 bg-border my-1" />}
                        </div>
                        <div className="pb-4">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{entry.situation}</p>
                            {entry.etatLogistique && <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.05] text-text-muted">{entry.etatLogistique}</span>}
                          </div>
                          <p className="text-[11px] text-text-muted mt-0.5">{entry.commentaire}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-text-muted">{formatDateTime(entry.receivedAt)}</span>
                            <span className={cn('text-[9px] px-1.5 py-0.5 rounded', entry.source === 'webhook' ? 'bg-success/10 text-success' : entry.source === 'sync' ? 'bg-info/10 text-info' : 'bg-gold/10 text-gold')}>
                              {entry.source}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => handleCopyTracking(selectedEcomDelivery.ecomTracking)} className="btn-secondary text-xs">
                  <Copy className="w-3 h-3" />
                  {copySuccess ? 'Copied!' : 'Copy Tracking'}
                </button>
                <button onClick={() => handleViewBordereau(selectedEcomDelivery.ecomTracking)} className="btn-secondary text-xs">
                  <FileText className="w-3 h-3" />
                  Bordereau
                </button>
                <button onClick={() => handleSyncSingleStatus(selectedEcomDelivery)} className="btn-secondary text-xs">
                  <RefreshCw className="w-3 h-3" />
                  Sync Status
                </button>
                <button onClick={() => { setShowEcomDetail(null); setShowDeleteEcom(selectedEcomDelivery.id) }} className="btn-secondary text-xs text-danger hover:bg-danger/10">
                  <Trash2 className="w-3 h-3" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* CREATE SHIPMENT MODAL                              */}
      {/* ═══════════════════════════════════════════════════ */}
      {showCreateShipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateShipment(false)} />
          <div className="relative bg-bg-surface border border-border rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-bg-surface border-b border-border px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center"><Plus className="w-4 h-4 text-gold" /></div>
                <div><h2 className="text-lg font-semibold">Create Shipment</h2><p className="text-xs text-text-muted">Assign a shipment to an order</p></div>
              </div>
              <button onClick={() => setShowCreateShipment(false)} className="p-2 rounded-lg hover:bg-white/[0.05] text-text-muted"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs text-text-muted mb-1 block">Order *</label>
                <select value={shipmentForm.orderId} onChange={e => setShipmentForm(f => ({ ...f, orderId: e.target.value }))} className="select-field w-full">
                  <option value="">Select order</option>
                  {unshippedOrders.map(o => (<option key={o.id} value={o.id}>{o.orderNumber} - {o.customer.name}</option>))}
                </select>
              </div>
              <div>
                <label className="text-xs text-text-muted mb-1 block">Provider *</label>
                <select value={shipmentForm.providerId} onChange={e => setShipmentForm(f => ({ ...f, providerId: e.target.value }))} className="select-field w-full">
                  <option value="">Select provider</option>
                  {deliveryProviders.filter(p => p.isActive).map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
                </select>
              </div>
              <div>
                <label className="text-xs text-text-muted mb-1 block">Tracking Number *</label>
                <input type="text" value={shipmentForm.trackingNumber} onChange={e => setShipmentForm(f => ({ ...f, trackingNumber: e.target.value }))} className="input-field w-full" placeholder="e.g. TRK-001234" />
              </div>
              <div>
                <label className="text-xs text-text-muted mb-1 block">Service Type</label>
                <select value={shipmentForm.serviceType} onChange={e => setShipmentForm(f => ({ ...f, serviceType: e.target.value as DeliveryServiceType }))} className="select-field w-full">
                  <option value="HOME_DELIVERY">Home Delivery</option><option value="STOP_DESK">Stop Desk</option><option value="EXPRESS">Express</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-text-muted mb-1 block">Cost (DZD) *</label><input type="number" min={0} value={shipmentForm.cost} onChange={e => setShipmentForm(f => ({ ...f, cost: Math.max(0, parseFloat(e.target.value) || 0) }))} className="input-field w-full" /></div>
                <div><label className="text-xs text-text-muted mb-1 block">Weight (Kg)</label><input type="number" min={0} step={0.1} value={shipmentForm.weightKg} onChange={e => setShipmentForm(f => ({ ...f, weightKg: Math.max(0, parseFloat(e.target.value) || 0) }))} className="input-field w-full" /></div>
              </div>
              <div><label className="text-xs text-text-muted mb-1 block">Estimated Delivery</label><input type="date" value={shipmentForm.estimatedDelivery} onChange={e => setShipmentForm(f => ({ ...f, estimatedDelivery: e.target.value }))} className="input-field w-full" /></div>
              <div><label className="text-xs text-text-muted mb-1 block">Notes</label><textarea value={shipmentForm.notes} onChange={e => setShipmentForm(f => ({ ...f, notes: e.target.value }))} className="textarea-field w-full" rows={2} placeholder="Shipment notes..." /></div>
            </div>
            <div className="sticky bottom-0 bg-bg-surface border-t border-border px-6 py-4 flex items-center justify-end gap-3">
              <button onClick={() => setShowCreateShipment(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleCreateShipment} disabled={!shipmentForm.orderId || !shipmentForm.providerId || !shipmentForm.trackingNumber} className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"><Truck className="w-4 h-4" /> Create Shipment</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* EDIT SHIPMENT MODAL                                */}
      {/* ═══════════════════════════════════════════════════ */}
      {showEditShipment && editingShipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowEditShipment(false); setEditingShipment(null) }} />
          <div className="relative bg-bg-surface border border-border rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-bg-surface border-b border-border px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center"><Pencil className="w-4 h-4 text-gold" /></div>
                <div><h2 className="text-lg font-semibold">Edit Shipment</h2><p className="text-xs text-text-muted">{editingShipment.trackingNumber}</p></div>
              </div>
              <button onClick={() => { setShowEditShipment(false); setEditingShipment(null) }} className="p-2 rounded-lg hover:bg-white/[0.05] text-text-muted"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div><label className="text-xs text-text-muted mb-1 block">Provider *</label><select value={shipmentForm.providerId} onChange={e => setShipmentForm(f => ({ ...f, providerId: e.target.value }))} className="select-field w-full"><option value="">Select provider</option>{deliveryProviders.filter(p => p.isActive).map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}</select></div>
              <div><label className="text-xs text-text-muted mb-1 block">Tracking Number *</label><input type="text" value={shipmentForm.trackingNumber} onChange={e => setShipmentForm(f => ({ ...f, trackingNumber: e.target.value }))} className="input-field w-full" /></div>
              <div><label className="text-xs text-text-muted mb-1 block">Service Type</label><select value={shipmentForm.serviceType} onChange={e => setShipmentForm(f => ({ ...f, serviceType: e.target.value as DeliveryServiceType }))} className="select-field w-full"><option value="HOME_DELIVERY">Home Delivery</option><option value="STOP_DESK">Stop Desk</option><option value="EXPRESS">Express</option></select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-text-muted mb-1 block">Cost (DZD) *</label><input type="number" min={0} value={shipmentForm.cost} onChange={e => setShipmentForm(f => ({ ...f, cost: Math.max(0, parseFloat(e.target.value) || 0) }))} className="input-field w-full" /></div>
                <div><label className="text-xs text-text-muted mb-1 block">Weight (Kg)</label><input type="number" min={0} step={0.1} value={shipmentForm.weightKg} onChange={e => setShipmentForm(f => ({ ...f, weightKg: Math.max(0, parseFloat(e.target.value) || 0) }))} className="input-field w-full" /></div>
              </div>
              <div><label className="text-xs text-text-muted mb-1 block">Estimated Delivery</label><input type="date" value={shipmentForm.estimatedDelivery} onChange={e => setShipmentForm(f => ({ ...f, estimatedDelivery: e.target.value }))} className="input-field w-full" /></div>
              <div><label className="text-xs text-text-muted mb-1 block">Notes</label><textarea value={shipmentForm.notes} onChange={e => setShipmentForm(f => ({ ...f, notes: e.target.value }))} className="textarea-field w-full" rows={2} /></div>
            </div>
            <div className="sticky bottom-0 bg-bg-surface border-t border-border px-6 py-4 flex items-center justify-end gap-3">
              <button onClick={() => { setShowEditShipment(false); setEditingShipment(null) }} className="btn-secondary">Cancel</button>
              <button onClick={handleEditShipment} className="btn-primary"><CheckCircle className="w-4 h-4" /> Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* CREATE PROVIDER MODAL                              */}
      {/* ═══════════════════════════════════════════════════ */}
      {showCreateProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateProvider(false)} />
          <div className="relative bg-bg-surface border border-border rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-bg-surface border-b border-border px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center"><Plus className="w-4 h-4 text-gold" /></div><div><h2 className="text-lg font-semibold">Add Provider</h2><p className="text-xs text-text-muted">Register a new delivery provider</p></div></div>
              <button onClick={() => setShowCreateProvider(false)} className="p-2 rounded-lg hover:bg-white/[0.05] text-text-muted"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-text-muted mb-1 block">Name *</label><input type="text" value={providerForm.name} onChange={e => setProviderForm(f => ({ ...f, name: e.target.value }))} className="input-field w-full" placeholder="e.g. Yalidine" /></div>
                <div><label className="text-xs text-text-muted mb-1 block">Code *</label><input type="text" value={providerForm.code} onChange={e => setProviderForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} className="input-field w-full font-mono" placeholder="e.g. YLD" /></div>
              </div>
              <div><label className="text-xs text-text-muted mb-1 block">Tracking URL</label><input type="url" value={providerForm.trackingUrl} onChange={e => setProviderForm(f => ({ ...f, trackingUrl: e.target.value }))} className="input-field w-full" placeholder="https://..." /></div>
              <div>
                <label className="text-xs text-text-muted mb-2 block">Services</label>
                <div className="flex gap-2">{(['HOME_DELIVERY', 'STOP_DESK', 'EXPRESS'] as DeliveryServiceType[]).map(service => (
                  <button key={service} onClick={() => setProviderForm(f => ({ ...f, services: f.services.includes(service) ? f.services.filter(s => s !== service) : [...f.services, service] }))} className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all border', providerForm.services.includes(service) ? 'bg-gold/15 text-gold border-gold/20' : 'bg-white/[0.03] text-text-muted border-border hover:text-text-secondary')}>{serviceTypeLabels[service]}</button>
                ))}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-text-muted mb-1 block">Price / Kg (DZD)</label><input type="number" min={0} value={providerForm.pricePerKg} onChange={e => setProviderForm(f => ({ ...f, pricePerKg: Math.max(0, parseFloat(e.target.value) || 0) }))} className="input-field w-full" /></div>
                <div><label className="text-xs text-text-muted mb-1 block">Price / Order (DZD)</label><input type="number" min={0} value={providerForm.pricePerOrder} onChange={e => setProviderForm(f => ({ ...f, pricePerOrder: Math.max(0, parseFloat(e.target.value) || 0) }))} className="input-field w-full" /></div>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs text-text-muted">Active</label>
                <button onClick={() => setProviderForm(f => ({ ...f, isActive: !f.isActive }))} className={cn('w-10 h-5 rounded-full transition-all relative', providerForm.isActive ? 'bg-gold' : 'bg-white/10')}>
                  <div className={cn('w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all', providerForm.isActive ? 'left-5.5' : 'left-0.5')} />
                </button>
              </div>
              <div><label className="text-xs text-text-muted mb-1 block">Notes</label><textarea value={providerForm.notes} onChange={e => setProviderForm(f => ({ ...f, notes: e.target.value }))} className="textarea-field w-full" rows={2} placeholder="Additional notes..." /></div>
            </div>
            <div className="sticky bottom-0 bg-bg-surface border-t border-border px-6 py-4 flex items-center justify-end gap-3">
              <button onClick={() => setShowCreateProvider(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleCreateProvider} disabled={!providerForm.name || !providerForm.code} className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"><Plus className="w-4 h-4" /> Add Provider</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* EDIT PROVIDER MODAL                                */}
      {/* ═══════════════════════════════════════════════════ */}
      {showEditProvider && editingProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowEditProvider(false); setEditingProvider(null) }} />
          <div className="relative bg-bg-surface border border-border rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-bg-surface border-b border-border px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center"><Pencil className="w-4 h-4 text-gold" /></div><div><h2 className="text-lg font-semibold">Edit Provider</h2><p className="text-xs text-text-muted">{editingProvider.name}</p></div></div>
              <button onClick={() => { setShowEditProvider(false); setEditingProvider(null) }} className="p-2 rounded-lg hover:bg-white/[0.05] text-text-muted"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-text-muted mb-1 block">Name *</label><input type="text" value={providerForm.name} onChange={e => setProviderForm(f => ({ ...f, name: e.target.value }))} className="input-field w-full" /></div>
                <div><label className="text-xs text-text-muted mb-1 block">Code *</label><input type="text" value={providerForm.code} onChange={e => setProviderForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} className="input-field w-full font-mono" /></div>
              </div>
              <div><label className="text-xs text-text-muted mb-1 block">Tracking URL</label><input type="url" value={providerForm.trackingUrl} onChange={e => setProviderForm(f => ({ ...f, trackingUrl: e.target.value }))} className="input-field w-full" /></div>
              <div>
                <label className="text-xs text-text-muted mb-2 block">Services</label>
                <div className="flex gap-2">{(['HOME_DELIVERY', 'STOP_DESK', 'EXPRESS'] as DeliveryServiceType[]).map(service => (
                  <button key={service} onClick={() => setProviderForm(f => ({ ...f, services: f.services.includes(service) ? f.services.filter(s => s !== service) : [...f.services, service] }))} className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all border', providerForm.services.includes(service) ? 'bg-gold/15 text-gold border-gold/20' : 'bg-white/[0.03] text-text-muted border-border hover:text-text-secondary')}>{serviceTypeLabels[service]}</button>
                ))}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-text-muted mb-1 block">Price / Kg (DZD)</label><input type="number" min={0} value={providerForm.pricePerKg} onChange={e => setProviderForm(f => ({ ...f, pricePerKg: Math.max(0, parseFloat(e.target.value) || 0) }))} className="input-field w-full" /></div>
                <div><label className="text-xs text-text-muted mb-1 block">Price / Order (DZD)</label><input type="number" min={0} value={providerForm.pricePerOrder} onChange={e => setProviderForm(f => ({ ...f, pricePerOrder: Math.max(0, parseFloat(e.target.value) || 0) }))} className="input-field w-full" /></div>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs text-text-muted">Active</label>
                <button onClick={() => setProviderForm(f => ({ ...f, isActive: !f.isActive }))} className={cn('w-10 h-5 rounded-full transition-all relative', providerForm.isActive ? 'bg-gold' : 'bg-white/10')}>
                  <div className={cn('w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all', providerForm.isActive ? 'left-5.5' : 'left-0.5')} />
                </button>
              </div>
              <div><label className="text-xs text-text-muted mb-1 block">Notes</label><textarea value={providerForm.notes} onChange={e => setProviderForm(f => ({ ...f, notes: e.target.value }))} className="textarea-field w-full" rows={2} /></div>
            </div>
            <div className="sticky bottom-0 bg-bg-surface border-t border-border px-6 py-4 flex items-center justify-end gap-3">
              <button onClick={() => { setShowEditProvider(false); setEditingProvider(null) }} className="btn-secondary">Cancel</button>
              <button onClick={handleEditProvider} className="btn-primary"><CheckCircle className="w-4 h-4" /> Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* DELETE E-COM CONFIRM                               */}
      {/* ═══════════════════════════════════════════════════ */}
      {showDeleteEcom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteEcom(null)} />
          <div className="relative bg-bg-surface border border-border rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-4"><AlertTriangle className="w-6 h-6 text-danger" /></div>
            <h3 className="text-lg font-semibold mb-2">Delete E-com Delivery</h3>
            <p className="text-sm text-text-muted mb-6">Are you sure you want to delete delivery <span className="text-text-primary font-medium">{ecomDeliveries.find(d => d.id === showDeleteEcom)?.ecomTracking}</span>?</p>
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => setShowDeleteEcom(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => handleDeleteEcom(showDeleteEcom)} className="btn-primary bg-danger/15 text-danger border-danger/20 hover:bg-danger/25"><Trash2 className="w-4 h-4" /> Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* DELETE PROVIDER CONFIRM                            */}
      {/* ═══════════════════════════════════════════════════ */}
      {showDeleteProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteProvider(null)} />
          <div className="relative bg-bg-surface border border-border rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-4"><AlertTriangle className="w-6 h-6 text-danger" /></div>
            <h3 className="text-lg font-semibold mb-2">Delete Provider</h3>
            <p className="text-sm text-text-muted mb-6">Are you sure you want to delete <span className="text-text-primary font-medium">{deliveryProviders.find(p => p.id === showDeleteProvider)?.name}</span>?</p>
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => setShowDeleteProvider(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => handleDeleteProvider(showDeleteProvider)} className="btn-primary bg-danger/15 text-danger border-danger/20 hover:bg-danger/25"><Trash2 className="w-4 h-4" /> Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* DELETE SHIPMENT CONFIRM                            */}
      {/* ═══════════════════════════════════════════════════ */}
      {showDeleteShipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteShipment(null)} />
          <div className="relative bg-bg-surface border border-border rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-4"><AlertTriangle className="w-6 h-6 text-danger" /></div>
            <h3 className="text-lg font-semibold mb-2">Delete Shipment</h3>
            <p className="text-sm text-text-muted mb-6">Are you sure you want to remove shipment <span className="text-text-primary font-medium">{shipments.find(s => s.id === showDeleteShipment)?.trackingNumber}</span>?</p>
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => setShowDeleteShipment(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => handleDeleteShipment(showDeleteShipment)} className="btn-primary bg-danger/15 text-danger border-danger/20 hover:bg-danger/25"><Trash2 className="w-4 h-4" /> Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* STATUS ADVANCE MODAL                               */}
      {/* ═══════════════════════════════════════════════════ */}
      {showStatusAdvance && (() => {
        const shipment = shipments.find(s => s.id === showStatusAdvance)
        if (!shipment) return null
        const next = NEXT_SHIPMENT_STATUS[shipment.status]
        if (!next) return null
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowStatusAdvance(null)} />
            <div className="relative bg-bg-surface border border-border rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center">
              <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-4"><Send className="w-6 h-6 text-gold" /></div>
              <h3 className="text-lg font-semibold mb-2">Update Status</h3>
              <p className="text-sm text-text-muted mb-2">Move <span className="text-text-primary font-medium">{shipment.trackingNumber}</span> from</p>
              <div className="flex items-center justify-center gap-3 mb-6">
                <span className={cn('badge text-xs', shipmentStatusConfig[shipment.status].bgColor, shipmentStatusConfig[shipment.status].color)}>{shipmentStatusConfig[shipment.status].label}</span>
                <span className="text-text-muted">→</span>
                <span className={cn('badge text-xs', shipmentStatusConfig[next].bgColor, shipmentStatusConfig[next].color)}>{shipmentStatusConfig[next].label}</span>
              </div>
              <div className="flex items-center justify-center gap-3">
                <button onClick={() => setShowStatusAdvance(null)} className="btn-secondary">Cancel</button>
                <button onClick={() => handleAdvanceShipmentStatus(shipment)} className="btn-primary"><Send className="w-4 h-4" /> {shipmentStatusConfig[next].label}</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ═══════════════════════════════════════════════════ */}
      {/* SHIPMENT DETAIL DRAWER                             */}
      {/* ═══════════════════════════════════════════════════ */}
      {selectedShipment && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowShipmentDetail(null)} />
          <div className="relative bg-bg-surface border-l border-border w-full max-w-lg overflow-y-auto shadow-2xl animate-in slide-in-from-right">
            <div className="sticky top-0 bg-bg-surface border-b border-border px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center"><Eye className="w-4 h-4 text-gold" /></div>
                <div><h2 className="text-lg font-semibold font-mono">{selectedShipment.trackingNumber}</h2><p className="text-xs text-text-muted">Created {formatDateTime(selectedShipment.createdAt)}</p></div>
              </div>
              <button onClick={() => setShowShipmentDetail(null)} className="p-2 rounded-lg hover:bg-white/[0.05] text-text-muted"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-3 flex-wrap">
                <span className={cn('badge text-xs', shipmentStatusConfig[selectedShipment.status].bgColor, shipmentStatusConfig[selectedShipment.status].color)}>{shipmentStatusConfig[selectedShipment.status].label}</span>
                <span className="badge text-xs bg-white/[0.05] text-text-muted">{serviceTypeLabels[selectedShipment.serviceType]}</span>
                {isDelayed(selectedShipment) && <span className="badge text-xs bg-warning/12 text-warning">Delayed</span>}
              </div>
              <div className="glass-card p-4">
                <h4 className="text-xs font-semibold text-gold uppercase tracking-wider mb-3 flex items-center gap-2"><Truck className="w-3 h-3" /> Shipment Details</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm"><span className="text-text-muted">Provider</span><span>{getProvider(selectedShipment.providerId)?.name || 'Unknown'}</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-text-muted">Tracking</span><span className="font-mono text-xs">{selectedShipment.trackingNumber}</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-text-muted">Service</span><span>{serviceTypeLabels[selectedShipment.serviceType]}</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-text-muted">Cost</span><span className="font-medium text-gold">{formatDzd(selectedShipment.cost)}</span></div>
                  {selectedShipment.weightKg && <div className="flex items-center justify-between text-sm"><span className="text-text-muted">Weight</span><span>{selectedShipment.weightKg} Kg</span></div>}
                </div>
              </div>
              {(() => { const order = getOrder(selectedShipment.orderId); if (!order) return null; return (
                <div className="glass-card p-4">
                  <h4 className="text-xs font-semibold text-gold uppercase tracking-wider mb-3 flex items-center gap-2"><Package className="w-3 h-3" /> Linked Order</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm"><span className="text-text-muted">Order #</span><span className="font-medium">{order.orderNumber}</span></div>
                    <div className="flex items-center justify-between text-sm"><span className="text-text-muted">Customer</span><span>{order.customer?.name || '-'}</span></div>
                    <div className="flex items-center justify-between text-sm"><span className="text-text-muted">Phone</span><span>{order.customer?.phone || '-'}</span></div>
                    <div className="flex items-center justify-between text-sm"><span className="text-text-muted">Address</span><span className="text-right text-xs">{order.customer?.wilaya || '-'}</span></div>
                  </div>
                </div>
              ) })()}
              <div className="glass-card p-4">
                <h4 className="text-xs font-semibold text-gold uppercase tracking-wider mb-3 flex items-center gap-2"><Calendar className="w-3 h-3" /> Timeline</h4>
                <div className="space-y-0">
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center"><div className="w-2.5 h-2.5 rounded-full bg-info shrink-0 mt-1" /><div className="w-px flex-1 bg-border my-1" /></div>
                    <div className="pb-3"><p className="text-sm font-medium">Shipped</p><p className="text-[11px] text-text-muted">{formatDateTime(selectedShipment.shippedAt)}</p></div>
                  </div>
                  {selectedShipment.estimatedDelivery && (
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center"><div className={cn('w-2.5 h-2.5 rounded-full shrink-0 mt-1', isDelayed(selectedShipment) ? 'bg-warning' : 'bg-gold')} /><div className="w-px flex-1 bg-border my-1" /></div>
                      <div className="pb-3"><p className="text-sm font-medium">Estimated Delivery</p><p className={cn('text-[11px]', isDelayed(selectedShipment) ? 'text-warning' : 'text-text-muted')}>{formatDate(selectedShipment.estimatedDelivery)}{isDelayed(selectedShipment) && ' (Delayed)'}</p></div>
                    </div>
                  )}
                  {selectedShipment.deliveredAt && (
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center"><div className="w-2.5 h-2.5 rounded-full bg-success shrink-0 mt-1" /></div>
                      <div><p className="text-sm font-medium">Delivered</p><p className="text-[11px] text-text-muted">{formatDateTime(selectedShipment.deliveredAt)}</p></div>
                    </div>
                  )}
                </div>
              </div>
              {selectedShipment.notes && (
                <div className="glass-card p-4">
                  <h4 className="text-xs font-semibold text-gold uppercase tracking-wider mb-3 flex items-center gap-2"><StickyNote className="w-3 h-3" /> Notes</h4>
                  <p className="text-sm text-text-secondary">{selectedShipment.notes}</p>
                </div>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => { setShowShipmentDetail(null); setEditingShipment(selectedShipment); setShipmentForm({ orderId: selectedShipment.orderId, providerId: selectedShipment.providerId, trackingNumber: selectedShipment.trackingNumber, serviceType: selectedShipment.serviceType, cost: selectedShipment.cost, weightKg: selectedShipment.weightKg || 0, estimatedDelivery: selectedShipment.estimatedDelivery ? new Date(selectedShipment.estimatedDelivery).toISOString().split('T')[0] : '', notes: selectedShipment.notes || '' }); setShowEditShipment(true) }} className="btn-secondary text-xs"><Pencil className="w-3 h-3" /> Edit</button>
                {NEXT_SHIPMENT_STATUS[selectedShipment.status] && <button onClick={() => { setShowShipmentDetail(null); setShowStatusAdvance(selectedShipment.id) }} className="btn-primary text-xs"><Send className="w-3 h-3" /> {shipmentStatusConfig[NEXT_SHIPMENT_STATUS[selectedShipment.status]!].label}</button>}
                <button onClick={() => { setShowShipmentDetail(null); setShowDeleteShipment(selectedShipment.id) }} className="btn-secondary text-xs text-danger hover:bg-danger/10"><Trash2 className="w-3 h-3" /> Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
