import { useState, useEffect, useCallback } from 'react'
import {
  FileText, Plus, Trash2, X, GripVertical, Eye, Sparkles,
  ChevronDown, ChevronUp, Globe, Palette,
  Image as ImageIcon, Languages, DollarSign, Shield,
  ChevronRight, Loader2, AlertCircle, Check,
  Settings2, Layers,
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type {
  LandingPage, LandingPageSection, LandingPageLanguage,
  LandingPageVisualStyle, LandingPageSectionType, GenerationStatus,
  LandingPagePaymentMethod, TextLayer,
} from '@/types'

// ─── Constants ──────────────────────────────────────────────

const LANGUAGES: { value: LandingPageLanguage; label: string; dir: 'ltr' | 'rtl' }[] = [
  { value: 'darija', label: 'Algerian Darija', dir: 'rtl' },
  { value: 'arabic', label: 'Arabic', dir: 'rtl' },
  { value: 'french', label: 'French', dir: 'ltr' },
  { value: 'english', label: 'English', dir: 'ltr' },
]

const VISUAL_STYLES: { value: LandingPageVisualStyle; label: string; desc: string }[] = [
  { value: 'luxury', label: 'Luxury', desc: 'Premium dark + gold' },
  { value: 'premium', label: 'Premium', desc: 'Sophisticated modern' },
  { value: 'minimal', label: 'Minimal', desc: 'Clean, simple' },
  { value: 'modern_tech', label: 'Modern Tech', desc: 'Futuristic, sleek' },
  { value: 'clean', label: 'Clean E-commerce', desc: 'Professional, white' },
  { value: 'dark_gold', label: 'Dark / Gold', desc: 'Dark luxury' },
  { value: 'ugc', label: 'UGC-Inspired', desc: 'Authentic, real' },
  { value: 'cinematic', label: 'Cinematic', desc: 'Dramatic lighting' },
  { value: 'medical', label: 'Medical / Professional', desc: 'Clinical, trust' },
  { value: 'custom', label: 'Custom', desc: 'Your own style' },
]

const SECTION_LABELS: Record<LandingPageSectionType, string> = {
  hero: 'Hero',
  trust_bar: 'Trust Bar',
  problem: 'Problem / Pain',
  benefits: 'Solution / Benefits',
  how_it_works: 'How It Works',
  social_proof: 'Social Proof',
  offer: 'Offer / Price',
  faq: 'FAQ',
  final_cta: 'Final CTA + Order',
  footer: 'Footer',
}

const SECTION_ICONS: Record<LandingPageSectionType, typeof FileText> = {
  hero: Eye,
  trust_bar: Shield,
  problem: AlertCircle,
  benefits: Sparkles,
  how_it_works: Layers,
  social_proof: Globe,
  offer: DollarSign,
  faq: FileText,
  final_cta: Check,
  footer: FileText,
}

// ─── Page Component ──────────────────────────────────────────

export function LandingPageBuilder() {
  const [pages, setPages] = useState<LandingPage[]>([])
  const [loading, setLoading] = useState(true)
  const [activePage, setActivePage] = useState<LandingPage | null>(null)
  const [sections, setSections] = useState<LandingPageSection[]>([])
  const [editingSection, setEditingSection] = useState<LandingPageSection | null>(null)
  const [view, setView] = useState<'list' | 'setup' | 'editor'>('list')
  const [generatingAll, setGeneratingAll] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ─── Load pages ──────────────────────────────────────────

  const loadPages = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.getLandingPages()
      setPages(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pages')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadPages() }, [loadPages])

  // ─── Load single page ────────────────────────────────────

  const loadPage = useCallback(async (id: string) => {
    try {
      const data = await api.getLandingPage(id)
      setActivePage(data)
      setSections(data.sections || [])
      setView('editor')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load page')
    }
  }, [])

  // ─── Create page ─────────────────────────────────────────

  const handleCreatePage = useCallback(async (data: Partial<LandingPage>) => {
    try {
      const result = await api.createLandingPage(data)
      setPages(prev => [result, ...prev])
      setActivePage(result)
      setSections(result.sections || [])
      setView('editor')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create page')
    }
  }, [])

  // ─── Update page ─────────────────────────────────────────

  const handleUpdatePage = useCallback(async (id: string, data: Partial<LandingPage>) => {
    try {
      const result = await api.updateLandingPage(id, data)
      setActivePage(result)
      setSections(result.sections || [])
      setPages(prev => prev.map(p => p.id === id ? { ...p, ...data } : p))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update page')
    }
  }, [])

  // ─── Delete page ─────────────────────────────────────────

  const handleDeletePage = useCallback(async (id: string) => {
    try {
      await api.deleteLandingPage(id)
      setPages(prev => prev.filter(p => p.id !== id))
      if (activePage?.id === id) {
        setActivePage(null)
        setView('list')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete page')
    }
  }, [activePage])

  // ─── Generate section ────────────────────────────────────

  const handleGenerateSection = useCallback(async (sectionId: string) => {
    try {
      setSections(prev => prev.map(s =>
        s.id === sectionId ? { ...s, generationStatus: 'generating' as const } : s
      ))
      const result = await api.generateLandingPageSection(sectionId, {
        style: activePage?.visualStyle,
        language: activePage?.language,
      })
      setSections(prev => prev.map(s => s.id === sectionId ? result : s))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate section')
      setSections(prev => prev.map(s =>
        s.id === sectionId ? { ...s, generationStatus: 'failed' as const } : s
      ))
    }
  }, [activePage])

  // ─── Generate all sections ───────────────────────────────

  const handleGenerateAll = useCallback(async () => {
    if (!activePage) return
    try {
      setGeneratingAll(true)
      await api.generateAllLandingPageSections(activePage.id, {
        style: activePage.visualStyle,
        language: activePage.language,
      })
      const refreshed = await api.getLandingPage(activePage.id)
      setSections(refreshed.sections || [])
      setActivePage(refreshed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate all sections')
    } finally {
      setGeneratingAll(false)
    }
  }, [activePage])

  // ─── Update section ──────────────────────────────────────

  const handleUpdateSection = useCallback(async (sectionId: string, data: Partial<LandingPageSection>) => {
    try {
      const result = await api.updateLandingPageSection(sectionId, data)
      setSections(prev => prev.map(s => s.id === sectionId ? result : s))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update section')
    }
  }, [])

  // ─── Reorder sections ────────────────────────────────────

  const handleReorder = useCallback(async (fromIndex: number, toIndex: number) => {
    const newSections = [...sections]
    const [moved] = newSections.splice(fromIndex, 1)
    newSections.splice(toIndex, 0, moved)
    setSections(newSections)
    try {
      await api.reorderLandingPageSections(activePage!.id, newSections.map(s => s.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder')
    }
  }, [sections, activePage])

  // ─── Toggle section ──────────────────────────────────────

  const handleToggleSection = useCallback(async (sectionId: string) => {
    const section = sections.find(s => s.id === sectionId)
    if (!section) return
    await handleUpdateSection(sectionId, { enabled: !section.enabled })
  }, [sections, handleUpdateSection])

  // ─── Render ──────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {error && (
        <div className="glass-card p-4 border-danger/30 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-danger flex-shrink-0" />
          <p className="text-sm text-danger">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-text-muted hover:text-text-primary">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {view === 'list' && (
        <ListView
          pages={pages}
          loading={loading}
          onSelect={loadPage}
          onDelete={handleDeletePage}
          onCreate={() => setView('setup')}
        />
      )}

      {view === 'setup' && (
        <SetupView
          onSubmit={handleCreatePage}
          onCancel={() => setView('list')}
        />
      )}

      {view === 'editor' && activePage && (
        <EditorView
          page={activePage}
          sections={sections}
          editingSection={editingSection}
          generatingAll={generatingAll}
          onSelectSection={setEditingSection}
          onGenerateSection={handleGenerateSection}
          onGenerateAll={handleGenerateAll}
          onUpdateSection={handleUpdateSection}
          onUpdatePage={handleUpdatePage}
          onReorder={handleReorder}
          onToggleSection={handleToggleSection}
          onBack={() => { setView('list'); setActivePage(null) }}
          onRegenerateSection={handleGenerateSection}
        />
      )}
    </div>
  )
}

// ─── List View ──────────────────────────────────────────────

function ListView({ pages, loading, onSelect, onDelete, onCreate }: {
  pages: LandingPage[]
  loading: boolean
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onCreate: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <FileText className="w-6 h-6 text-gold" />
            Landing Pages
          </h1>
          <p className="text-sm text-text-muted mt-1">Create AI-powered product landing pages for your e-commerce store.</p>
        </div>
        <button onClick={onCreate} className="btn-primary">
          <Plus className="w-4 h-4" />
          New Landing Page
        </button>
      </div>

      {loading ? (
        <div className="glass-card p-12 text-center">
          <Loader2 className="w-8 h-8 text-gold animate-spin mx-auto mb-3" />
          <p className="text-sm text-text-muted">Loading landing pages...</p>
        </div>
      ) : pages.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <FileText className="w-6 h-6" />
          </div>
          <p className="text-sm text-text-muted">No landing pages yet. Create your first one!</p>
          <button onClick={onCreate} className="btn-primary mt-2">
            <Plus className="w-4 h-4" />
            New Landing Page
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pages.map(page => (
            <div key={page.id} className="glass-card overflow-hidden group cursor-pointer" onClick={() => onSelect(page.id)}>
              <div className="aspect-video bg-gradient-to-br from-gold/5 to-gold/[0.02] flex items-center justify-center border-b border-border relative">
                {page.productImageUrl ? (
                  <img src={page.productImageUrl} alt={page.name} className="w-full h-full object-cover" />
                ) : (
                  <FileText className="w-12 h-12 text-text-muted" />
                )}
                <div className="absolute top-3 right-3 flex gap-1.5">
                  <span className={cn(
                    'badge text-[9px]',
                    page.status === 'ready' ? 'bg-success/15 text-success' :
                    page.status === 'generating' ? 'bg-info/15 text-info' :
                    'bg-white/10 text-text-muted'
                  )}>
                    {page.status}
                  </span>
                </div>
              </div>
              <div className="p-4">
                <h3 className="text-sm font-semibold text-text-primary mb-1 line-clamp-1">{page.name}</h3>
                <p className="text-xs text-text-muted mb-3 line-clamp-1">{page.productName || 'No product name'}</p>
                <div className="flex items-center gap-2 text-[10px] text-text-muted">
                  <span className="flex items-center gap-1"><Languages className="w-3 h-3" />{page.language}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1"><Palette className="w-3 h-3" />{page.visualStyle}</span>
                </div>
                <div className="flex items-center gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={e => { e.stopPropagation(); setConfirmDelete(page.id) }}
                    className="p-1.5 rounded-md bg-surface/90 border border-border text-text-muted hover:text-danger transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDelete(null)}>
          <div className="glass-card w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-danger/12 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-danger" />
              </div>
              <h3 className="text-lg font-bold text-text-primary mb-2">Delete Landing Page?</h3>
              <p className="text-sm text-text-muted mb-6">This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDelete(null)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={() => { onDelete(confirmDelete); setConfirmDelete(null) }} className="btn-primary bg-danger/90 hover:bg-danger flex-1">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Setup View ──────────────────────────────────────────────

function SetupView({ onSubmit, onCancel }: {
  onSubmit: (data: Partial<LandingPage>) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    name: '',
    productName: '',
    productDescription: '',
    productPrice: '',
    promotionalPrice: '',
    mainBenefits: '',
    productFeatures: '',
    targetAudience: '',
    targetMarket: 'Algeria',
    language: 'darija' as LandingPageLanguage,
    brandName: '',
    paymentMethod: 'COD',
    deliveryInfo: '',
    guaranteeInfo: '',
    marketingNotes: '',
    visualStyle: 'luxury' as LandingPageVisualStyle,
  })
  const [productImage, setProductImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setProductImage(file)
    const reader = new FileReader()
    reader.onload = () => setImagePreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleSubmit = async () => {
    let imageUrl = ''
    if (productImage) {
      setUploading(true)
      try {
        const uploaded = await api.uploadFile(productImage, { folder: 'MARKETING' })
        imageUrl = uploaded.url
      } catch {
        // Image upload failed, continue without image
      }
      setUploading(false)
    }

    onSubmit({
      ...form,
      productImageUrl: imageUrl,
      mainBenefits: form.mainBenefits.split('\n').filter(Boolean),
      productFeatures: form.productFeatures.split('\n').filter(Boolean),
      paymentMethod: form.paymentMethod as LandingPagePaymentMethod,
    })
  }

  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }))

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Settings2 className="w-6 h-6 text-gold" />
            Product Setup
          </h1>
          <p className="text-sm text-text-muted mt-1">Configure your product and visual style for the landing page.</p>
        </div>
        <button onClick={onCancel} className="btn-secondary"><X className="w-4 h-4" />Cancel</button>
      </div>

      {/* Product Image */}
      <div className="glass-card p-6">
        <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-gold" />Product Image
        </h2>
        <div className="flex items-start gap-6">
          <div
            className={cn(
              'w-40 h-40 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden',
              imagePreview ? 'border-gold/30 bg-gold/5' : 'border-border hover:border-gold/20 bg-white/[0.02]'
            )}
            onClick={() => document.getElementById('product-image-input')?.click()}
          >
            {imagePreview ? (
              <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <>
                <ImageIcon className="w-8 h-8 text-text-muted mb-2" />
                <span className="text-xs text-text-muted">Click to upload</span>
              </>
            )}
          </div>
          <input id="product-image-input" type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
          <div className="flex-1 space-y-3">
            <p className="text-xs text-text-muted">Upload your main product image. This will be used as the primary visual reference for AI generation.</p>
            <p className="text-xs text-text-muted">Supported: JPG, PNG, WebP</p>
            {imagePreview && (
              <button onClick={() => { setProductImage(null); setImagePreview(null) }} className="text-xs text-danger hover:underline">
                Remove image
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Product Info */}
      <div className="glass-card p-6 space-y-4">
        <h2 className="text-sm font-semibold text-text-primary mb-2 flex items-center gap-2">
          <FileText className="w-4 h-4 text-gold" />Product Information
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">Landing Page Name *</label>
            <input type="text" value={form.name} onChange={e => update('name', e.target.value)} placeholder="e.g., 6in1 Earbuds Landing Page" className="input-field w-full" />
          </div>
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">Product Name *</label>
            <input type="text" value={form.productName} onChange={e => update('productName', e.target.value)} placeholder="e.g., 6in1 Earbuds" className="input-field w-full" />
          </div>
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">Brand Name</label>
            <input type="text" value={form.brandName} onChange={e => update('brandName', e.target.value)} placeholder="e.g., TechPro" className="input-field w-full" />
          </div>
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">Price (DA)</label>
            <input type="text" value={form.productPrice} onChange={e => update('productPrice', e.target.value)} placeholder="e.g., 4500" className="input-field w-full" />
          </div>
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">Promotional Price (DA)</label>
            <input type="text" value={form.promotionalPrice} onChange={e => update('promotionalPrice', e.target.value)} placeholder="e.g., 2999" className="input-field w-full" />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">Product Description</label>
            <textarea value={form.productDescription} onChange={e => update('productDescription', e.target.value)} placeholder="Describe your product..." rows={3} className="textarea-field w-full" />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">Main Benefits (one per line)</label>
            <textarea value={form.mainBenefits} onChange={e => update('mainBenefits', e.target.value)} placeholder="Premium sound quality&#10;Noise cancellation&#10;Long battery life" rows={3} className="textarea-field w-full" />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">Product Features (one per line)</label>
            <textarea value={form.productFeatures} onChange={e => update('productFeatures', e.target.value)} placeholder="Bluetooth 5.0&#10;Waterproof IPX5&#10;30h battery" rows={3} className="textarea-field w-full" />
          </div>
        </div>
      </div>

      {/* Target & Market */}
      <div className="glass-card p-6 space-y-4">
        <h2 className="text-sm font-semibold text-text-primary mb-2 flex items-center gap-2">
          <Globe className="w-4 h-4 text-gold" />Target & Market
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">Language</label>
            <select value={form.language} onChange={e => update('language', e.target.value)} className="select-field w-full">
              {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">Target Market</label>
            <input type="text" value={form.targetMarket} onChange={e => update('targetMarket', e.target.value)} className="input-field w-full" />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">Target Audience</label>
            <input type="text" value={form.targetAudience} onChange={e => update('targetAudience', e.target.value)} placeholder="e.g., Young Algerian professionals, tech enthusiasts" className="input-field w-full" />
          </div>
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">Payment Method</label>
            <select value={form.paymentMethod} onChange={e => update('paymentMethod', e.target.value)} className="select-field w-full">
              <option value="COD">Cash on Delivery (COD)</option>
              <option value="CCP">CCP</option>
              <option value="BARIDIMOB">BaridiMob</option>
              <option value="multiple">Multiple Options</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">Delivery Info</label>
            <input type="text" value={form.deliveryInfo} onChange={e => update('deliveryInfo', e.target.value)} placeholder="e.g., Free delivery, 2-3 days" className="input-field w-full" />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">Guarantee / Return Info</label>
            <input type="text" value={form.guaranteeInfo} onChange={e => update('guaranteeInfo', e.target.value)} placeholder="e.g., 7-day return policy" className="input-field w-full" />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">Marketing Notes</label>
            <textarea value={form.marketingNotes} onChange={e => update('marketingNotes', e.target.value)} placeholder="Additional notes for the AI..." rows={2} className="textarea-field w-full" />
          </div>
        </div>
      </div>

      {/* Visual Style */}
      <div className="glass-card p-6">
        <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
          <Palette className="w-4 h-4 text-gold" />Visual Style
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {VISUAL_STYLES.map(style => (
            <button
              key={style.value}
              onClick={() => update('visualStyle', style.value)}
              className={cn(
                'p-4 rounded-xl border text-left transition-all',
                form.visualStyle === style.value
                  ? 'border-gold/40 bg-gold/10'
                  : 'border-border hover:border-text-muted/30 bg-white/[0.02]'
              )}
            >
              <p className="text-sm font-medium text-text-primary">{style.label}</p>
              <p className="text-[11px] text-text-muted mt-0.5">{style.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button onClick={onCancel} className="btn-secondary">Cancel</button>
        <button
          onClick={handleSubmit}
          disabled={!form.name.trim() || !form.productName.trim() || uploading}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Create Landing Page
        </button>
      </div>
    </div>
  )
}

// ─── Editor View ─────────────────────────────────────────────

function EditorView({ page, sections, editingSection, generatingAll, onSelectSection, onGenerateSection, onGenerateAll, onUpdateSection, onUpdatePage, onReorder: _onReorder, onToggleSection, onBack, onRegenerateSection: _onRegenerateSection }: {
  page: LandingPage
  sections: LandingPageSection[]
  editingSection: LandingPageSection | null
  generatingAll: boolean
  onSelectSection: (s: LandingPageSection | null) => void
  onGenerateSection: (id: string) => void
  onGenerateAll: () => void
  onUpdateSection: (id: string, data: Partial<LandingPageSection>) => void
  onUpdatePage: (id: string, data: Partial<LandingPage>) => void
  onReorder: (from: number, to: number) => void
  onToggleSection: (id: string) => void
  onBack: () => void
  onRegenerateSection: (id: string) => void
}) {
  const currentSections = sections
  const isRTL = LANGUAGES.find(l => l.value === page.language)?.dir === 'rtl'
  const [previewSection, setPreviewSection] = useState<LandingPageSectionType | null>(null)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-white/[0.05] text-text-muted hover:text-text-primary transition-colors">
            <ChevronRight className={cn('w-5 h-5', isRTL ? 'rotate-180' : '')} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-text-primary">{page.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={cn('badge text-[9px]',
                page.status === 'ready' ? 'bg-success/15 text-success' :
                page.status === 'generating' ? 'bg-info/15 text-info' :
                'bg-white/10 text-text-muted'
              )}>{page.status}</span>
              <span className="badge text-[9px] bg-white/5 text-text-muted">{page.language}</span>
              <span className="badge text-[9px] bg-white/5 text-text-muted">{page.visualStyle}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onGenerateAll}
            disabled={generatingAll}
            className="btn-primary disabled:opacity-50"
          >
            {generatingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {generatingAll ? 'Generating...' : 'Generate All'}
          </button>
        </div>
      </div>

      {/* Main Layout: Left sections + Center preview + Right properties */}
      <div className="flex gap-4 min-h-[600px]">
        {/* Left: Section List */}
        <div className="w-64 flex-shrink-0 space-y-2">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Sections</h3>
          {currentSections.map((section) => {
            const Icon = SECTION_ICONS[section.sectionType]
            const isEditing = editingSection?.id === section.id
            return (
              <div
                key={section.id}
                className={cn(
                  'glass-card p-3 cursor-pointer transition-all group',
                  isEditing && 'border-gold/30 bg-gold/5',
                  !section.enabled && 'opacity-50'
                )}
                onClick={() => onSelectSection(isEditing ? null : section)}
              >
                <div className="flex items-center gap-2">
                  <GripVertical className="w-3 h-3 text-text-muted opacity-0 group-hover:opacity-100 cursor-grab" />
                  <Icon className={cn('w-4 h-4 flex-shrink-0', isEditing ? 'text-gold' : 'text-text-muted')} />
                  <span className="text-xs font-medium text-text-primary flex-1 truncate">
                    {SECTION_LABELS[section.sectionType]}
                  </span>
                  <div className="flex items-center gap-1">
                    {section.generationStatus === 'generating' && (
                      <Loader2 className="w-3 h-3 text-info animate-spin" />
                    )}
                    {section.generationStatus === 'completed' && (
                      <Check className="w-3 h-3 text-success" />
                    )}
                    {section.generationStatus === 'failed' && (
                      <AlertCircle className="w-3 h-3 text-danger" />
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); onToggleSection(section.id) }}
                      className={cn(
                        'w-4 h-4 rounded-full border transition-colors',
                        section.enabled ? 'bg-gold/20 border-gold/30' : 'border-border'
                      )}
                    >
                      {section.enabled && <div className="w-2 h-2 rounded-full bg-gold m-0.5" />}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Center: Preview Canvas */}
        <div className="flex-1">
          <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Preview</h3>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-text-muted">1024 × 1024</span>
                {page.productImageUrl && (
                  <img src={page.productImageUrl} alt="Ref" className="w-5 h-5 rounded border border-border object-cover" />
                )}
              </div>
            </div>
            <div className="bg-black/30 flex items-center justify-center p-8" style={{ minHeight: 500 }}>
              {currentSections.filter(s => s.enabled).length === 0 ? (
                <div className="text-center">
                  <Layers className="w-12 h-12 text-text-muted mx-auto mb-3" />
                  <p className="text-sm text-text-muted">Enable sections to see a preview</p>
                </div>
              ) : (
                <div className="space-y-3 w-full max-w-md">
                  {currentSections.filter(s => s.enabled).map(section => (
                    <div
                      key={section.id}
                      className={cn(
                        'rounded-lg border border-border/50 p-4 cursor-pointer transition-all hover:border-gold/20',
                        previewSection === section.sectionType && 'border-gold/40 bg-gold/5'
                      )}
                      onClick={() => setPreviewSection(previewSection === section.sectionType ? null : section.sectionType)}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {(() => { const Ic = SECTION_ICONS[section.sectionType]; return <Ic className="w-3 h-3 text-gold" /> })()}
                        <span className="text-[10px] font-semibold text-gold uppercase">{SECTION_LABELS[section.sectionType]}</span>
                      </div>
                      {section.assetUrl ? (
                        <div className="aspect-square rounded-md overflow-hidden bg-white/5 relative">
                          <img src={section.assetUrl} alt={section.sectionType} className="w-full h-full object-cover" />
                          {/* Text layer overlay */}
                          {section.textLayers && (section.textLayers as TextLayer[]).length > 0 && (
                            <div className="absolute inset-0 p-3 flex flex-col justify-center">
                              {(section.textLayers as TextLayer[]).slice(0, 4).map((layer) => (
                                <p
                                  key={layer.id}
                                  className={cn(
                                    'leading-tight',
                                    layer.type === 'headline' ? 'text-sm font-bold' :
                                    layer.type === 'price' ? 'text-base font-extrabold text-gold' :
                                    layer.type === 'cta' ? 'text-xs font-semibold mt-1' :
                                    layer.type === 'badge' ? 'text-[9px] font-medium' :
                                    'text-[10px]'
                                  )}
                                  style={{
                                    color: layer.color || '#FFFFFF',
                                    textAlign: layer.textAlign || 'left',
                                    direction: layer.direction || 'ltr',
                                    opacity: layer.opacity ?? 1,
                                  }}
                                >
                                  {layer.content}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="aspect-square rounded-md bg-white/[0.03] flex items-center justify-center">
                          <span className="text-[10px] text-text-muted">Not generated yet</span>
                        </div>
                      )}
                      {section.content && Object.keys(section.content).length > 0 && (
                        <div className="mt-2 space-y-1">
                          {(section.content as Record<string, string>).headline && (
                            <p className="text-xs font-semibold text-text-primary truncate">
                              {(section.content as Record<string, string>).headline}
                            </p>
                          )}
                          {(section.content as Record<string, string>).subheadline && (
                            <p className="text-[10px] text-text-muted truncate">
                              {(section.content as Record<string, string>).subheadline}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Properties Panel */}
        <div className="w-80 flex-shrink-0">
          {editingSection ? (
            <SectionProperties
              section={editingSection}
              onUpdate={(data) => onUpdateSection(editingSection.id, data)}
              onGenerate={() => onGenerateSection(editingSection.id)}
            />
          ) : (
            <PageProperties page={page} sections={sections} onUpdate={(data) => onUpdatePage(page.id, data)} />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Section Properties ──────────────────────────────────────

function SectionProperties({ section, onUpdate, onGenerate }: {
  section: LandingPageSection
  onUpdate: (data: Partial<LandingPageSection>) => void
  onGenerate: () => void
}) {
  const [content, setContent] = useState(section.content || {})
  const [textLayers, setTextLayers] = useState<TextLayer[]>((section.textLayers as TextLayer[]) || [])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [activeTab, setActiveTab] = useState<'content' | 'layers'>('content')

  const toggleExpand = (key: string) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))

  const handleContentChange = (key: string, value: string) => {
    const newContent = { ...content, [key]: value }
    setContent(newContent)
    onUpdate({ content: newContent })
  }

  const handleLayerChange = (layerId: string, field: string, value: string | number) => {
    const updated = textLayers.map(l => l.id === layerId ? { ...l, [field]: value } : l)
    setTextLayers(updated)
    onUpdate({ textLayers: updated })
  }

  const statusColors: Record<GenerationStatus, string> = {
    idle: 'bg-white/10 text-text-muted',
    generating: 'bg-info/15 text-info',
    completed: 'bg-success/15 text-success',
    failed: 'bg-danger/15 text-danger',
  }

  return (
    <div className="glass-card p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">{SECTION_LABELS[section.sectionType]}</h3>
        <span className={cn('badge text-[9px]', statusColors[section.generationStatus])}>
          {section.generationStatus}
        </span>
      </div>

      {/* Generate button */}
      <div className="flex gap-2">
        <button onClick={onGenerate} className="btn-primary flex-1" disabled={section.generationStatus === 'generating'}>
          {section.generationStatus === 'generating' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {section.generationStatus === 'idle' ? 'Generate' : 'Regenerate'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/[0.03] border border-border rounded-lg p-0.5">
        {(['content', 'layers'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'flex-1 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all',
              activeTab === tab ? 'bg-gold/15 text-gold' : 'text-text-muted hover:text-text-secondary'
            )}
          >
            {tab === 'content' ? 'Content' : `Text Layers (${textLayers.length})`}
          </button>
        ))}
      </div>

      {activeTab === 'content' ? (
        /* Content fields */
        <div className="space-y-3">
          <p className="text-[11px] text-text-muted uppercase font-semibold">Content</p>
          {Object.entries(content).map(([key, value]) => (
            <div key={key}>
              <label className="text-xs text-text-secondary mb-1 block capitalize">{key.replace(/_/g, ' ')}</label>
              {typeof value === 'string' && value.length > 100 ? (
                <div>
                  <button
                    onClick={() => toggleExpand(key)}
                    className="text-[10px] text-gold hover:underline mb-1 flex items-center gap-1"
                  >
                    {expanded[key] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {expanded[key] ? 'Collapse' : 'Expand'}
                  </button>
                  <textarea
                    value={value}
                    onChange={e => handleContentChange(key, e.target.value)}
                    rows={expanded[key] ? 6 : 2}
                    className="textarea-field w-full text-xs"
                  />
                </div>
              ) : (
                <input
                  type="text"
                  value={String(value || '')}
                  onChange={e => handleContentChange(key, e.target.value)}
                  className="input-field w-full text-xs"
                />
              )}
            </div>
          ))}
          {Object.keys(content).length === 0 && (
            <p className="text-xs text-text-muted italic">No content yet. Click Generate to create content.</p>
          )}
        </div>
      ) : (
        /* Text Layers */
        <div className="space-y-3">
          <p className="text-[11px] text-text-muted uppercase font-semibold">Editable Text Layers</p>
          {textLayers.length === 0 ? (
            <p className="text-xs text-text-muted italic">No text layers. Generate this section to create text layers.</p>
          ) : (
            textLayers.map(layer => (
              <div key={layer.id} className="p-3 rounded-lg bg-white/[0.03] border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-gold uppercase">{layer.type}</span>
                  <span className="text-[9px] text-text-muted">{layer.direction || 'ltr'}</span>
                </div>
                <input
                  type="text"
                  value={layer.content}
                  onChange={e => handleLayerChange(layer.id, 'content', e.target.value)}
                  className="input-field w-full text-xs"
                  dir={layer.direction || 'ltr'}
                />
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[9px] text-text-muted block">Size</label>
                    <input
                      type="number"
                      value={layer.fontSize || 16}
                      onChange={e => handleLayerChange(layer.id, 'fontSize', parseInt(e.target.value) || 16)}
                      className="input-field w-full text-[10px] py-1"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-text-muted block">Weight</label>
                    <input
                      type="number"
                      value={layer.fontWeight || 400}
                      onChange={e => handleLayerChange(layer.id, 'fontWeight', parseInt(e.target.value) || 400)}
                      className="input-field w-full text-[10px] py-1"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-text-muted block">Color</label>
                    <input
                      type="color"
                      value={layer.color || '#FFFFFF'}
                      onChange={e => handleLayerChange(layer.id, 'color', e.target.value)}
                      className="w-full h-7 rounded border border-border cursor-pointer"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] text-text-muted block">Align</label>
                    <select
                      value={layer.textAlign || 'left'}
                      onChange={e => handleLayerChange(layer.id, 'textAlign', e.target.value)}
                      className="select-field w-full text-[10px] py-1"
                    >
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] text-text-muted block">Direction</label>
                    <select
                      value={layer.direction || 'ltr'}
                      onChange={e => handleLayerChange(layer.id, 'direction', e.target.value)}
                      className="select-field w-full text-[10px] py-1"
                    >
                      <option value="ltr">LTR</option>
                      <option value="rtl">RTL</option>
                    </select>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Section asset */}
      {section.assetUrl && (
        <div>
          <p className="text-[11px] text-text-muted uppercase font-semibold mb-2">Generated Image</p>
          <div className="aspect-square rounded-lg overflow-hidden bg-white/5 relative">
            <img src={section.assetUrl} alt={section.sectionType} className="w-full h-full object-cover" />
            {/* Text layers overlay on asset */}
            {textLayers.length > 0 && (
              <div className="absolute inset-0 p-4 flex flex-col justify-center">
                {textLayers.slice(0, 5).map(layer => (
                  <p
                    key={layer.id}
                    className={cn(
                      'leading-tight',
                      layer.type === 'headline' ? 'text-lg font-bold' :
                      layer.type === 'price' ? 'text-xl font-extrabold text-gold' :
                      layer.type === 'cta' ? 'text-sm font-semibold mt-1' :
                      'text-xs'
                    )}
                    style={{
                      color: layer.color || '#FFFFFF',
                      textAlign: layer.textAlign || 'left',
                      direction: layer.direction || 'ltr',
                      opacity: layer.opacity ?? 1,
                    }}
                  >
                    {layer.content}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {section.errorMessage && (
        <div className="p-3 rounded-lg bg-danger/10 border border-danger/20">
          <p className="text-xs text-danger">{section.errorMessage}</p>
        </div>
      )}
    </div>
  )
}

// ─── Page Properties ─────────────────────────────────────────

function PageProperties({ page, sections, onUpdate }: {
  page: LandingPage
  sections: LandingPageSection[]
  onUpdate: (data: Partial<LandingPage>) => void
}) {
  return (
    <div className="glass-card p-5 space-y-5">
      <h3 className="text-sm font-semibold text-text-primary">Page Settings</h3>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-text-secondary mb-1 block">Language</label>
          <select
            value={page.language}
            onChange={e => onUpdate({ language: e.target.value as LandingPageLanguage })}
            className="select-field w-full text-xs"
          >
            {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs text-text-secondary mb-1 block">Visual Style</label>
          <select
            value={page.visualStyle}
            onChange={e => onUpdate({ visualStyle: e.target.value as LandingPageVisualStyle })}
            className="select-field w-full text-xs"
          >
            {VISUAL_STYLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs text-text-secondary mb-1 block">Price</label>
          <input
            type="text"
            value={page.productPrice || ''}
            onChange={e => onUpdate({ productPrice: e.target.value })}
            className="input-field w-full text-xs"
          />
        </div>

        <div>
          <label className="text-xs text-text-secondary mb-1 block">Promotional Price</label>
          <input
            type="text"
            value={page.promotionalPrice || ''}
            onChange={e => onUpdate({ promotionalPrice: e.target.value })}
            className="input-field w-full text-xs"
          />
        </div>

        <div>
          <label className="text-xs text-text-secondary mb-1 block">Payment Method</label>
          <select
            value={page.paymentMethod}
            onChange={e => onUpdate({ paymentMethod: e.target.value as LandingPage['paymentMethod'] })}
            className="select-field w-full text-xs"
          >
            <option value="COD">Cash on Delivery</option>
            <option value="CCP">CCP</option>
            <option value="BARIDIMOB">BaridiMob</option>
            <option value="multiple">Multiple</option>
          </select>
        </div>
      </div>

      {/* Section Stats */}
      <div>
        <p className="text-[11px] text-text-muted uppercase font-semibold mb-2">Sections</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 rounded-lg bg-white/[0.03] text-center">
            <p className="text-lg font-bold text-text-primary">{sections.filter(s => s.enabled).length}</p>
            <p className="text-[10px] text-text-muted">Active</p>
          </div>
          <div className="p-2 rounded-lg bg-white/[0.03] text-center">
            <p className="text-lg font-bold text-success">{sections.filter(s => s.generationStatus === 'completed').length}</p>
            <p className="text-[10px] text-text-muted">Generated</p>
          </div>
        </div>
      </div>
    </div>
  )
}
