import { useState, useMemo } from 'react'
import {
  Palette,
  Plus,
  Trophy,
  Video,
  Image as ImageIcon,
  LayoutGrid,
  List,
  Search,
  X,
  Pencil,
  Trash2,
  Eye,
  Filter,
  TrendingUp,
  MousePointerClick,
  DollarSign,
  ShoppingCart,
  BarChart3,
  Megaphone,
  FileText,
  Archive,
} from 'lucide-react'
import { useAppState } from '@/stores/AppState'
import { cn } from '@/lib/utils'
import type { Creative, CreativeStatus, CreativePlatform, CreativePerformance, ActivityAction } from '@/types'

const statusConfig: Record<CreativeStatus, { label: string; color: string; bgColor: string }> = {
  IDEA: { label: 'Idea', color: 'text-text-muted', bgColor: 'bg-text-muted/15' },
  IN_PRODUCTION: { label: 'In Production', color: 'text-info', bgColor: 'bg-info/12' },
  READY: { label: 'Ready', color: 'text-purple', bgColor: 'bg-purple/12' },
  TESTING: { label: 'Testing', color: 'text-warning', bgColor: 'bg-warning/12' },
  WINNER: { label: 'Winner', color: 'text-gold', bgColor: 'bg-gold/12' },
  ARCHIVED: { label: 'Archived', color: 'text-text-muted', bgColor: 'bg-text-muted/15' },
}

const platformConfig: Record<CreativePlatform, { label: string; color: string; bgColor: string }> = {
  META: { label: 'Meta', color: 'text-info', bgColor: 'bg-info/12' },
  TIKTOK: { label: 'TikTok', color: 'text-danger', bgColor: 'bg-danger/12' },
  OTHER: { label: 'Other', color: 'text-text-muted', bgColor: 'bg-text-muted/15' },
}

const typeConfig: Record<string, { label: string; icon: typeof Video }> = {
  image: { label: 'Image', icon: ImageIcon },
  video: { label: 'Video', icon: Video },
  carousel: { label: 'Carousel', icon: FileText },
}

interface CreativeFormData {
  name: string
  productId: string
  platform: CreativePlatform
  type: 'image' | 'video' | 'carousel'
  status: CreativeStatus
  hook: string
  angle: string
  script: string
  notes: string
}

const emptyForm: CreativeFormData = {
  name: '',
  productId: '',
  platform: 'META',
  type: 'video',
  status: 'IDEA',
  hook: '',
  angle: '',
  script: '',
  notes: '',
}

interface PerformanceFormData {
  impressions: string
  clicks: string
  orders: string
  revenue: string
}

const emptyPerformance: PerformanceFormData = {
  impressions: '',
  clicks: '',
  orders: '',
  revenue: '',
}

function calculatePerformance(data: PerformanceFormData): CreativePerformance {
  const impressions = Number(data.impressions) || 0
  const clicks = Number(data.clicks) || 0
  const orders = Number(data.orders) || 0
  const revenue = Number(data.revenue) || 0
  const ctr = impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0
  const cpc = clicks > 0 ? Number((revenue / clicks).toFixed(2)) : 0
  const cpa = orders > 0 ? Number((revenue / orders).toFixed(2)) : 0
  const roas = revenue > 0 ? Number((revenue / revenue).toFixed(2)) : 0
  return { impressions, clicks, ctr, cpc, cpa, roas, orders, revenue }
}

function generateId(): string {
  return `creative-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function CreativeLab() {
  const {
    creatives,
    addCreative,
    updateCreative,
    deleteCreative,
    products,
    currentUser,
    addActivityLog,
    addNotification,
  } = useAppState()

  const [filterStatus, setFilterStatus] = useState<CreativeStatus | 'ALL'>('ALL')
  const [filterPlatform, setFilterPlatform] = useState<CreativePlatform | 'ALL'>('ALL')
  const [filterProduct, setFilterProduct] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingCreative, setEditingCreative] = useState<Creative | null>(null)
  const [formData, setFormData] = useState<CreativeFormData>(emptyForm)

  const [performanceModalCreative, setPerformanceModalCreative] = useState<Creative | null>(null)
  const [perfData, setPerfData] = useState<PerformanceFormData>(emptyPerformance)

  const [detailCreative, setDetailCreative] = useState<Creative | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const getProductById = (id: string) => products.find(p => p.id === id)

  const filteredCreatives = useMemo(() => {
    return creatives.filter(c => {
      if (filterStatus !== 'ALL' && c.status !== filterStatus) return false
      if (filterPlatform !== 'ALL' && c.platform !== filterPlatform) return false
      if (filterProduct !== 'ALL' && c.productId !== filterProduct) return false
      if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
      return true
    })
  }, [creatives, filterStatus, filterPlatform, filterProduct, searchQuery])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: creatives.length }
    Object.keys(statusConfig).forEach(s => {
      counts[s] = creatives.filter(c => c.status === s).length
    })
    return counts
  }, [creatives])

  function openCreateModal() {
    setFormData(emptyForm)
    setEditingCreative(null)
    setShowCreateModal(true)
  }

  function openEditModal(creative: Creative) {
    setFormData({
      name: creative.name,
      productId: creative.productId,
      platform: creative.platform,
      type: creative.type,
      status: creative.status,
      hook: creative.hook || '',
      angle: creative.angle || '',
      script: creative.script || '',
      notes: creative.notes || '',
    })
    setEditingCreative(creative)
    setShowCreateModal(true)
  }

  function handleSaveCreative() {
    if (!formData.name.trim()) return
    const now = new Date()

    if (editingCreative) {
      const updated: Creative = {
        ...editingCreative,
        ...formData,
        hook: formData.hook || undefined,
        angle: formData.angle || undefined,
        script: formData.script || undefined,
        notes: formData.notes || undefined,
        updatedAt: now,
      }
      updateCreative(updated)
      addActivityLog({
        id: generateId(),
        userId: currentUser?.id || '',
        action: 'PRODUCT_UPDATED' as ActivityAction,
        entityType: 'CREATIVE',
        entityId: updated.id,
        entityName: updated.name,
        createdAt: now,
      })
    } else {
      const newCreative: Creative = {
        id: generateId(),
        ...formData,
        hook: formData.hook || undefined,
        angle: formData.angle || undefined,
        script: formData.script || undefined,
        notes: formData.notes || undefined,
        isWinner: false,
        createdBy: currentUser?.id || '',
        createdAt: now,
        updatedAt: now,
      }
      addCreative(newCreative)
      addActivityLog({
        id: generateId(),
        userId: currentUser?.id || '',
        action: 'CREATIVE_ADDED',
        entityType: 'CREATIVE',
        entityId: newCreative.id,
        entityName: newCreative.name,
        createdAt: now,
      })
    }
    setShowCreateModal(false)
    setEditingCreative(null)
    setFormData(emptyForm)
  }

  function handleDeleteCreative(id: string) {
    const creative = creatives.find(c => c.id === id)
    deleteCreative(id)
    setConfirmDelete(null)
    if (creative) {
      addActivityLog({
        id: generateId(),
        userId: currentUser?.id || '',
        action: 'PRODUCT_UPDATED' as ActivityAction,
        entityType: 'CREATIVE',
        entityId: id,
        entityName: creative.name,
        createdAt: new Date(),
      })
    }
  }

  function handleArchiveCreative(creative: Creative) {
    const updated: Creative = {
      ...creative,
      status: 'ARCHIVED' as CreativeStatus,
      updatedAt: new Date(),
    }
    updateCreative(updated)
    addActivityLog({
      id: generateId(),
      userId: currentUser?.id || '',
      action: 'STATUS_CHANGED',
      entityType: 'CREATIVE',
      entityId: creative.id,
      entityName: creative.name,
      createdAt: new Date(),
    })
  }

  function handleMarkWinner(creative: Creative) {
    const updated: Creative = {
      ...creative,
      isWinner: !creative.isWinner,
      status: !creative.isWinner ? 'WINNER' : 'TESTING',
      updatedAt: new Date(),
    }
    updateCreative(updated)
    if (!creative.isWinner) {
      addNotification({
        id: generateId(),
        userId: currentUser?.id || '',
        type: 'CREATIVE_WINNER',
        title: 'New Winner Creative!',
        message: `"${creative.name}" has been marked as a winner!`,
        isRead: false,
        createdAt: new Date(),
      })
      addActivityLog({
        id: generateId(),
        userId: currentUser?.id || '',
        action: 'CREATIVE_WINNER',
        entityType: 'CREATIVE',
        entityId: creative.id,
        entityName: creative.name,
        createdAt: new Date(),
      })
    } else {
      addActivityLog({
        id: generateId(),
        userId: currentUser?.id || '',
        action: 'STATUS_CHANGED',
        entityType: 'CREATIVE',
        entityId: creative.id,
        entityName: creative.name,
        createdAt: new Date(),
      })
    }
  }

  function openPerformanceModal(creative: Creative) {
    setPerformanceModalCreative(creative)
    setPerfData({
      impressions: creative.performance?.impressions?.toString() || '',
      clicks: creative.performance?.clicks?.toString() || '',
      orders: creative.performance?.orders?.toString() || '',
      revenue: creative.performance?.revenue?.toString() || '',
    })
  }

  function handleSavePerformance() {
    if (!performanceModalCreative) return
    const performance = calculatePerformance(perfData)
    const updated: Creative = {
      ...performanceModalCreative,
      performance,
      updatedAt: new Date(),
    }
    updateCreative(updated)
    setPerformanceModalCreative(null)
    setPerfData(emptyPerformance)
  }

  function renderPerformanceStats(perf?: CreativePerformance) {
    if (!perf) return null
    return (
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border">
        <div>
          <p className="text-[10px] text-text-muted uppercase">CTR</p>
          <p className="text-xs font-semibold">{perf.ctr}%</p>
        </div>
        <div>
          <p className="text-[10px] text-text-muted uppercase">CPA</p>
          <p className="text-xs font-semibold">{perf.cpa.toLocaleString()} DA</p>
        </div>
        <div>
          <p className="text-[10px] text-text-muted uppercase">ROAS</p>
          <p className={cn('text-xs font-semibold', perf.roas >= 2 ? 'text-success' : perf.roas >= 1 ? 'text-warning' : 'text-danger')}>
            {perf.roas}x
          </p>
        </div>
        <div>
          <p className="text-[10px] text-text-muted uppercase">Orders</p>
          <p className="text-xs font-semibold">{perf.orders.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[10px] text-text-muted uppercase">Revenue</p>
          <p className="text-xs font-semibold text-gold">{perf.revenue.toLocaleString()} DA</p>
        </div>
        <div>
          <p className="text-[10px] text-text-muted uppercase">CPC</p>
          <p className="text-xs font-semibold">{perf.cpc.toLocaleString()} DA</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Palette className="w-6 h-6 text-gold" />
            Creative Lab
          </h1>
          <p className="text-sm text-text-muted mt-1">Manage ad creatives and track performance.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white/[0.03] border border-border rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={cn('p-2 rounded-md transition-colors', viewMode === 'grid' ? 'bg-gold/15 text-gold' : 'text-text-muted hover:text-text-secondary')}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn('p-2 rounded-md transition-colors', viewMode === 'list' ? 'bg-gold/15 text-gold' : 'text-text-muted hover:text-text-secondary')}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          <button onClick={openCreateModal} className="btn-primary">
            <Plus className="w-4 h-4" />
            New Creative
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="glass-card p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search creatives by name..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input-field pl-10 w-full"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-xs text-text-muted">Status:</span>
            <div className="flex gap-1">
              <button
                onClick={() => setFilterStatus('ALL')}
                className={cn(
                  'px-2.5 py-1 rounded-md text-[11px] font-medium transition-all',
                  filterStatus === 'ALL' ? 'bg-gold/15 text-gold border border-gold/20' : 'bg-white/[0.03] text-text-muted border border-border hover:border-text-muted/30'
                )}
              >
                All ({statusCounts.ALL})
              </button>
              {(Object.keys(statusConfig) as CreativeStatus[]).map(status => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-[11px] font-medium transition-all',
                    filterStatus === status ? 'bg-gold/15 text-gold border border-gold/20' : 'bg-white/[0.03] text-text-muted border border-border hover:border-text-muted/30'
                  )}
                >
                  {statusConfig[status].label} ({statusCounts[status]})
                </button>
              ))}
            </div>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Platform:</span>
            <select
              value={filterPlatform}
              onChange={e => setFilterPlatform(e.target.value as CreativePlatform | 'ALL')}
              className="select-field text-xs py-1"
            >
              <option value="ALL">All Platforms</option>
              {(Object.keys(platformConfig) as CreativePlatform[]).map(p => (
                <option key={p} value={p}>{platformConfig[p].label}</option>
              ))}
            </select>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Product:</span>
            <select
              value={filterProduct}
              onChange={e => setFilterProduct(e.target.value)}
              className="select-field text-xs py-1"
            >
              <option value="ALL">All Products</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Creatives', value: creatives.length, icon: Palette },
          { label: 'Winners', value: creatives.filter(c => c.isWinner).length, icon: Trophy, color: 'text-gold' },
          { label: 'In Testing', value: creatives.filter(c => c.status === 'TESTING').length, icon: Eye, color: 'text-warning' },
          { label: 'Avg ROAS', value: creatives.filter(c => c.performance).length > 0
            ? (creatives.filter(c => c.performance).reduce((acc, c) => acc + (c.performance?.roas || 0), 0) / creatives.filter(c => c.performance).length).toFixed(1) + 'x'
            : '-',
            icon: TrendingUp,
            color: 'text-success'
          },
        ].map((stat, i) => (
          <div key={i} className="glass-card p-4 flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center bg-white/[0.03]', stat.color || 'text-text-muted')}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-text-muted uppercase">{stat.label}</p>
              <p className="text-lg font-bold text-text-primary">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Creatives */}
      {filteredCreatives.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Palette className="w-6 h-6" />
          </div>
          <p className="text-sm text-text-muted">
            {searchQuery || filterStatus !== 'ALL' || filterPlatform !== 'ALL' || filterProduct !== 'ALL'
              ? 'No creatives match your filters.'
              : 'No creatives yet. Create your first one!'}
          </p>
          {!searchQuery && filterStatus === 'ALL' && filterPlatform === 'ALL' && filterProduct === 'ALL' && (
            <button onClick={openCreateModal} className="btn-primary mt-2">
              <Plus className="w-4 h-4" />
              New Creative
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCreatives.map(creative => {
            const product = getProductById(creative.productId)
            const status = statusConfig[creative.status]
            const platform = platformConfig[creative.platform]
            const TypeIcon = typeConfig[creative.type]?.icon || ImageIcon
            return (
              <div
                key={creative.id}
                className={cn(
                  'glass-card overflow-hidden group transition-all duration-300 cursor-pointer',
                  creative.isWinner && 'border-gold/40 shadow-[0_0_20px_rgba(212,175,55,0.15)] hover:shadow-[0_0_30px_rgba(212,175,55,0.25)]'
                )}
                onClick={() => setDetailCreative(creative)}
              >
                {/* Thumbnail */}
                <div className={cn(
                  'aspect-video border-b border-border flex items-center justify-center relative',
                  creative.isWinner ? 'bg-gradient-to-br from-gold/5 to-gold/[0.02]' : 'bg-white/[0.03]'
                )}>
                  {creative.thumbnailUrl ? (
                    <img src={creative.thumbnailUrl} alt={creative.name} className="w-full h-full object-cover" />
                  ) : (
                    <TypeIcon className="w-10 h-10 text-text-muted" />
                  )}
                  <div className="absolute top-3 left-3 flex gap-1.5">
                    <span className={cn('badge text-[9px]', status.bgColor, status.color)}>
                      {status.label}
                    </span>
                  </div>
                  {creative.isWinner && (
                    <div className="absolute top-3 right-3 badge bg-gold/20 text-gold border border-gold/30">
                      <Trophy className="w-3 h-3 mr-1" />
                      Winner
                    </div>
                  )}
                  <div className="absolute bottom-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={e => { e.stopPropagation(); openEditModal(creative); }}
                      className="p-1.5 rounded-md bg-surface/90 border border-border hover:bg-surface text-text-muted hover:text-text-primary transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); openPerformanceModal(creative); }}
                      className="p-1.5 rounded-md bg-surface/90 border border-border hover:bg-surface text-text-muted hover:text-text-primary transition-colors"
                    >
                      <BarChart3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleMarkWinner(creative); }}
                      className={cn(
                        'p-1.5 rounded-md bg-surface/90 border border-border hover:bg-surface transition-colors',
                        creative.isWinner ? 'text-gold hover:text-gold' : 'text-text-muted hover:text-gold'
                      )}
                    >
                      <Trophy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleArchiveCreative(creative); }}
                      className="p-1.5 rounded-md bg-surface/90 border border-border hover:bg-surface text-text-muted hover:text-text-secondary transition-colors"
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setConfirmDelete(creative.id); }}
                      className="p-1.5 rounded-md bg-surface/90 border border-border hover:bg-surface text-text-muted hover:text-danger transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Info */}
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn('badge text-[9px]', platform.bgColor, platform.color)}>
                      {platform.label}
                    </span>
                    <span className="badge text-[9px] bg-white/5 text-text-muted">
                      {typeConfig[creative.type]?.label}
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-text-primary mb-1 line-clamp-1">{creative.name}</h3>
                  {creative.hook && (
                    <p className="text-xs text-text-muted mb-2 line-clamp-2 italic">"{creative.hook}"</p>
                  )}
                  {product && (
                    <div className="flex items-center gap-1.5 mb-3">
                      <Megaphone className="w-3 h-3 text-gold" />
                      <p className="text-[11px] text-gold font-medium">{product.name}</p>
                    </div>
                  )}

                  {renderPerformanceStats(creative.performance)}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Creative</th>
                <th>Product</th>
                <th>Platform</th>
                <th>Type</th>
                <th>Status</th>
                <th>CTR</th>
                <th>CPA</th>
                <th>ROAS</th>
                <th>Orders</th>
                <th>Winner</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCreatives.map(creative => {
                const product = getProductById(creative.productId)
                const status = statusConfig[creative.status]
                const platform = platformConfig[creative.platform]
                return (
                  <tr key={creative.id} className={cn(creative.isWinner && 'bg-gold/[0.03]')}>
                    <td>
                      <div className="flex items-center gap-2">
                        {creative.isWinner && <Trophy className="w-3.5 h-3.5 text-gold flex-shrink-0" />}
                        <div>
                          <span className="font-medium text-text-primary">{creative.name}</span>
                          {creative.hook && (
                            <p className="text-[11px] text-text-muted truncate max-w-[200px]">"{creative.hook}"</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="text-xs text-gold">{product?.name || '-'}</span>
                    </td>
                    <td>
                      <span className={cn('badge text-[9px]', platform.bgColor, platform.color)}>
                        {platform.label}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs text-text-muted">{typeConfig[creative.type]?.label}</span>
                    </td>
                    <td>
                      <span className={cn('badge text-[9px]', status.bgColor, status.color)}>
                        {status.label}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs">{creative.performance?.ctr ?? '-'}</span>
                    </td>
                    <td>
                      <span className="text-xs">{creative.performance?.cpa?.toLocaleString() ?? '-'} DA</span>
                    </td>
                    <td>
                      <span className={cn(
                        'text-xs font-semibold',
                        (creative.performance?.roas ?? 0) >= 2 ? 'text-success' : (creative.performance?.roas ?? 0) >= 1 ? 'text-warning' : 'text-danger'
                      )}>
                        {creative.performance?.roas ?? '-'}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs">{creative.performance?.orders?.toLocaleString() ?? '-'}</span>
                    </td>
                    <td>
                      {creative.isWinner && <Trophy className="w-4 h-4 text-gold" />}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditModal(creative)}
                          className="p-1.5 rounded-md hover:bg-white/[0.05] text-text-muted hover:text-text-primary transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openPerformanceModal(creative)}
                          className="p-1.5 rounded-md hover:bg-white/[0.05] text-text-muted hover:text-text-primary transition-colors"
                        >
                          <BarChart3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleMarkWinner(creative)}
                          className={cn(
                            'p-1.5 rounded-md hover:bg-white/[0.05] transition-colors',
                            creative.isWinner ? 'text-gold' : 'text-text-muted hover:text-gold'
                          )}
                        >
                          <Trophy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleArchiveCreative(creative)}
                          className="p-1.5 rounded-md hover:bg-white/[0.05] text-text-muted hover:text-text-secondary transition-colors"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(creative.id)}
                          className="p-1.5 rounded-md hover:bg-white/[0.05] text-text-muted hover:text-danger transition-colors"
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

      {/* Create / Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateModal(false)}>
          <div className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-bold text-text-primary">
                {editingCreative ? 'Edit Creative' : 'New Creative'}
              </h2>
              <button onClick={() => setShowCreateModal(false)} className="text-text-muted hover:text-text-primary transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-medium text-text-secondary mb-1.5 block">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Creative name..."
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1.5 block">Product *</label>
                  <select
                    value={formData.productId}
                    onChange={e => setFormData(prev => ({ ...prev, productId: e.target.value }))}
                    className="select-field w-full"
                  >
                    <option value="">Select product...</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1.5 block">Platform</label>
                  <select
                    value={formData.platform}
                    onChange={e => setFormData(prev => ({ ...prev, platform: e.target.value as CreativePlatform }))}
                    className="select-field w-full"
                  >
                    {(Object.keys(platformConfig) as CreativePlatform[]).map(p => (
                      <option key={p} value={p}>{platformConfig[p].label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1.5 block">Type</label>
                  <select
                    value={formData.type}
                    onChange={e => setFormData(prev => ({ ...prev, type: e.target.value as 'image' | 'video' | 'carousel' }))}
                    className="select-field w-full"
                  >
                    <option value="image">Image</option>
                    <option value="video">Video</option>
                    <option value="carousel">Carousel</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1.5 block">Status</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData(prev => ({ ...prev, status: e.target.value as CreativeStatus }))}
                    className="select-field w-full"
                  >
                    {(Object.keys(statusConfig) as CreativeStatus[]).map(s => (
                      <option key={s} value={s}>{statusConfig[s].label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-text-secondary mb-1.5 block">Hook</label>
                  <input
                    type="text"
                    value={formData.hook}
                    onChange={e => setFormData(prev => ({ ...prev, hook: e.target.value }))}
                    placeholder="Attention-grabbing hook..."
                    className="input-field w-full"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-text-secondary mb-1.5 block">Angle</label>
                  <input
                    type="text"
                    value={formData.angle}
                    onChange={e => setFormData(prev => ({ ...prev, angle: e.target.value }))}
                    placeholder="Creative angle / approach..."
                    className="input-field w-full"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-text-secondary mb-1.5 block">Script</label>
                  <textarea
                    value={formData.script}
                    onChange={e => setFormData(prev => ({ ...prev, script: e.target.value }))}
                    placeholder="Full script or storyboard..."
                    rows={4}
                    className="textarea-field w-full"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-text-secondary mb-1.5 block">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Additional notes..."
                    rows={2}
                    className="textarea-field w-full"
                  />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-border flex items-center justify-end gap-3">
              <button onClick={() => setShowCreateModal(false)} className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={handleSaveCreative}
                disabled={!formData.name.trim() || !formData.productId}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingCreative ? 'Save Changes' : 'Create Creative'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Performance Modal */}
      {performanceModalCreative && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setPerformanceModalCreative(null)}>
          <div className="glass-card w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-text-primary">Update Performance</h2>
                <p className="text-xs text-text-muted mt-1">{performanceModalCreative.name}</p>
              </div>
              <button onClick={() => setPerformanceModalCreative(null)} className="text-text-muted hover:text-text-primary transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1.5 block">Impressions</label>
                  <input
                    type="number"
                    value={perfData.impressions}
                    onChange={e => setPerfData(prev => ({ ...prev, impressions: e.target.value }))}
                    placeholder="0"
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1.5 block">Clicks</label>
                  <input
                    type="number"
                    value={perfData.clicks}
                    onChange={e => setPerfData(prev => ({ ...prev, clicks: e.target.value }))}
                    placeholder="0"
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1.5 block">Orders</label>
                  <input
                    type="number"
                    value={perfData.orders}
                    onChange={e => setPerfData(prev => ({ ...prev, orders: e.target.value }))}
                    placeholder="0"
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-text-secondary mb-1.5 block">Revenue (DA)</label>
                  <input
                    type="number"
                    value={perfData.revenue}
                    onChange={e => setPerfData(prev => ({ ...prev, revenue: e.target.value }))}
                    placeholder="0"
                    className="input-field w-full"
                  />
                </div>
              </div>
              {/* Auto-calculated preview */}
              <div className="glass-card p-4 bg-white/[0.02]">
                <p className="text-[11px] text-text-muted uppercase mb-3">Auto-Calculated Metrics</p>
                <div className="grid grid-cols-3 gap-3">
                  {(() => {
                    const perf = calculatePerformance(perfData)
                    return (
                      <>
                        <div>
                          <p className="text-[10px] text-text-muted">CTR</p>
                          <p className="text-sm font-semibold text-text-primary">{perf.ctr}%</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-text-muted">CPC</p>
                          <p className="text-sm font-semibold text-text-primary">{perf.cpc.toLocaleString()} DA</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-text-muted">CPA</p>
                          <p className="text-sm font-semibold text-text-primary">{perf.cpa.toLocaleString()} DA</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-text-muted">ROAS</p>
                          <p className={cn(
                            'text-sm font-semibold',
                            perf.roas >= 2 ? 'text-success' : perf.roas >= 1 ? 'text-warning' : 'text-danger'
                          )}>
                            {perf.roas}x
                          </p>
                        </div>
                      </>
                    )
                  })()}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-border flex items-center justify-end gap-3">
              <button onClick={() => setPerformanceModalCreative(null)} className="btn-secondary">
                Cancel
              </button>
              <button onClick={handleSavePerformance} className="btn-primary">
                Save Performance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailCreative && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setDetailCreative(null)}>
          <div className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                {detailCreative.isWinner && <Trophy className="w-5 h-5 text-gold" />}
                <div>
                  <h2 className="text-lg font-bold text-text-primary">{detailCreative.name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn('badge text-[9px]', statusConfig[detailCreative.status].bgColor, statusConfig[detailCreative.status].color)}>
                      {statusConfig[detailCreative.status].label}
                    </span>
                    <span className={cn('badge text-[9px]', platformConfig[detailCreative.platform].bgColor, platformConfig[detailCreative.platform].color)}>
                      {platformConfig[detailCreative.platform].label}
                    </span>
                    <span className="badge text-[9px] bg-white/5 text-text-muted">
                      {typeConfig[detailCreative.type]?.label}
                    </span>
                  </div>
                </div>
              </div>
              <button onClick={() => setDetailCreative(null)} className="text-text-muted hover:text-text-primary transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {(() => {
                const product = getProductById(detailCreative.productId)
                return product ? (
                  <div className="flex items-center gap-2">
                    <Megaphone className="w-4 h-4 text-gold" />
                    <span className="text-sm text-gold font-medium">{product.name}</span>
                  </div>
                ) : null
              })()}

              {detailCreative.hook && (
                <div>
                  <p className="text-[11px] text-text-muted uppercase mb-1">Hook</p>
                  <p className="text-sm text-text-primary italic">"{detailCreative.hook}"</p>
                </div>
              )}
              {detailCreative.angle && (
                <div>
                  <p className="text-[11px] text-text-muted uppercase mb-1">Angle</p>
                  <p className="text-sm text-text-primary">{detailCreative.angle}</p>
                </div>
              )}
              {detailCreative.script && (
                <div>
                  <p className="text-[11px] text-text-muted uppercase mb-1">Script</p>
                  <p className="text-sm text-text-primary whitespace-pre-wrap">{detailCreative.script}</p>
                </div>
              )}
              {detailCreative.notes && (
                <div>
                  <p className="text-[11px] text-text-muted uppercase mb-1">Notes</p>
                  <p className="text-sm text-text-secondary">{detailCreative.notes}</p>
                </div>
              )}

              {detailCreative.performance && (
                <div>
                  <p className="text-[11px] text-text-muted uppercase mb-3">Performance Metrics</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="glass-card p-3 text-center">
                      <MousePointerClick className="w-4 h-4 text-text-muted mx-auto mb-1" />
                      <p className="text-lg font-bold text-text-primary">{detailCreative.performance.ctr}%</p>
                      <p className="text-[10px] text-text-muted">CTR</p>
                    </div>
                    <div className="glass-card p-3 text-center">
                      <DollarSign className="w-4 h-4 text-text-muted mx-auto mb-1" />
                      <p className="text-lg font-bold text-text-primary">{detailCreative.performance.cpc.toLocaleString()}</p>
                      <p className="text-[10px] text-text-muted">CPC (DA)</p>
                    </div>
                    <div className="glass-card p-3 text-center">
                      <TrendingUp className="w-4 h-4 text-text-muted mx-auto mb-1" />
                      <p className={cn(
                        'text-lg font-bold',
                        detailCreative.performance.roas >= 2 ? 'text-success' : detailCreative.performance.roas >= 1 ? 'text-warning' : 'text-danger'
                      )}>
                        {detailCreative.performance.roas}x
                      </p>
                      <p className="text-[10px] text-text-muted">ROAS</p>
                    </div>
                    <div className="glass-card p-3 text-center">
                      <ShoppingCart className="w-4 h-4 text-text-muted mx-auto mb-1" />
                      <p className="text-lg font-bold text-text-primary">{detailCreative.performance.orders.toLocaleString()}</p>
                      <p className="text-[10px] text-text-muted">Orders</p>
                    </div>
                    <div className="glass-card p-3 text-center">
                      <DollarSign className="w-4 h-4 text-gold mx-auto mb-1" />
                      <p className="text-lg font-bold text-gold">{detailCreative.performance.revenue.toLocaleString()}</p>
                      <p className="text-[10px] text-text-muted">Revenue (DA)</p>
                    </div>
                    <div className="glass-card p-3 text-center">
                      <BarChart3 className="w-4 h-4 text-text-muted mx-auto mb-1" />
                      <p className="text-lg font-bold text-text-primary">{detailCreative.performance.cpa.toLocaleString()}</p>
                      <p className="text-[10px] text-text-muted">CPA (DA)</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-4 text-[11px] text-text-muted">
                <span>Created: {new Date(detailCreative.createdAt).toLocaleDateString()}</span>
                <span>Updated: {new Date(detailCreative.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="p-6 border-t border-border flex items-center justify-end gap-3">
              <button onClick={() => { setDetailCreative(null); openPerformanceModal(detailCreative); }} className="btn-secondary">
                <BarChart3 className="w-4 h-4" />
                Update Performance
              </button>
              <button onClick={() => { setDetailCreative(null); openEditModal(detailCreative); }} className="btn-primary">
                <Pencil className="w-4 h-4" />
                Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDelete(null)}>
          <div className="glass-card w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-danger/12 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-danger" />
              </div>
              <h3 className="text-lg font-bold text-text-primary mb-2">Delete Creative?</h3>
              <p className="text-sm text-text-muted mb-6">This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDelete(null)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button onClick={() => handleDeleteCreative(confirmDelete)} className="btn-primary bg-danger/90 hover:bg-danger flex-1">
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
