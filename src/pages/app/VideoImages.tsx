import { useState, useEffect, useCallback } from 'react'
import {
  Image as ImageIcon, Video, Sparkles, Trash2, X,
  Download, Eye, Loader2, AlertCircle,
  Monitor, Smartphone, LayoutGrid, Layers, Wand2,
  Copy,
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { CreativeAsset, CreativeGeneration, CreativeImageCategory, CreativeImageFormat } from '@/types'

// ─── Constants ──────────────────────────────────────────────

const IMAGE_CATEGORIES: { value: CreativeImageCategory; label: string; icon: typeof ImageIcon }[] = [
  { value: 'product_showcase', label: 'Product Showcase', icon: ImageIcon },
  { value: 'product_ad', label: 'Product Ad', icon: Sparkles },
  { value: 'lifestyle', label: 'Lifestyle', icon: Monitor },
  { value: 'ugc_style', label: 'UGC-Style', icon: Smartphone },
  { value: 'before_after', label: 'Before / After', icon: LayoutGrid },
  { value: 'comparison', label: 'Comparison', icon: LayoutGrid },
  { value: 'offer_creative', label: 'Offer Creative', icon: Sparkles },
  { value: 'social_media', label: 'Social Media', icon: Smartphone },
  { value: 'facebook_ad', label: 'Facebook Ad', icon: Monitor },
  { value: 'instagram_post', label: 'Instagram Post', icon: Smartphone },
  { value: 'story', label: 'Story', icon: Smartphone },
]

const VIDEO_CATEGORIES = [
  { value: 'product_video', label: 'Product Video', icon: Video },
  { value: 'product_showcase', label: 'Product Showcase', icon: Video },
  { value: 'ugc_video', label: 'UGC Video', icon: Video },
  { value: 'ad_video', label: 'Ad Video', icon: Video },
  { value: 'product_animation', label: 'Product Animation', icon: Video },
  { value: 'before_after', label: 'Before / After', icon: Video },
]

const IMAGE_FORMATS: { value: CreativeImageFormat; label: string; dims: string; apiSize: string }[] = [
  { value: '1080x1080', label: 'Square', dims: '1024 × 1024 (closest to 1080)', apiSize: '1024x1024' },
  { value: '1080x1350', label: 'Portrait', dims: '1024 × 1792 (approx 4:5)', apiSize: '1024x1792' },
  { value: '1080x1920', label: 'Story / Reel', dims: '1024 × 1792 (approx 9:16)', apiSize: '1024x1792' },
  { value: '1200x628', label: 'Landscape', dims: '1792 × 1024 (approx 1.9:1)', apiSize: '1792x1024' },
]

const STYLE_PRESETS = [
  { value: 'luxury', label: 'Luxury', desc: 'Premium dark + gold' },
  { value: 'premium', label: 'Premium', desc: 'Sophisticated' },
  { value: 'minimal', label: 'Minimal', desc: 'Clean, simple' },
  { value: 'modern', label: 'Modern Tech', desc: 'Futuristic' },
  { value: 'ugc', label: 'UGC', desc: 'Authentic' },
  { value: 'cinematic', label: 'Cinematic', desc: 'Dramatic' },
]

const VARIANTS = [
  { value: 'problem', label: 'Problem-Focused', desc: 'Highlights the pain point' },
  { value: 'benefit', label: 'Benefit-Focused', desc: 'Shows the outcome' },
  { value: 'lifestyle', label: 'Lifestyle', desc: 'Real-life context' },
  { value: 'offer', label: 'Offer-Focused', desc: 'Price and deal' },
]

// ─── Page Component ──────────────────────────────────────────

export function VideoImagesCreation() {
  const [tab, setTab] = useState<'image' | 'video' | 'library'>('image')
  const [assets, setAssets] = useState<CreativeAsset[]>([])
  const [generations, setGenerations] = useState<CreativeGeneration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [previewAsset, setPreviewAsset] = useState<CreativeAsset | null>(null)

  const loadAssets = useCallback(async () => {
    try {
      setLoading(true)
      const [a, g] = await Promise.all([
        api.getCreativeAssets(),
        api.getCreativeGenerations(),
      ])
      setAssets(a)
      setGenerations(g)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assets')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAssets() }, [loadAssets])

  const handleDeleteAsset = useCallback(async (id: string) => {
    try {
      await api.deleteCreativeAsset(id)
      setAssets(prev => prev.filter(a => a.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete asset')
    }
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          <Wand2 className="w-6 h-6 text-gold" />
          Video & Images Creation
        </h1>
        <p className="text-sm text-text-muted mt-1">Generate professional marketing creatives with AI.</p>
      </div>

      {error && (
        <div className="glass-card p-4 border-danger/30 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-danger flex-shrink-0" />
          <p className="text-sm text-danger">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-text-muted hover:text-text-primary">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-white/[0.03] border border-border rounded-xl p-1 w-fit">
        {([
          { key: 'image' as const, label: 'Image', icon: ImageIcon },
          { key: 'video' as const, label: 'Video', icon: Video },
          { key: 'library' as const, label: 'Library', icon: Layers },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              tab === t.key ? 'bg-gold/15 text-gold' : 'text-text-muted hover:text-text-secondary'
            )}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'image' && (
        <ImageGenerator
          onError={setError}
          onGenerated={loadAssets}
        />
      )}
      {tab === 'video' && (
        <VideoGenerator />
      )}
      {tab === 'library' && (
        <CreativeLibrary
          assets={assets}
          generations={generations}
          loading={loading}
          onDelete={handleDeleteAsset}
          onPreview={setPreviewAsset}
        />
      )}

      {/* Preview Modal */}
      {previewAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setPreviewAsset(null)}>
          <div className="glass-card max-w-4xl max-h-[90vh] overflow-hidden mx-4" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">{previewAsset.name}</h3>
              <div className="flex items-center gap-2">
                <a href={previewAsset.url} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs">
                  <Download className="w-3.5 h-3.5" />Download
                </a>
                <button onClick={() => setPreviewAsset(null)} className="text-text-muted hover:text-text-primary">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="bg-black/30 p-4 flex items-center justify-center">
              <img src={previewAsset.url} alt={previewAsset.name} className="max-w-full max-h-[60vh] object-contain rounded-lg" />
            </div>
            <div className="p-4 flex items-center gap-4 text-xs text-text-muted">
              <span>{previewAsset.width}×{previewAsset.height}</span>
              <span>{previewAsset.provider}</span>
              {previewAsset.style && <span>{previewAsset.style}</span>}
              {previewAsset.language && <span>{previewAsset.language}</span>}
              <span>{new Date(previewAsset.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Image Generator ─────────────────────────────────────────

function ImageGenerator({ onError, onGenerated }: {
  onError: (msg: string) => void
  onGenerated: () => void
}) {
  const [category, setCategory] = useState<CreativeImageCategory>('product_showcase')
  const [format, setFormat] = useState<CreativeImageFormat>('1080x1080')
  const [style, setStyle] = useState('luxury')
  const [prompt, setPrompt] = useState('')
  const [productName, setProductName] = useState('')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<{ url: string; assetId: string } | null>(null)
  const [variantResults, setVariantResults] = useState<{ variant: string; url: string; assetId: string }[]>([])

  const handleGenerate = async () => {
    if (!prompt.trim() && !productName.trim()) {
      onError('Please enter a product name or prompt')
      return
    }
    try {
      setGenerating(true)
      setResult(null)
      const finalPrompt = prompt.trim() || `Professional marketing image for ${productName}. ${IMAGE_CATEGORIES.find(c => c.value === category)?.label}. Style: ${style}.`
      const res = await api.generateCreative({
        prompt: finalPrompt,
        category,
        style,
        dimensions: format,
        name: `${productName || 'Creative'} - ${category}`,
      })
      setResult(res)
      onGenerated()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const handleGenerateVariants = async () => {
    if (!prompt.trim() && !productName.trim()) {
      onError('Please enter a product name or prompt')
      return
    }
    try {
      setGenerating(true)
      setVariantResults([])
      const results: { variant: string; url: string; assetId: string }[] = []

      for (const v of VARIANTS) {
        const variantPrompt = `${prompt || `Marketing image for ${productName}`}. Angle: ${v.desc}. Style: ${style}.`
        try {
          const res = await api.generateCreative({
            prompt: variantPrompt,
            category,
            style,
            dimensions: format,
            name: `${productName || 'Creative'} - ${v.label}`,
          })
          results.push({ variant: v.value, url: res.url, assetId: res.assetId })
          setVariantResults([...results])
        } catch {
          // Skip failed variant
        }
      }
      onGenerated()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Variant generation failed')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Controls */}
      <div className="lg:col-span-2 space-y-5">
        {/* Product Name */}
        <div className="glass-card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-gold" />Creative Setup
          </h3>
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">Product Name</label>
            <input
              type="text"
              value={productName}
              onChange={e => setProductName(e.target.value)}
              placeholder="e.g., 6in1 Earbuds"
              className="input-field w-full"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">Custom Prompt (optional)</label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Describe what you want the creative to look like..."
              rows={3}
              className="textarea-field w-full"
            />
          </div>
        </div>

        {/* Category */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Category</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {IMAGE_CATEGORIES.map(cat => (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={cn(
                  'p-3 rounded-xl border text-left transition-all',
                  category === cat.value
                    ? 'border-gold/40 bg-gold/10'
                    : 'border-border hover:border-text-muted/30 bg-white/[0.02]'
                )}
              >
                <cat.icon className={cn('w-4 h-4 mb-1', category === cat.value ? 'text-gold' : 'text-text-muted')} />
                <p className="text-xs font-medium text-text-primary">{cat.label}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Format & Style */}
        <div className="glass-card p-5 grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3">Format</h3>
            <div className="space-y-2">
              {IMAGE_FORMATS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setFormat(f.value)}
                  className={cn(
                    'w-full p-3 rounded-lg border text-left transition-all flex items-center gap-3',
                    format === f.value
                      ? 'border-gold/40 bg-gold/10'
                      : 'border-border hover:border-text-muted/30 bg-white/[0.02]'
                  )}
                >
                  <div className={cn(
                    'border rounded flex items-center justify-center',
                    format === f.value ? 'border-gold/30' : 'border-border',
                    f.value === '1080x1080' ? 'w-8 h-8' :
                    f.value === '1080x1350' ? 'w-7 h-9' :
                    f.value === '1080x1920' ? 'w-5 h-9' : 'w-9 h-5'
                  )}>
                    <div className={cn('rounded-sm', format === f.value ? 'bg-gold/30' : 'bg-white/10',
                      f.value === '1080x1080' ? 'w-5 h-5' :
                      f.value === '1080x1350' ? 'w-4 h-6' :
                      f.value === '1080x1920' ? 'w-3 h-6' : 'w-6 h-3'
                    )} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-text-primary">{f.label}</p>
                    <p className="text-[10px] text-text-muted">{f.dims}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3">Style</h3>
            <div className="space-y-2">
              {STYLE_PRESETS.map(s => (
                <button
                  key={s.value}
                  onClick={() => setStyle(s.value)}
                  className={cn(
                    'w-full p-3 rounded-lg border text-left transition-all',
                    style === s.value
                      ? 'border-gold/40 bg-gold/10'
                      : 'border-border hover:border-text-muted/30 bg-white/[0.02]'
                  )}
                >
                  <p className="text-xs font-medium text-text-primary">{s.label}</p>
                  <p className="text-[10px] text-text-muted">{s.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Generate Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleGenerate}
            disabled={generating || (!prompt.trim() && !productName.trim())}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Generate Creative
          </button>
          <button
            onClick={handleGenerateVariants}
            disabled={generating || (!prompt.trim() && !productName.trim())}
            className="btn-secondary disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
            Generate 4 Variants
          </button>
        </div>
      </div>

      {/* Right: Preview */}
      <div className="space-y-4">
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Preview</h3>
          </div>
          <div className="bg-black/30 p-4">
            {generating ? (
              <div className="aspect-square flex flex-col items-center justify-center">
                <Loader2 className="w-10 h-10 text-gold animate-spin mb-3" />
                <p className="text-sm text-text-muted">Generating creative...</p>
              </div>
            ) : result ? (
              <div className="space-y-3">
                <div className="aspect-square rounded-lg overflow-hidden">
                  <img src={result.url} alt="Generated" className="w-full h-full object-cover" />
                </div>
                <div className="flex gap-2">
                  <a href={result.url} target="_blank" rel="noopener noreferrer" className="btn-secondary flex-1 text-xs">
                    <Download className="w-3.5 h-3.5" />Download
                  </a>
                </div>
              </div>
            ) : (
              <div className="aspect-square flex flex-col items-center justify-center text-center">
                <ImageIcon className="w-12 h-12 text-text-muted mb-3" />
                <p className="text-sm text-text-muted">Your creative will appear here</p>
              </div>
            )}
          </div>
        </div>

        {/* Variant Results */}
        {variantResults.length > 0 && (
          <div className="glass-card p-4 space-y-3">
            <h3 className="text-xs font-semibold text-text-muted uppercase">Variants</h3>
            <div className="grid grid-cols-2 gap-2">
              {variantResults.map((vr, i) => (
                <div key={i} className="rounded-lg overflow-hidden border border-border">
                  <img src={vr.url} alt={vr.variant} className="w-full aspect-square object-cover" />
                  <p className="text-[10px] text-text-muted text-center py-1 capitalize">{vr.variant}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Video Coming Soon */}
        <div className="glass-card p-5">
          <div className="text-center">
            <Video className="w-8 h-8 text-text-muted mx-auto mb-2" />
            <p className="text-sm font-medium text-text-primary">Video Generation</p>
            <p className="text-xs text-text-muted mt-1">Video provider not configured yet. Connect a video generation API to enable this feature.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Video Generator (Coming Soon) ───────────────────────────

function VideoGenerator() {
  return (
    <div className="glass-card p-12 text-center">
      <div className="max-w-md mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center mx-auto mb-4">
          <Video className="w-8 h-8 text-gold" />
        </div>
        <h3 className="text-lg font-bold text-text-primary mb-2">Video Generation</h3>
        <p className="text-sm text-text-muted mb-4">
          Video generation will be available when a video provider is configured.
          Supported formats: Product videos, UGC, ads, animations.
        </p>
        <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
          {VIDEO_CATEGORIES.map(cat => (
            <div key={cat.value} className="p-3 rounded-xl border border-border bg-white/[0.02] text-left opacity-60">
              <cat.icon className="w-4 h-4 text-text-muted mb-1" />
              <p className="text-xs font-medium text-text-primary">{cat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Creative Library ────────────────────────────────────────

function CreativeLibrary({ assets, generations, loading, onDelete, onPreview }: {
  assets: CreativeAsset[]
  generations: CreativeGeneration[]
  loading: boolean
  onDelete: (id: string) => void
  onPreview: (asset: CreativeAsset) => void
}) {
  const [filter, setFilter] = useState<'all' | 'landing_page' | 'marketing_image' | 'marketing_video'>('all')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const filtered = assets.filter(a => filter === 'all' || a.projectType === filter)

  const stats = {
    total: assets.length,
    generated: generations.filter(g => g.status === 'completed').length,
    failed: generations.filter(g => g.status === 'failed').length,
    landingPages: assets.filter(a => a.projectType === 'landing_page').length,
  }

  if (loading) {
    return (
      <div className="glass-card p-12 text-center">
        <Loader2 className="w-8 h-8 text-gold animate-spin mx-auto mb-3" />
        <p className="text-sm text-text-muted">Loading library...</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Assets', value: stats.total },
          { label: 'Generated', value: stats.generated, color: 'text-success' },
          { label: 'Failed', value: stats.failed, color: 'text-danger' },
          { label: 'Landing Pages', value: stats.landingPages, color: 'text-gold' },
        ].map((stat, i) => (
          <div key={i} className="glass-card p-4">
            <p className="text-[11px] text-text-muted uppercase">{stat.label}</p>
            <p className={cn('text-lg font-bold', stat.color || 'text-text-primary')}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(['all', 'landing_page', 'marketing_image', 'marketing_video'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
              filter === f ? 'bg-gold/15 text-gold border border-gold/20' : 'bg-white/[0.03] text-text-muted border border-border'
            )}
          >
            {f === 'all' ? 'All' : f === 'landing_page' ? 'Landing Pages' : f === 'marketing_image' ? 'Marketing Images' : 'Marketing Videos'}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Layers className="w-6 h-6" />
          </div>
          <p className="text-sm text-text-muted">No assets in the library yet. Generate your first creative!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map(asset => (
            <div key={asset.id} className="glass-card overflow-hidden group cursor-pointer" onClick={() => onPreview(asset)}>
              <div className="aspect-square bg-white/[0.03] relative">
                <img src={asset.thumbnailUrl || asset.url} alt={asset.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button className="p-2 rounded-lg bg-surface/90 border border-border text-text-muted hover:text-text-primary">
                    <Eye className="w-4 h-4" />
                  </button>
                  <a href={asset.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="p-2 rounded-lg bg-surface/90 border border-border text-text-muted hover:text-text-primary">
                    <Download className="w-4 h-4" />
                  </a>
                  <button
                    onClick={e => { e.stopPropagation(); setConfirmDelete(asset.id) }}
                    className="p-2 rounded-lg bg-surface/90 border border-border text-text-muted hover:text-danger"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="p-3">
                <p className="text-xs font-medium text-text-primary line-clamp-1">{asset.name}</p>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-text-muted">
                  <span>{asset.provider}</span>
                  {asset.style && <span>• {asset.style}</span>}
                </div>
              </div>
            </div>
          ))}
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
              <h3 className="text-lg font-bold text-text-primary mb-2">Delete Asset?</h3>
              <p className="text-sm text-text-muted mb-6">This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDelete(null)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={() => { onDelete(confirmDelete); setConfirmDelete(null) }} className="btn-primary bg-danger/90 hover:bg-danger flex-1">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
