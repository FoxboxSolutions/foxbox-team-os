import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import {
  MessageSquareCheck,
  Plus,
  Search,
  X,
  Pencil,
  Trash2,
  Copy,
  Check,
  Clipboard,
  ChevronDown,
  Home,
  Building2,
  AlertTriangle,
  Package,
  MapPin,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  Truck,
  Send,
  ExternalLink,
  Loader2,
  AlertCircle,
  Eye,
  Info,
} from 'lucide-react'
import { useAppState } from '@/stores/AppState'
import { cn } from '@/lib/utils'
import {
  getWilayas,
  getBaladiyas,
  getDeliveryPrice,
  getOffices,
  getDeliveryInfo,
} from '@/lib/delivery-service'
import { createColisFromConfirmation } from '@/lib/api'
import type { WilayaInfo, Baladiya, OfficeInfo } from '@/lib/delivery-service'
import type { Confirmation, MessageConfirmationStatus, EcomDeliveryStatus } from '@/types'

// ─── Constants ──────────────────────────────────────────────

const statusConfig: Record<MessageConfirmationStatus, { label: string; color: string; bgColor: string; icon: typeof CheckCircle2 }> = {
  CONFIRMED: { label: 'Confirmed', color: 'text-success', bgColor: 'bg-success/12', icon: CheckCircle2 },
  PENDING: { label: 'Pending', color: 'text-warning', bgColor: 'bg-warning/12', icon: Clock },
  CANCELLED: { label: 'Cancelled', color: 'text-danger', bgColor: 'bg-danger/12', icon: XCircle },
}

const ecomStatusLabel: Record<string, string> = {
  PREPARING: 'En préparation',
  PROCESSING: 'En traitement',
  DISPATCHED: 'Envoyé',
  AT_OFFICE: 'Au bureau',
  OUT_FOR_DELIVERY: 'En cours de livraison',
  DELIVERED: 'Livré',
  NO_ANSWER: 'Pas de réponse',
  POSTPONED: 'Reporté',
  CANCELLED: 'Annulé',
  RETURNED: 'Retourné',
  DISPATCH_RETURN: 'Retour dispatch',
  NAVETTE_RETURN: 'Retour navette',
  COLLECTED: 'Collecté',
  RECOVERED: 'Récupéré',
  CONFIRMED: 'Confirmé',
  TRACKING: 'Suivi',
  IN_PROGRESS: 'En cours',
}

interface ConfirmationFormData {
  fullName: string
  phone: string
  wilayaCode: string
  baladiya: string
  shippingMethod: 'HOME' | 'OFFICE'
  address: string
  officeRef: string
  productId: string
  quantity: number
  notes: string
}

const emptyForm: ConfirmationFormData = {
  fullName: '',
  phone: '',
  wilayaCode: '',
  baladiya: '',
  shippingMethod: 'HOME',
  address: '',
  officeRef: '',
  productId: '',
  quantity: 1,
  notes: '',
}

// ─── Phone Validation ───────────────────────────────────────

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('213') && digits.length === 12) {
    return '0' + digits.slice(3)
  }
  if (digits.length === 9 && digits.startsWith('0')) {
    return digits
  }
  if (digits.length === 10 && digits.startsWith('0')) {
    return digits.slice(0, 10)
  }
  if (digits.length === 8) {
    return '0' + digits
  }
  return raw.replace(/\D/g, '')
}

function isValidAlgerianPhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, '')
  let normalized = digits
  if (digits.startsWith('213') && digits.length === 12) {
    normalized = '0' + digits.slice(3)
  }
  if (digits.length === 10 && digits.startsWith('0')) {
    normalized = digits
  }
  if (normalized.length !== 10) return false
  const prefix = normalized.slice(0, 2)
  return ['05', '06', '07'].includes(prefix)
}

// ─── Copy Formatters ────────────────────────────────────────

function formatSingleCopy(c: Confirmation, products: { id: string; name: string }[]): string {
  const productName = products.find(p => p.id === c.productId)?.name || 'N/A'
  const lines = [
    `Client : ${c.fullName}`,
    `Téléphone : ${c.phone}`,
    `Wilaya : ${c.wilayaCode} — ${c.wilayaName}`,
    `Baladiya : ${c.baladiya}`,
    `Livraison : ${c.shippingMethod === 'HOME' ? 'Domicile' : 'Office'}`,
  ]
  if (c.shippingMethod === 'OFFICE') {
    if (c.officeName) lines.push(`Bureau : ${c.officeName}`)
  }
  if (c.deliveryProvider === 'ecom') {
    lines.push(`Delivery : E-com`)
  }
  lines.push(`Frais livraison : ${c.deliveryPrice} DA`)
  if (c.ecomTracking) {
    lines.push(`Tracking E-com : ${c.ecomTracking}`)
  }
  lines.push(``)
  lines.push(`Produit : ${productName}`)
  lines.push(`Prix : ${c.productPrice.toLocaleString('fr-DZ')} DA`)
  lines.push(`Quantité : ${c.quantity}`)
  lines.push(``)
  lines.push(`Total : ${c.total.toLocaleString('fr-DZ')} DA`)
  return lines.join('\n')
}

function formatBatchCopy(confirmations: Confirmation[], products: { id: string; name: string }[]): string {
  return confirmations.map((c, i) => {
    return `CLIENT ${i + 1}\n${'─'.repeat(20)}\n${formatSingleCopy(c, products)}`
  }).join('\n\n')
}

// ─── E-com Status Badge ─────────────────────────────────────

function EcomStatusBadge({ confirmation }: { confirmation: Confirmation }) {
  if (!confirmation.ecomTracking) return <span className="text-text-muted">—</span>

  const statusColor = (() => {
    switch (confirmation.ecomStatus) {
      case 'DELIVERED': return 'bg-success/15 text-success border-success/20'
      case 'CANCELLED':
      case 'RETURNED':
      case 'NO_ANSWER': return 'bg-danger/15 text-danger border-danger/20'
      case 'OUT_FOR_DELIVERY': return 'bg-info/15 text-info border-info/20'
      case 'DISPATCHED':
      case 'PROCESSING': return 'bg-warning/15 text-warning border-warning/20'
      default: return 'bg-gold/10 text-gold border-gold/20'
    }
  })()

  return (
    <div className="flex flex-col gap-1">
      <span className={cn('inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium border', statusColor)}>
        <Check className="w-2.5 h-2.5" />
        E-com ✓
      </span>
      <span className="text-[10px] text-text-muted font-mono truncate max-w-[100px] block" title={confirmation.ecomTracking}>
        {confirmation.ecomTracking}
      </span>
    </div>
  )
}

// ─── Detail Drawer ──────────────────────────────────────────

interface DetailDrawerProps {
  confirmation: Confirmation | null
  onClose: () => void
  products: { id: string; name: string }[]
}

function DetailDrawer({ confirmation: c, onClose, products }: DetailDrawerProps) {
  if (!c) return null

  const productName = products.find(p => p.id === c.productId)?.name || '-'
  const sc = statusConfig[c.status]
  const StatusIcon = sc.icon

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-charcoal border-l border-border shadow-2xl overflow-y-auto animate-in slide-in-from-right">
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-border bg-charcoal">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Info className="w-5 h-5 text-gold" />
            Détails de la confirmation
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg text-text-muted hover:text-text-secondary hover:bg-white/[0.05] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Status */}
          <div className="flex items-center gap-3">
            <span className={cn('inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-medium', sc.bgColor, sc.color)}>
              <StatusIcon className="w-3.5 h-3.5" />
              {sc.label}
            </span>
            <span className="text-xs text-text-muted">
              {new Date(c.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* Customer */}
          <div>
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Client</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">Nom</span>
                <span className="text-text-primary font-medium">{c.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Téléphone</span>
                <span className="text-text-primary font-mono">{c.phone}</span>
              </div>
            </div>
          </div>

          {/* Location */}
          <div>
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Emplacement</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">Wilaya</span>
                <span className="text-text-primary">{c.wilayaCode} — {c.wilayaName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Baladiya</span>
                <span className="text-text-primary">{c.baladiya}</span>
              </div>
            </div>
          </div>

          {/* Delivery */}
          <div>
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Livraison</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">Type</span>
                <span className="text-text-primary">{c.shippingMethod === 'HOME' ? 'Domicile' : 'Office'}</span>
              </div>
              {c.shippingMethod === 'HOME' && c.address && (
                <div className="flex justify-between">
                  <span className="text-text-muted">Adresse</span>
                  <span className="text-text-primary text-right max-w-[250px]">{c.address}</span>
                </div>
              )}
              {c.shippingMethod === 'OFFICE' && (
                <>
                  {c.officeName && (
                    <div className="flex justify-between">
                      <span className="text-text-muted">Bureau</span>
                      <span className="text-text-primary">{c.officeName}</span>
                    </div>
                  )}
                  {c.officeRef && (
                    <div className="flex justify-between">
                      <span className="text-text-muted">Référence</span>
                      <span className="text-text-primary font-mono">{c.officeRef}</span>
                    </div>
                  )}
                  {c.officeAddress && (
                    <div className="flex justify-between">
                      <span className="text-text-muted">Adresse bureau</span>
                      <span className="text-text-primary text-right max-w-[250px]">{c.officeAddress}</span>
                    </div>
                  )}
                  {c.officePhone && (
                    <div className="flex justify-between">
                      <span className="text-text-muted">Téléphone bureau</span>
                      <span className="text-text-primary font-mono">{c.officePhone}</span>
                    </div>
                  )}
                  {c.transporter && (
                    <div className="flex justify-between">
                      <span className="text-text-muted">Opérateur</span>
                      <span className={cn('font-semibold', c.transporter === 'NOEST' ? 'text-blue' : 'text-purple')}>{c.transporter}</span>
                    </div>
                  )}
                </>
              )}
              <div className="flex justify-between">
                <span className="text-text-muted">Frais livraison</span>
                <span className="text-gold font-bold">{c.deliveryPrice} DA</span>
              </div>
            </div>
          </div>

          {/* Product */}
          <div>
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Produit</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">Produit</span>
                <span className="text-text-primary">{productName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Prix unitaire</span>
                <span className="text-gold">{c.productPrice.toLocaleString('fr-DZ')} DA</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Quantité</span>
                <span className="text-text-primary">{c.quantity}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-border">
                <span className="text-text-secondary font-semibold">Total</span>
                <span className="text-gold font-bold">{c.total.toLocaleString('fr-DZ')} DA</span>
              </div>
            </div>
          </div>

          {/* E-com Section */}
          {c.ecomTracking && (
            <div className="p-4 rounded-xl bg-surface border border-gold/20 space-y-3">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-gold" />
                <h3 className="text-xs font-semibold text-gold uppercase tracking-wider">E-com Delivery</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-muted">Tracking</span>
                  <span className="text-text-primary font-mono font-semibold">{c.ecomTracking}</span>
                </div>
                {c.ecomStatus && (
                  <div className="flex justify-between">
                    <span className="text-text-muted">Statut</span>
                    <span className="text-text-primary">{ecomStatusLabel[c.ecomStatus] || c.ecomStatusText || c.ecomStatus}</span>
                  </div>
                )}
                {c.ecomLogisticsState && (
                  <div className="flex justify-between">
                    <span className="text-text-muted">État logistique</span>
                    <span className="text-text-primary">{c.ecomLogisticsState}</span>
                  </div>
                )}
                {c.ecomSentAt && (
                  <div className="flex justify-between">
                    <span className="text-text-muted">Date d'envoi</span>
                    <span className="text-text-primary">
                      {new Date(c.ecomSentAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}
                {c.ecomLastSyncAt && (
                  <div className="flex justify-between">
                    <span className="text-text-muted">Dernière sync</span>
                    <span className="text-text-primary">
                      {new Date(c.ecomLastSyncAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}
                {c.ecomError && (
                  <div className="mt-2 p-2 rounded-lg bg-danger/10 border border-danger/20">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-danger flex-shrink-0 mt-0.5" />
                      <span className="text-xs text-danger">{c.ecomError}</span>
                    </div>
                  </div>
                )}
                <a
                  href={`/app/delivery?tracking=${c.ecomTracking}`}
                  className="mt-2 w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-gold/10 text-gold text-xs font-medium hover:bg-gold/20 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Voir le suivi complet
                </a>
              </div>
            </div>
          )}

          {/* Notes */}
          {c.notes && (
            <div>
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Notes</h3>
              <p className="text-sm text-text-secondary whitespace-pre-wrap">{c.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────

export function ConfirmationMessages() {
  const {
    confirmations, addConfirmation, updateConfirmation, deleteConfirmation,
    products, sellingProducts, currentUser, addActivityLog, addNotification,
  } = useAppState()

  // Delivery data
  const allWilayas = useMemo(() => getWilayas(), [])

  // UI State
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ConfirmationFormData>(emptyForm)
  const [errors, setErrors] = useState<Partial<Record<keyof ConfirmationFormData, string>>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<MessageConfirmationStatus | 'ALL'>('ALL')
  const [shippingFilter, setShippingFilter] = useState<'ALL' | 'HOME' | 'OFFICE'>('ALL')
  const [wilayaFilter, setWilayaFilter] = useState<string>('ALL')
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'YESTERDAY' | '7DAYS'>('ALL')
  const [transporterFilter, setTransporterFilter] = useState<string>('ALL')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [showCopyMenu, setShowCopyMenu] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const phoneInputRef = useRef<HTMLInputElement>(null)
  const copyMenuRef = useRef<HTMLDivElement>(null)

  // E-com state
  const [sendingEcomId, setSendingEcomId] = useState<string | null>(null)
  const [sendingBatch, setSendingBatch] = useState(false)
  const [ecomErrors, setEcomErrors] = useState<Record<string, string>>({})
  const [detailDrawerId, setDetailDrawerId] = useState<string | null>(null)

  // Close copy menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (copyMenuRef.current && !copyMenuRef.current.contains(e.target as Node)) {
        setShowCopyMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Show toast
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  // ─── Delivery data derivations ─────────────────────────────

  const selectedWilayaInfo = useMemo<WilayaInfo | null>(
    () => allWilayas.find(w => w.code === form.wilayaCode) || null,
    [allWilayas, form.wilayaCode]
  )

  const baladiyas = useMemo<Baladiya[]>(
    () => form.wilayaCode ? getBaladiyas(form.wilayaCode) : [],
    [form.wilayaCode]
  )

  const offices = useMemo<OfficeInfo[]>(
    () => form.wilayaCode ? getOffices(form.wilayaCode) : [],
    [form.wilayaCode]
  )

  const selectedOffice = useMemo<OfficeInfo | null>(
    () => (form.wilayaCode && form.officeRef) ? offices.find(o => o.code === form.officeRef) || null : null,
    [form.wilayaCode, form.officeRef, offices]
  )

  const deliveryInfo = useMemo(
    () => form.wilayaCode ? getDeliveryInfo(form.wilayaCode, form.shippingMethod, form.officeRef || undefined) : null,
    [form.wilayaCode, form.shippingMethod, form.officeRef]
  )

  const liveDeliveryPrice = useMemo<number>(() => {
    if (!deliveryInfo || !deliveryInfo.priceAvailable) return 0
    return deliveryInfo.price ?? 0
  }, [deliveryInfo])

  const selectedProductPrice = useMemo<number>(() => {
    if (!form.productId) return 0
    // Check selling products first
    const sp = sellingProducts.find(p => p.id === form.productId)
    if (sp) return sp.sellingPriceDzd
    // Fallback to research products for backward compatibility
    const product = products.find(p => p.id === form.productId)
    if (!product) return 0
    if (product.codScenario?.sellingPriceDzd) return product.codScenario.sellingPriceDzd
    if (product.variants?.[0]?.priceRmb) return product.variants[0].priceRmb
    return 0
  }, [form.productId, sellingProducts, products])

  const liveTotal = useMemo<number>(() => {
    return (selectedProductPrice * form.quantity) + liveDeliveryPrice
  }, [selectedProductPrice, form.quantity, liveDeliveryPrice])

  // Unique transporters for filter
  const uniqueTransporters = useMemo(() => {
    const set = new Set(confirmations.filter(c => c.transporter).map(c => c.transporter!))
    return Array.from(set).sort()
  }, [confirmations])

  // Unique wilayas from confirmations for filter
  const uniqueWilayas = useMemo(() => {
    const map = new Map<string, string>()
    confirmations.forEach(c => {
      if (!map.has(c.wilayaCode)) map.set(c.wilayaCode, c.wilayaName)
    })
    return Array.from(map.entries()).map(([code, name]) => ({ code, name })).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
  }, [confirmations])

  // ─── Filtered confirmations ────────────────────────────────

  const filtered = useMemo(() => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterdayStart = new Date(todayStart)
    yesterdayStart.setDate(yesterdayStart.getDate() - 1)
    const sevenDaysAgo = new Date(todayStart)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    return confirmations.filter(c => {
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false
      if (shippingFilter !== 'ALL' && c.shippingMethod !== shippingFilter) return false
      if (wilayaFilter !== 'ALL' && c.wilayaCode !== wilayaFilter) return false
      if (transporterFilter !== 'ALL' && c.transporter !== transporterFilter) return false
      if (dateFilter === 'TODAY' && new Date(c.createdAt) < todayStart) return false
      if (dateFilter === 'YESTERDAY' && (new Date(c.createdAt) < yesterdayStart || new Date(c.createdAt) >= todayStart)) return false
      if (dateFilter === '7DAYS' && new Date(c.createdAt) < sevenDaysAgo) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const productName = (() => {
          const sp = sellingProducts.find(p => p.id === c.productId)
          if (sp) return sp.name
          return products.find(p => p.id === c.productId)?.name || ''
        })()
        return (
          c.fullName.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          c.wilayaName.toLowerCase().includes(q) ||
          c.baladiya.toLowerCase().includes(q) ||
          productName.toLowerCase().includes(q) ||
          (c.officeName && c.officeName.toLowerCase().includes(q)) ||
          (c.transporter && c.transporter.toLowerCase().includes(q)) ||
          (c.ecomTracking && c.ecomTracking.toLowerCase().includes(q))
        )
      }
      return true
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [confirmations, statusFilter, shippingFilter, wilayaFilter, transporterFilter, dateFilter, searchQuery, products])

  // ─── KPIs ──────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return {
      today: confirmations.filter(c => new Date(c.createdAt) >= todayStart).length,
      confirmed: confirmations.filter(c => c.status === 'CONFIRMED').length,
      pending: confirmations.filter(c => c.status === 'PENDING').length,
      cancelled: confirmations.filter(c => c.status === 'CANCELLED').length,
    }
  }, [confirmations])

  // ─── Selection ─────────────────────────────────────────────

  const allVisibleSelected = filtered.length > 0 && filtered.every(c => selectedIds.has(c.id))
  const toggleSelectAll = useCallback(() => {
    if (allVisibleSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map(c => c.id)))
    }
  }, [allVisibleSelected, filtered])
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  // ─── Phone validation ──────────────────────────────────────

  const phoneError = useMemo(() => {
    if (!form.phone) return ''
    if (!isValidAlgerianPhone(form.phone)) return 'Invalid Algerian phone number (05/06/07...)'
    return ''
  }, [form.phone])

  const duplicateWarning = useMemo(() => {
    if (!form.phone || !isValidAlgerianPhone(form.phone)) return null
    const normalized = normalizePhone(form.phone)
    return confirmations.find(c => c.phone === normalized && c.id !== editingId) || null
  }, [form.phone, editingId, confirmations])

  // ─── Validate ──────────────────────────────────────────────

  const validate = useCallback((): boolean => {
    const errs: Partial<Record<keyof ConfirmationFormData, string>> = {}
    if (!form.fullName.trim()) errs.fullName = 'Please enter the customer\'s full name.'
    if (!form.phone.trim()) errs.phone = 'Please enter a phone number.'
    else if (!isValidAlgerianPhone(form.phone)) errs.phone = 'Invalid Algerian phone number.'
    if (!form.wilayaCode) errs.wilayaCode = 'Please select a Wilaya.'
    if (!form.baladiya) errs.baladiya = 'Please select a Baladiya.'
    if (form.shippingMethod === 'OFFICE' && !form.officeRef) errs.officeRef = 'Please select an office.'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }, [form])

  // ─── Modal openers ─────────────────────────────────────────

  const openCreate = useCallback(() => {
    setEditingId(null)
    setForm(emptyForm)
    setErrors({})
    setShowModal(true)
  }, [])

  const openEdit = useCallback((c: Confirmation) => {
    setEditingId(c.id)
    setForm({
      fullName: c.fullName,
      phone: c.phone,
      wilayaCode: c.wilayaCode,
      baladiya: c.baladiya,
      shippingMethod: c.shippingMethod,
      address: c.address || '',
      officeRef: c.officeRef || '',
      productId: c.productId || '',
      quantity: c.quantity,
      notes: c.notes || '',
    })
    setErrors({})
    setShowModal(true)
  }, [])

  // ─── Form wilaya change handler ────────────────────────────

  const handleWilayaChange = useCallback((wilayaCode: string) => {
    setForm(f => ({
      ...f,
      wilayaCode,
      baladiya: '',
      officeRef: '',
      address: f.shippingMethod === 'HOME' ? f.address : '',
    }))
  }, [])

  // ─── Form shipping method change handler ───────────────────

  const handleShippingMethodChange = useCallback((method: 'HOME' | 'OFFICE') => {
    setForm(f => ({
      ...f,
      shippingMethod: method,
      address: method === 'HOME' ? f.address : '',
      officeRef: method === 'OFFICE' ? f.officeRef : '',
    }))
  }, [])

  // ─── Submit ────────────────────────────────────────────────

  const handleSubmit = useCallback(() => {
    if (!validate()) return
    const normalized = normalizePhone(form.phone)
    const now = new Date()
    const wilayaInfo = allWilayas.find(w => w.code === form.wilayaCode)
    const wilayaName = wilayaInfo?.nameAr || ''
    const office = form.shippingMethod === 'OFFICE' ? offices.find(o => o.code === form.officeRef) || null : null
    const priceData = form.wilayaCode ? getDeliveryPrice(form.wilayaCode) : null
    const deliveryPrice = priceData
      ? (form.shippingMethod === 'HOME' ? priceData.home : priceData.office)
      : 0

    if (editingId) {
      const existing = confirmations.find(c => c.id === editingId)
      if (!existing) return
      const updated: Confirmation = {
        ...existing,
        fullName: form.fullName.trim(),
        phone: normalized,
        wilayaCode: form.wilayaCode,
        wilayaName,
        baladiya: form.baladiya,
        shippingMethod: form.shippingMethod,
        deliveryPrice,
        address: form.shippingMethod === 'HOME' ? form.address.trim() : undefined,
        officeRef: office?.code,
        officeName: office?.lieu,
        officeAddress: office?.adresse,
        officePhone: office?.tel,
        transporter: office?.transporteur,
        productId: form.productId || undefined,
        productPrice: selectedProductPrice,
        quantity: form.quantity,
        total: liveTotal,
        notes: form.notes.trim() || undefined,
        updatedAt: now,
      }
      updateConfirmation(updated)
      addActivityLog({
        id: Date.now().toString(36) + Math.random().toString(36).substring(2, 10),
        action: 'CONFIRMATION_UPDATED',
        userId: currentUser?.id || '',
        entityType: 'CONFIRMATION',
        entityId: updated.id,
        entityName: updated.fullName,
        details: `Updated confirmation for ${updated.fullName}`,
        createdAt: now,
      })
      showToast('Confirmation updated.')
    } else {
      const newConf: Confirmation = {
        id: Date.now().toString(36) + Math.random().toString(36).substring(2, 10),
        fullName: form.fullName.trim(),
        phone: normalized,
        wilayaCode: form.wilayaCode,
        wilayaName,
        baladiya: form.baladiya,
        shippingMethod: form.shippingMethod,
        deliveryPrice,
        address: form.shippingMethod === 'HOME' ? form.address.trim() : undefined,
        officeRef: office?.code,
        officeName: office?.lieu,
        officeAddress: office?.adresse,
        officePhone: office?.tel,
        transporter: office?.transporteur,
        productId: form.productId || undefined,
        productPrice: selectedProductPrice,
        quantity: form.quantity,
        total: liveTotal,
        notes: form.notes.trim() || undefined,
        status: 'PENDING',
        createdBy: currentUser?.id || '',
        createdAt: now,
        updatedAt: now,
      }
      addConfirmation(newConf)
      addActivityLog({
        id: Date.now().toString(36) + Math.random().toString(36).substring(2, 10),
        action: 'CONFIRMATION_CREATED',
        userId: currentUser?.id || '',
        entityType: 'CONFIRMATION',
        entityId: newConf.id,
        entityName: newConf.fullName,
        details: `Created confirmation for ${newConf.fullName}`,
        createdAt: now,
      })
      addNotification({
        id: Date.now().toString(36) + Math.random().toString(36).substring(2, 10),
        type: 'GENERAL',
        title: 'Confirmation added',
        message: `${newConf.fullName} confirmed via message`,
        link: '/app/confirmation',
        isRead: false,
        userId: currentUser?.id || '',
        createdAt: now,
      })
      showToast('Confirmation added.')
    }
    setShowModal(false)
    setEditingId(null)
    setForm(emptyForm)
  }, [form, validate, editingId, confirmations, currentUser, allWilayas, offices, addConfirmation, updateConfirmation, addActivityLog, addNotification, showToast])

  // ─── Delete ────────────────────────────────────────────────

  const handleDelete = useCallback((id: string) => {
    const c = confirmations.find(x => x.id === id)
    if (!c) return
    deleteConfirmation(id)
    addActivityLog({
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 10),
      action: 'CONFIRMATION_DELETED',
      userId: currentUser?.id || '',
      entityType: 'CONFIRMATION',
      entityId: id,
      entityName: c.fullName,
      details: `Archived confirmation for ${c.fullName}`,
      createdAt: new Date(),
    })
    setShowDeleteConfirm(null)
    setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n })
    showToast('Confirmation archived.')
  }, [confirmations, currentUser, deleteConfirmation, addActivityLog, showToast])

  // ─── Status change ─────────────────────────────────────────

  const handleStatusChange = useCallback((id: string, status: MessageConfirmationStatus) => {
    const c = confirmations.find(x => x.id === id)
    if (!c) return
    updateConfirmation({ ...c, status, updatedAt: new Date() })
  }, [confirmations, updateConfirmation])

  // ─── E-com Send ────────────────────────────────────────────

  const handleSendToEcom = useCallback(async (c: Confirmation) => {
    if (c.ecomTracking) return
    if (c.status !== 'CONFIRMED') return

    setSendingEcomId(c.id)
    setEcomErrors(prev => { const n = { ...prev }; delete n[c.id]; return n })

    try {
      const result = await createColisFromConfirmation({
        id: c.id,
        fullName: c.fullName,
        phone: c.phone,
        wilayaCode: c.wilayaCode,
        wilayaName: c.wilayaName,
        baladiya: c.baladiya,
        shippingMethod: c.shippingMethod,
        deliveryPrice: c.deliveryPrice,
        address: c.address,
        officeRef: c.officeRef,
        officeName: c.officeName,
        officeAddress: c.officeAddress,
        officePhone: c.officePhone,
        transporter: c.transporter,
        productId: c.productId,
        productPrice: c.productPrice,
        quantity: c.quantity,
        total: c.total,
        notes: c.notes,
      }) as {
        tracking?: string
        parcelId?: number
        idExterne?: string
        status?: string
        statusText?: string
        error?: string
      }

      if (result?.error) {
        setEcomErrors(prev => ({ ...prev, [c.id]: result.error! }))
        showToast(`Erreur E-com : ${result.error}`, 'error')
        return
      }

      const now = new Date()
      const updated: Confirmation = {
        ...c,
        deliveryProvider: 'ecom',
        ecomTracking: result?.tracking || '',
        ecomParcelId: result?.parcelId,
        ecomIdExterne: result?.idExterne,
        ecomStatus: (result?.status as EcomDeliveryStatus) || 'PREPARING',
        ecomStatusText: result?.statusText || 'Envoyé',
        ecomSentAt: now.toISOString(),
        ecomLastSyncAt: now.toISOString(),
        ecomCreatedAt: now.toISOString(),
        updatedAt: now,
      }
      updateConfirmation(updated)

      addActivityLog({
        id: Date.now().toString(36) + Math.random().toString(36).substring(2, 10),
        action: 'CONFIRMATION_SENT_TO_ECOM',
        userId: currentUser?.id || '',
        entityType: 'CONFIRMATION',
        entityId: c.id,
        entityName: c.fullName,
        details: `Sent confirmation to E-com Delivery. Tracking: ${result?.tracking || 'N/A'}`,
        createdAt: now,
      })

      addNotification({
        id: Date.now().toString(36) + Math.random().toString(36).substring(2, 10),
        type: 'GENERAL',
        title: 'Envoyé à E-com Delivery',
        message: `${c.fullName} — Tracking: ${result?.tracking || 'N/A'}`,
        link: `/app/delivery?tracking=${result?.tracking || ''}`,
        isRead: false,
        userId: currentUser?.id || '',
        createdAt: now,
      })

      showToast(`Envoyé à E-com Delivery — Tracking: ${result?.tracking || 'N/A'}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue'
      setEcomErrors(prev => ({ ...prev, [c.id]: msg }))
      showToast(`Erreur E-com : ${msg}`, 'error')
    } finally {
      setSendingEcomId(null)
    }
  }, [updateConfirmation, addActivityLog, addNotification, currentUser, showToast])

  // ─── Send Selected to E-com (batch) ───────────────────────

  const handleSendSelectedToEcom = useCallback(async () => {
    const selected = confirmations.filter(c =>
      selectedIds.has(c.id) && c.status === 'CONFIRMED' && !c.ecomTracking
    )
    if (selected.length === 0) return

    setSendingBatch(true)
    setEcomErrors({})
    let sent = 0
    let failed = 0

    for (const c of selected) {
      try {
        const result = await createColisFromConfirmation({
          id: c.id,
          fullName: c.fullName,
          phone: c.phone,
          wilayaCode: c.wilayaCode,
          wilayaName: c.wilayaName,
          baladiya: c.baladiya,
          shippingMethod: c.shippingMethod,
          deliveryPrice: c.deliveryPrice,
          address: c.address,
          officeRef: c.officeRef,
          officeName: c.officeName,
          officeAddress: c.officeAddress,
          officePhone: c.officePhone,
          transporter: c.transporter,
          productId: c.productId,
          productPrice: c.productPrice,
          quantity: c.quantity,
          total: c.total,
          notes: c.notes,
        }) as {
          tracking?: string
          parcelId?: number
          idExterne?: string
          status?: string
          statusText?: string
          error?: string
        }

        if (result?.error) {
          setEcomErrors(prev => ({ ...prev, [c.id]: result.error! }))
          failed++
          continue
        }

        const now = new Date()
        const updated: Confirmation = {
          ...c,
          deliveryProvider: 'ecom',
          ecomTracking: result?.tracking || '',
          ecomParcelId: result?.parcelId,
          ecomIdExterne: result?.idExterne,
          ecomStatus: (result?.status as EcomDeliveryStatus) || 'PREPARING',
          ecomStatusText: result?.statusText || 'Envoyé',
          ecomSentAt: now.toISOString(),
          ecomLastSyncAt: now.toISOString(),
          ecomCreatedAt: now.toISOString(),
          updatedAt: now,
        }
        updateConfirmation(updated)

        addActivityLog({
          id: Date.now().toString(36) + Math.random().toString(36).substring(2, 10),
          action: 'CONFIRMATION_SENT_TO_ECOM',
          userId: currentUser?.id || '',
          entityType: 'CONFIRMATION',
          entityId: c.id,
          entityName: c.fullName,
          details: `Batch sent to E-com Delivery. Tracking: ${result?.tracking || 'N/A'}`,
          createdAt: now,
        })

        sent++
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erreur inconnue'
        setEcomErrors(prev => ({ ...prev, [c.id]: msg }))
        failed++
      }
    }

    setSelectedIds(new Set())
    setSendingBatch(false)

    if (sent > 0 && failed === 0) {
      showToast(`${sent} commande(s) envoyée(s) à E-com Delivery`)
    } else if (sent > 0 && failed > 0) {
      showToast(`${sent} envoyée(s), ${failed} échouée(s)`, 'error')
    } else {
      showToast(`Aucune commande envoyée — ${failed} échec(s)`, 'error')
    }
  }, [confirmations, selectedIds, updateConfirmation, addActivityLog, currentUser, showToast])

  // ─── Copy single ───────────────────────────────────────────

  const handleCopy = useCallback(async (c: Confirmation) => {
    const text = formatSingleCopy(c, products)
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(c.id)
      showToast('Customer information copied.')
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      showToast('Failed to copy.', 'error')
    }
  }, [products, showToast])

  // ─── Copy batch ────────────────────────────────────────────

  const handleCopyBatch = useCallback(async (mode: 'ALL' | 'SELECTED' | 'TODAY') => {
    let source = filtered
    if (mode === 'SELECTED') {
      source = filtered.filter(c => selectedIds.has(c.id))
    } else if (mode === 'TODAY') {
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      source = filtered.filter(c => new Date(c.createdAt) >= todayStart)
    }
    if (source.length === 0) {
      showToast('No confirmations to copy.')
      return
    }
    const text = formatBatchCopy(source, products)
    try {
      await navigator.clipboard.writeText(text)
      showToast(`${source.length} confirmation(s) copied.`)
      setShowCopyMenu(false)
    } catch {
      showToast('Failed to copy.', 'error')
    }
  }, [filtered, selectedIds, products, showToast])

  // ─── Detail drawer ─────────────────────────────────────────

  const detailConfirmation = useMemo(
    () => detailDrawerId ? confirmations.find(c => c.id === detailDrawerId) || null : null,
    [detailDrawerId, confirmations]
  )

  // ─── Render ─────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed bottom-6 right-6 z-[100] px-4 py-3 rounded-xl border shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4',
          toast.type === 'success'
            ? 'bg-charcoal border-gold/20 shadow-gold/5'
            : 'bg-charcoal border-danger/30 shadow-danger/5'
        )}>
          {toast.type === 'success'
            ? <Check className="w-4 h-4 text-gold" />
            : <XCircle className="w-4 h-4 text-danger" />
          }
          <span className="text-sm text-text-primary">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <MessageSquareCheck className="w-7 h-7 text-gold" />
            Confirmation via Message
          </h1>
          <p className="text-sm text-text-muted mt-1">Organize and prepare confirmed COD orders in seconds.</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Confirmation
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="kpi-card">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-4 h-4 text-text-muted" />
            <span className="text-[11px] text-text-muted uppercase tracking-wider">Today</span>
          </div>
          <span className="text-2xl font-bold text-text-primary">{kpis.today}</span>
        </div>
        <div className="kpi-card">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-success" />
            <span className="text-[11px] text-text-muted uppercase tracking-wider">Confirmed</span>
          </div>
          <span className="text-2xl font-bold text-success">{kpis.confirmed}</span>
        </div>
        <div className="kpi-card">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-warning" />
            <span className="text-[11px] text-text-muted uppercase tracking-wider">Pending</span>
          </div>
          <span className="text-2xl font-bold text-warning">{kpis.pending}</span>
        </div>
        <div className="kpi-card">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="w-4 h-4 text-danger" />
            <span className="text-[11px] text-text-muted uppercase tracking-wider">Cancelled</span>
          </div>
          <span className="text-2xl font-bold text-danger">{kpis.cancelled}</span>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="glass-card p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              placeholder="Search by name, phone, wilaya, product, office, tracking..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="input-field pl-10 w-full"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap gap-2">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as MessageConfirmationStatus | 'ALL')}
              className="select-field text-sm"
            >
              <option value="ALL">All Status</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="PENDING">Pending</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            <select
              value={shippingFilter}
              onChange={e => setShippingFilter(e.target.value as 'ALL' | 'HOME' | 'OFFICE')}
              className="select-field text-sm"
            >
              <option value="ALL">All Shipping</option>
              <option value="HOME">Home</option>
              <option value="OFFICE">Office</option>
            </select>

            <select
              value={wilayaFilter}
              onChange={e => setWilayaFilter(e.target.value)}
              className="select-field text-sm"
            >
              <option value="ALL">All Wilayas</option>
              {uniqueWilayas.map(w => (
                <option key={w.code} value={w.code}>{w.code} — {w.name}</option>
              ))}
            </select>

            {uniqueTransporters.length > 0 && (
              <select
                value={transporterFilter}
                onChange={e => setTransporterFilter(e.target.value)}
                className="select-field text-sm"
              >
                <option value="ALL">All Transporters</option>
                {uniqueTransporters.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            )}

            <select
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value as typeof dateFilter)}
              className="select-field text-sm"
            >
              <option value="ALL">All Dates</option>
              <option value="TODAY">Today</option>
              <option value="YESTERDAY">Yesterday</option>
              <option value="7DAYS">Last 7 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded border-border bg-transparent text-gold accent-gold cursor-pointer"
            />
            <span className="text-xs text-text-muted">Select All ({filtered.length})</span>
          </label>

          {selectedIds.size > 0 && (
            <span className="text-xs text-gold">{selectedIds.size} selected</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Send Selected to E-com */}
          {selectedIds.size > 0 && (() => {
            const selectedConfirmed = confirmations.filter(c =>
              selectedIds.has(c.id) && c.status === 'CONFIRMED' && !c.ecomTracking
            )
            return selectedConfirmed.length > 0 ? (
              <button
                onClick={handleSendSelectedToEcom}
                disabled={sendingBatch}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                {sendingBatch ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {sendingBatch ? 'Envoi...' : `Envoyer à E-com (${selectedConfirmed.length})`}
              </button>
            ) : null
          })()}

        {/* Copy All Menu */}
        <div className="relative" ref={copyMenuRef}>
          <button
            onClick={() => setShowCopyMenu(!showCopyMenu)}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <Clipboard className="w-4 h-4" />
            Copy All
            <ChevronDown className="w-3 h-3" />
          </button>

          {showCopyMenu && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-charcoal border border-border rounded-xl shadow-2xl overflow-hidden z-50">
              <button
                onClick={() => handleCopyBatch('ALL')}
                className="w-full px-4 py-2.5 text-left text-sm text-text-primary hover:bg-white/[0.03] transition-colors"
              >
                Copy All ({filtered.length})
              </button>
              <button
                onClick={() => handleCopyBatch('SELECTED')}
                disabled={selectedIds.size === 0}
                className="w-full px-4 py-2.5 text-left text-sm text-text-primary hover:bg-white/[0.03] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Copy Selected ({selectedIds.size})
              </button>
              <button
                onClick={() => handleCopyBatch('TODAY')}
                className="w-full px-4 py-2.5 text-left text-sm text-text-primary hover:bg-white/[0.03] transition-colors"
              >
                Copy Today
              </button>
            </div>
          )}
        </div>

        </div>
      </div>

      {/* Table / Cards */}
      {filtered.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <MessageSquareCheck className="w-12 h-12 text-text-muted mx-auto mb-3 opacity-40" />
          <p className="text-text-primary font-medium">No confirmations yet</p>
          <p className="text-sm text-text-muted mt-1">Add your first confirmed customer to start organizing your COD orders.</p>
          <button onClick={openCreate} className="btn-primary mt-4 inline-flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Confirmation
          </button>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-[11px] text-text-muted uppercase tracking-wider font-medium w-10">#</th>
                    <th className="text-left px-4 py-3 text-[11px] text-text-muted uppercase tracking-wider font-medium">Customer</th>
                    <th className="text-left px-4 py-3 text-[11px] text-text-muted uppercase tracking-wider font-medium">Phone</th>
                    <th className="text-left px-4 py-3 text-[11px] text-text-muted uppercase tracking-wider font-medium">Wilaya</th>
                    <th className="text-left px-4 py-3 text-[11px] text-text-muted uppercase tracking-wider font-medium">Baladiya</th>
                    <th className="text-left px-4 py-3 text-[11px] text-text-muted uppercase tracking-wider font-medium">Delivery</th>
                    <th className="text-left px-4 py-3 text-[11px] text-text-muted uppercase tracking-wider font-medium">Office/Address</th>
                    <th className="text-left px-4 py-3 text-[11px] text-text-muted uppercase tracking-wider font-medium">Transporter</th>
                    <th className="text-right px-4 py-3 text-[11px] text-text-muted uppercase tracking-wider font-medium">Fee</th>
                    <th className="text-left px-4 py-3 text-[11px] text-text-muted uppercase tracking-wider font-medium">Product</th>
                    <th className="text-center px-4 py-3 text-[11px] text-text-muted uppercase tracking-wider font-medium">Qty</th>
                    <th className="text-left px-4 py-3 text-[11px] text-text-muted uppercase tracking-wider font-medium">Status</th>
                    <th className="text-left px-4 py-3 text-[11px] text-text-muted uppercase tracking-wider font-medium">E-com</th>
                    <th className="text-left px-4 py-3 text-[11px] text-text-muted uppercase tracking-wider font-medium">Date</th>
                    <th className="text-right px-4 py-3 text-[11px] text-text-muted uppercase tracking-wider font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => {
                    const productName = (() => {
                      const sp = sellingProducts.find(p => p.id === c.productId)
                      if (sp) return sp.name
                      return products.find(p => p.id === c.productId)?.name || '-'
                    })()
                    const sc = statusConfig[c.status]
                    const canSendEcom = c.status === 'CONFIRMED' && !c.ecomTracking
                    const isSending = sendingEcomId === c.id

                    return (
                      <tr key={c.id} className="border-b border-border hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(c.id)}
                            onChange={() => toggleSelect(c.id)}
                            className="w-4 h-4 rounded border-border bg-transparent text-gold accent-gold cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setDetailDrawerId(c.id)}
                            className="text-sm font-medium text-text-primary hover:text-gold transition-colors text-left"
                          >
                            {c.fullName}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-text-secondary font-mono">{c.phone}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-text-secondary">{c.wilayaCode} — {c.wilayaName}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-text-secondary">{c.baladiya}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full',
                            c.shippingMethod === 'HOME' ? 'bg-info/12 text-info' : 'bg-purple/12 text-purple'
                          )}>
                            {c.shippingMethod === 'HOME' ? <Home className="w-3 h-3" /> : <Building2 className="w-3 h-3" />}
                            {c.shippingMethod === 'HOME' ? 'Home' : 'Office'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-text-secondary truncate max-w-[140px] block">
                            {c.shippingMethod === 'HOME'
                              ? (c.address || '-')
                              : (c.officeName || '-')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-text-secondary">
                            {c.transporter || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm font-medium text-gold">
                            {c.deliveryPrice} DA
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-text-secondary truncate max-w-[120px] block">{productName}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm text-text-primary">{c.quantity}</span>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={c.status}
                            onChange={e => handleStatusChange(c.id, e.target.value as MessageConfirmationStatus)}
                            className={cn(
                              'text-xs px-2 py-1 rounded-full border-0 cursor-pointer font-medium',
                              sc.bgColor, sc.color
                            )}
                          >
                            <option value="CONFIRMED">Confirmed</option>
                            <option value="PENDING">Pending</option>
                            <option value="CANCELLED">Cancelled</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          {c.ecomTracking ? (
                            <EcomStatusBadge confirmation={c} />
                          ) : canSendEcom ? (
                            <button
                              onClick={() => handleSendToEcom(c)}
                              disabled={isSending}
                              className={cn(
                                'inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg font-medium transition-all',
                                isSending
                                  ? 'bg-gold/5 text-gold/50 cursor-not-allowed'
                                  : 'bg-gold/10 text-gold hover:bg-gold/20 cursor-pointer'
                              )}
                              title="Envoyer à E-com Delivery"
                            >
                              {isSending ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Envoi...
                                </>
                              ) : (
                                <>
                                  <Send className="w-3 h-3" />
                                  Envoyer
                                </>
                              )}
                            </button>
                          ) : (
                            <span className="text-text-muted">—</span>
                          )}
                          {ecomErrors[c.id] && (
                            <p className="text-[10px] text-danger mt-1 max-w-[100px]">{ecomErrors[c.id]}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-text-muted">
                            {new Date(c.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {c.ecomTracking && (
                              <button
                                onClick={() => setDetailDrawerId(c.id)}
                                className="p-1.5 rounded-lg text-text-muted hover:text-gold hover:bg-gold/10 transition-all"
                                title="Voir le suivi"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleCopy(c)}
                              className={cn(
                                'p-1.5 rounded-lg transition-all',
                                copiedId === c.id
                                  ? 'bg-success/12 text-success'
                                  : 'text-text-muted hover:text-gold hover:bg-gold/10'
                              )}
                              title="Copy"
                            >
                              {copiedId === c.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => openEdit(c)}
                              className="p-1.5 rounded-lg text-text-muted hover:text-info hover:bg-info/10 transition-all"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setShowDeleteConfirm(c.id)}
                              className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-all"
                              title="Archive"
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

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-3">
            {filtered.map(c => {
              const productName = (() => {
                const sp = sellingProducts.find(p => p.id === c.productId)
                if (sp) return sp.name
                return products.find(p => p.id === c.productId)?.name || '-'
              })()
              const sc = statusConfig[c.status]
              const StatusIcon = sc.icon
              const canSendEcom = c.status === 'CONFIRMED' && !c.ecomTracking
              const isSending = sendingEcomId === c.id

              return (
                <div key={c.id} className="glass-card p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(c.id)}
                        onChange={() => toggleSelect(c.id)}
                        className="w-4 h-4 rounded border-border bg-transparent text-gold accent-gold cursor-pointer mt-0.5"
                      />
                      <div>
                        <button
                          onClick={() => setDetailDrawerId(c.id)}
                          className="text-sm font-medium text-text-primary hover:text-gold transition-colors text-left"
                        >
                          {c.fullName}
                        </button>
                        <p className="text-xs text-text-muted font-mono">{c.phone}</p>
                      </div>
                    </div>
                    <span className={cn('inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium', sc.bgColor, sc.color)}>
                      <StatusIcon className="w-3 h-3" />
                      {sc.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-text-secondary">
                      <MapPin className="w-3 h-3 text-text-muted" />
                      {c.wilayaCode} — {c.wilayaName}, {c.baladiya}
                    </div>
                    <div className="flex items-center gap-1.5 text-text-secondary">
                      {c.shippingMethod === 'HOME' ? <Home className="w-3 h-3 text-info" /> : <Building2 className="w-3 h-3 text-purple" />}
                      {c.shippingMethod === 'HOME' ? 'Home' : 'Office'}
                    </div>
                    {c.shippingMethod === 'OFFICE' && c.officeName && (
                      <div className="flex items-center gap-1.5 text-text-secondary">
                        <Building2 className="w-3 h-3 text-text-muted" />
                        <span className="truncate">{c.officeName}</span>
                      </div>
                    )}
                    {c.shippingMethod === 'OFFICE' && c.transporter && (
                      <div className="flex items-center gap-1.5 text-text-secondary">
                        <Truck className="w-3 h-3 text-text-muted" />
                        {c.transporter}
                      </div>
                    )}
                    {c.shippingMethod === 'HOME' && c.address && (
                      <div className="col-span-2 flex items-center gap-1.5 text-text-secondary">
                        <MapPin className="w-3 h-3 text-text-muted" />
                        <span className="truncate">{c.address}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-text-secondary">
                      <Package className="w-3 h-3 text-text-muted" />
                      {productName} × {c.quantity}
                    </div>
                    <div className="flex items-center gap-1.5 text-gold font-medium">
                      {c.deliveryPrice} DA
                    </div>
                    <div className="text-text-muted">
                      {new Date(c.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  </div>

                  {/* E-com Status */}
                  {c.ecomTracking && (
                    <div className="p-2 rounded-lg bg-surface border border-gold/15">
                      <EcomStatusBadge confirmation={c} />
                    </div>
                  )}

                  {/* E-com Error */}
                  {ecomErrors[c.id] && (
                    <div className="p-2 rounded-lg bg-danger/8 border border-danger/20">
                      <p className="text-[11px] text-danger">{ecomErrors[c.id]}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1 border-t border-border">
                    {canSendEcom && (
                      <button
                        onClick={() => handleSendToEcom(c)}
                        disabled={isSending}
                        className={cn(
                          'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all',
                          isSending
                            ? 'bg-gold/5 text-gold/50 cursor-not-allowed'
                            : 'bg-gold/10 text-gold hover:bg-gold/20'
                        )}
                      >
                        {isSending ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Envoi en cours...
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            Envoyer à E-com
                          </>
                        )}
                      </button>
                    )}
                    {c.ecomTracking && (
                      <button
                        onClick={() => setDetailDrawerId(c.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium bg-gold/10 text-gold hover:bg-gold/20 transition-all"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Voir le suivi
                      </button>
                    )}
                    <button
                      onClick={() => handleCopy(c)}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all',
                        copiedId === c.id
                          ? 'bg-success/12 text-success'
                          : 'bg-gold/10 text-gold hover:bg-gold/20'
                      )}
                    >
                      {copiedId === c.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedId === c.id ? 'Copied' : 'Copy'}
                    </button>
                    <button
                      onClick={() => openEdit(c)}
                      className="p-2 rounded-lg text-text-muted hover:text-info hover:bg-info/10 transition-all"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(c.id)}
                      className="p-2 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-lg bg-charcoal border border-border rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-border bg-charcoal rounded-t-2xl">
              <h2 className="text-lg font-semibold text-text-primary">
                {editingId ? 'Edit Confirmation' : 'Add Confirmation'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg text-text-muted hover:text-text-secondary hover:bg-white/[0.05] transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Duplicate Warning */}
              {duplicateWarning && (
                <div className="flex items-start gap-3 p-3 rounded-xl bg-warning/8 border border-warning/20">
                  <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-warning">This customer already has a confirmation.</p>
                    <p className="text-xs text-text-muted mt-1">
                      {duplicateWarning.fullName} · {duplicateWarning.phone} · {new Date(duplicateWarning.createdAt).toLocaleDateString()}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => {
                          setShowModal(false)
                          setTimeout(() => openEdit(duplicateWarning), 50)
                        }}
                        className="text-xs px-3 py-1 rounded-lg bg-warning/15 text-warning hover:bg-warning/25 transition-colors"
                      >
                        Update Existing
                      </button>
                      <button
                        onClick={() => {
                          setForm(f => ({ ...f, phone: f.phone + ' ' }))
                          setErrors(e => ({ ...e, phone: undefined }))
                        }}
                        className="text-xs px-3 py-1 rounded-lg bg-white/5 text-text-muted hover:bg-white/10 transition-colors"
                      >
                        Create Anyway
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Customer Information */}
              <div>
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Customer Information</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-text-muted mb-1 block">Full Name *</label>
                    <input
                      type="text"
                      value={form.fullName}
                      onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                      placeholder="Full name"
                      className={cn('input-field w-full', errors.fullName && 'border-danger')}
                    />
                    {errors.fullName && <p className="text-[11px] text-danger mt-1">{errors.fullName}</p>}
                  </div>

                  <div>
                    <label className="text-xs text-text-muted mb-1 block">Phone Number *</label>
                    <input
                      ref={phoneInputRef}
                      type="tel"
                      value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder="05XXXXXXXX"
                      className={cn('input-field w-full', (errors.phone || phoneError) && 'border-danger')}
                    />
                    {(errors.phone || phoneError) && <p className="text-[11px] text-danger mt-1">{errors.phone || phoneError}</p>}
                  </div>
                </div>
              </div>

              {/* Location */}
              <div>
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Location</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-text-muted mb-1 block">Wilaya *</label>
                    <select
                      value={form.wilayaCode}
                      onChange={e => handleWilayaChange(e.target.value)}
                      className={cn('select-field w-full', errors.wilayaCode && 'border-danger')}
                    >
                      <option value="">Select wilaya</option>
                      {allWilayas.map(w => (
                        <option key={w.code} value={w.code}>{w.code} — {w.nameAr}</option>
                      ))}
                    </select>
                    {errors.wilayaCode && <p className="text-[11px] text-danger mt-1">{errors.wilayaCode}</p>}
                  </div>

                  <div>
                    <label className="text-xs text-text-muted mb-1 block">Baladiya *</label>
                    <select
                      value={form.baladiya}
                      onChange={e => setForm(f => ({ ...f, baladiya: e.target.value }))}
                      disabled={!form.wilayaCode}
                      className={cn('select-field w-full', errors.baladiya && 'border-danger')}
                    >
                      <option value="">Select baladiya</option>
                      {baladiyas.map(b => (
                        <option key={b.name} value={b.name}>{b.name}</option>
                      ))}
                    </select>
                    {errors.baladiya && <p className="text-[11px] text-danger mt-1">{errors.baladiya}</p>}
                  </div>
                </div>
              </div>

              {/* Shipping Method */}
              <div>
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Shipping Method *</h3>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleShippingMethodChange('HOME')}
                    className={cn(
                      'flex items-center justify-center gap-2 py-3 rounded-xl border transition-all text-sm font-medium',
                      form.shippingMethod === 'HOME'
                        ? 'border-gold bg-gold/10 text-gold'
                        : 'border-border bg-white/[0.02] text-text-muted hover:border-border-light'
                    )}
                  >
                    <Home className="w-4 h-4" />
                    Home
                  </button>
                  <button
                    type="button"
                    onClick={() => handleShippingMethodChange('OFFICE')}
                    className={cn(
                      'flex items-center justify-center gap-2 py-3 rounded-xl border transition-all text-sm font-medium',
                      form.shippingMethod === 'OFFICE'
                        ? 'border-gold bg-gold/10 text-gold'
                        : 'border-border bg-white/[0.02] text-text-muted hover:border-border-light'
                    )}
                  >
                    <Building2 className="w-4 h-4" />
                    Office
                  </button>
                </div>
              </div>

              {/* Address / Office */}
              {form.shippingMethod === 'HOME' ? (
                <div>
                  <label className="text-xs text-text-muted mb-1 block">Address</label>
                  <textarea
                    value={form.address}
                    onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                    placeholder="Street address, apartment, etc."
                    rows={2}
                    className="input-field w-full resize-none"
                  />
                </div>
              ) : (
                <div>
                  <label className="text-xs text-text-muted mb-1 block">Office *</label>
                  {offices.length === 0 ? (
                    <div className="p-3 rounded-xl bg-warning/8 border border-warning/20">
                      <p className="text-sm text-warning font-medium">No office available for this wilaya</p>
                      <p className="text-xs text-text-muted mt-1">
                        There are no registered offices in this wilaya. Consider switching to Home delivery.
                      </p>
                      <button
                        onClick={() => handleShippingMethodChange('HOME')}
                        className="mt-2 text-xs px-3 py-1 rounded-lg bg-warning/15 text-warning hover:bg-warning/25 transition-colors"
                      >
                        Switch to Home
                      </button>
                    </div>
                  ) : (
                    <select
                      value={form.officeRef}
                      onChange={e => setForm(f => ({ ...f, officeRef: e.target.value }))}
                      className={cn('select-field w-full', errors.officeRef && 'border-danger')}
                    >
                      <option value="">Select office</option>
                      {offices.map(o => (
                        <option key={o.code} value={o.code}>{o.code} — {o.lieu}</option>
                      ))}
                    </select>
                  )}
                  {errors.officeRef && <p className="text-[11px] text-danger mt-1">{errors.officeRef}</p>}

                  {/* Office Info Panel */}
                  {selectedOffice && (
                    <div className="mt-3 p-3 rounded-xl bg-surface border border-border">
                      <div className="flex items-center gap-2 mb-2">
                        <Building2 className="w-3.5 h-3.5 text-gold" />
                        <span className="text-xs font-semibold text-gold uppercase tracking-wider">Office Details</span>
                      </div>
                      <div className="grid grid-cols-1 gap-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-text-muted">Bureau</span>
                          <span className="text-text-primary font-mono font-semibold">{selectedOffice.code}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-muted">Localisation</span>
                          <span className="text-text-primary text-right max-w-[220px]">{selectedOffice.lieu}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-muted">Adresse</span>
                          <span className="text-text-primary text-right max-w-[220px]">{selectedOffice.adresse}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-muted">Téléphone</span>
                          <span className="text-text-primary font-mono">{selectedOffice.tel}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-muted">Opérateur</span>
                          <span className={cn('font-semibold', selectedOffice.transporteur === 'NOEST' ? 'text-blue' : 'text-purple')}>
                            {selectedOffice.transporteur}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Delivery Price */}
              <div className="p-3 rounded-xl bg-surface border border-border">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary">Delivery Fee</span>
                  {!deliveryInfo || !deliveryInfo.priceAvailable ? (
                    <span className="text-sm text-warning font-medium">Delivery price unavailable</span>
                  ) : (
                    <span className="text-lg font-bold text-gold">{liveDeliveryPrice} DA</span>
                  )}
                </div>
              </div>

              {/* Product */}
              <div>
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Product</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-text-muted mb-1 block">Product</label>
                    <select
                      value={form.productId}
                      onChange={e => setForm(f => ({ ...f, productId: e.target.value }))}
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
                </div>
                {selectedProductPrice > 0 && (
                  <div className="mt-3 p-3 rounded-xl bg-surface border border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-text-muted">Prix unitaire</span>
                      <span className="text-sm font-semibold text-gold">{selectedProductPrice.toLocaleString('fr-DZ')} DA</span>
                    </div>
                    {form.quantity > 1 && (
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-text-muted">Sous-total ({form.quantity} × {selectedProductPrice.toLocaleString('fr-DZ')} DA)</span>
                        <span className="text-sm font-semibold text-text-primary">{(selectedProductPrice * form.quantity).toLocaleString('fr-DZ')} DA</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs text-text-muted mb-1 block">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional notes..."
                  rows={2}
                  className="input-field w-full resize-none"
                />
              </div>

              {/* Live Summary Card */}
              {(form.fullName || form.phone) && (
                <div className="p-4 rounded-xl bg-surface border border-gold/20 space-y-2">
                  <h4 className="text-xs font-semibold text-gold uppercase tracking-wider mb-2">Summary</h4>
                  <div className="space-y-1.5 text-sm">
                    {form.fullName && (
                      <div className="flex justify-between">
                        <span className="text-text-muted">Client</span>
                        <span className="text-text-primary font-medium">{form.fullName}</span>
                      </div>
                    )}
                    {form.phone && (
                      <div className="flex justify-between">
                        <span className="text-text-muted">Phone</span>
                        <span className="text-text-primary font-mono">{form.phone}</span>
                      </div>
                    )}
                    {form.wilayaCode && selectedWilayaInfo && (
                      <div className="flex justify-between">
                        <span className="text-text-muted">Location</span>
                        <span className="text-text-primary">
                          {form.wilayaCode} — {selectedWilayaInfo.nameAr}{form.baladiya ? `, ${form.baladiya}` : ''}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-text-muted">Delivery</span>
                      <span className="text-text-primary">
                        {form.shippingMethod === 'HOME' ? 'Domicile' : 'Bureau'}
                      </span>
                    </div>
                    {form.shippingMethod === 'HOME' && form.address && (
                      <div className="flex justify-between">
                        <span className="text-text-muted">Address</span>
                        <span className="text-text-primary text-right max-w-[200px] truncate">{form.address}</span>
                      </div>
                    )}
                    {form.shippingMethod === 'OFFICE' && selectedOffice && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-text-muted">Bureau</span>
                          <span className="text-text-primary">{selectedOffice.code} — {selectedOffice.lieu}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-muted">Adresse</span>
                          <span className="text-text-primary text-right max-w-[200px] truncate">{selectedOffice.adresse}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-muted">Téléphone</span>
                          <span className="text-text-primary font-mono text-right max-w-[200px] truncate">{selectedOffice.tel}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-muted">Opérateur</span>
                          <span className={cn('font-semibold', selectedOffice.transporteur === 'NOEST' ? 'text-blue' : 'text-purple')}>{selectedOffice.transporteur}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between pt-1 border-t border-border">
                      <span className="text-text-muted">Delivery Fee</span>
                      {!deliveryInfo || !deliveryInfo.priceAvailable ? (
                        <span className="text-warning text-sm">Unavailable</span>
                      ) : (
                        <span className="text-gold font-bold">{liveDeliveryPrice} DA</span>
                      )}
                    </div>
                    {form.productId && (
                      <div className="flex justify-between">
                        <span className="text-text-muted">Product</span>
                        <span className="text-text-primary">
                          {(() => {
                            const sp = sellingProducts.find(p => p.id === form.productId)
                            if (sp) return sp.name
                            return products.find(p => p.id === form.productId)?.name || '-'
                          })()} × {form.quantity}
                        </span>
                      </div>
                    )}
                    {selectedProductPrice > 0 && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-text-muted">Prix unitaire</span>
                          <span className="text-text-primary">{selectedProductPrice.toLocaleString('fr-DZ')} DA</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-muted">Sous-total</span>
                          <span className="text-text-primary">{(selectedProductPrice * form.quantity).toLocaleString('fr-DZ')} DA</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between pt-1 border-t border-border">
                      <span className="text-text-secondary font-semibold">Total</span>
                      <span className="text-gold font-bold">{liveTotal.toLocaleString('fr-DZ')} DA</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-charcoal rounded-b-2xl">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button
                onClick={handleSubmit}
                disabled={!!phoneError && !!form.phone}
                className="btn-primary flex items-center gap-2"
              >
                {editingId ? 'Save Changes' : 'Add Confirmation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(null)} />
          <div className="relative w-full max-w-sm bg-charcoal border border-border rounded-2xl shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-danger/12 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-danger" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-text-primary">Archive Confirmation</h3>
                <p className="text-sm text-text-muted">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-text-secondary mb-6">
              Are you sure you want to remove this confirmation? The record will be permanently deleted.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setShowDeleteConfirm(null)} className="btn-secondary">Cancel</button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="px-4 py-2 rounded-xl bg-danger text-white text-sm font-medium hover:bg-danger/90 transition-colors"
              >
                Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      <DetailDrawer
        confirmation={detailConfirmation}
        onClose={() => setDetailDrawerId(null)}
        products={products}
      />
    </div>
  )
}
