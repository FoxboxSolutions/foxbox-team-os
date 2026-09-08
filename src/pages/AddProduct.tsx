import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, 
  Link as LinkIcon, 
  Loader2, 
  Check,
  AlertTriangle,
  Upload
} from 'lucide-react'
import { cn } from '@/lib/utils'

type AnalysisStep = 'input' | 'analyzing' | 'review'

export function AddProduct() {
  const navigate = useNavigate()
  const [step, setStep] = useState<AnalysisStep>('input')
  const [url, setUrl] = useState('')
  const [analysisResult, setAnalysisResult] = useState<{
    success: boolean
    data?: {
      name: string
      price: number
      weight: string
      images: string[]
      variants: { name: string; price: number }[]
    }
    errors?: string[]
  } | null>(null)

  const handleAnalyze = async () => {
    if (!url.trim()) return

    setStep('analyzing')
    
    // Simulate analysis
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Mock result
    setAnalysisResult({
      success: true,
      data: {
        name: 'Extracted Product Name',
        price: 25,
        weight: '200g',
        images: ['https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=400'],
        variants: [
          { name: 'Small', price: 22 },
          { name: 'Medium', price: 25 },
          { name: 'Large', price: 28 },
        ],
      },
    })
    setStep('review')
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back Button */}
      <button
        onClick={() => navigate('/app/research')}
        className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm">Back to Products</span>
      </button>

      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Add Product</h1>
        <p className="text-text-secondary mt-1">Paste a supplier URL to analyze the product</p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-4">
        <StepIndicator 
          number={1} 
          label="Input URL" 
          active={step === 'input'} 
          completed={step !== 'input'} 
        />
        <div className="flex-1 h-px bg-border" />
        <StepIndicator 
          number={2} 
          label="Analyze" 
          active={step === 'analyzing'} 
          completed={step === 'review'} 
        />
        <div className="flex-1 h-px bg-border" />
        <StepIndicator 
          number={3} 
          label="Review" 
          active={step === 'review'} 
          completed={false} 
        />
      </div>

      {/* Main Content */}
      <div className="glass-card p-6">
        {step === 'input' && (
          <div className="space-y-6">
            <div>
              <label className="text-sm font-medium text-text-primary block mb-2">
                Product URL
              </label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                <input
                  type="url"
                  placeholder="https://detail.1688.com/offer/..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="input-field pl-11"
                />
              </div>
              <p className="text-xs text-text-muted mt-2">
                Supported platforms: 1688, Taobao, Alibaba
              </p>
            </div>

            <button
              onClick={handleAnalyze}
              disabled={!url.trim()}
              className={cn(
                'btn-primary w-full',
                !url.trim() && 'opacity-50 cursor-not-allowed'
              )}
            >
              Analyze Product
            </button>
          </div>
        )}

        {step === 'analyzing' && (
          <div className="text-center py-12">
            <Loader2 className="w-12 h-12 text-gold mx-auto mb-4 animate-spin" />
            <h3 className="text-lg font-semibold text-text-primary mb-2">Analyzing Product</h3>
            <p className="text-text-secondary">Extracting data from supplier page...</p>
          </div>
        )}

        {step === 'review' && analysisResult && (
          <div className="space-y-6">
            {analysisResult.success && analysisResult.data ? (
              <>
                <div className="flex items-start gap-4">
                  {analysisResult.data.images[0] && (
                    <img 
                      src={analysisResult.data.images[0]} 
                      alt="" 
                      className="w-24 h-24 rounded-lg object-cover"
                    />
                  )}
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-text-primary">
                      {analysisResult.data.name}
                    </h3>
                    <p className="text-gold font-medium mt-1">
                      ¥{analysisResult.data.price} RMB
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="badge badge-auto">
                        <Check className="w-3 h-3 mr-1" />
                        AUTO
                      </span>
                    </div>
                  </div>
                </div>

                {/* Extracted Fields */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-text-secondary">Extracted Data</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <FieldPreview label="Weight" value={analysisResult.data.weight} source="AUTO" />
                    <FieldPreview label="Price" value={`¥${analysisResult.data.price} RMB`} source="AUTO" />
                  </div>
                </div>

                {/* Variants */}
                {analysisResult.data.variants.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-text-secondary">Variants Found</h4>
                    <div className="space-y-2">
                      {analysisResult.data.variants.map((variant, i) => (
                        <div key={i} className="flex items-center justify-between bg-surface rounded-lg p-3">
                          <span className="text-text-primary">{variant.name}</span>
                          <span className="text-gold">¥{variant.price} RMB</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      // Create product and navigate
                      navigate('/app/research/1')
                    }}
                    className="btn-primary flex-1"
                  >
                    <Upload className="w-4 h-4" />
                    Import Product
                  </button>
                  <button
                    onClick={() => {
                      setStep('input')
                      setAnalysisResult(null)
                    }}
                    className="btn-secondary"
                  >
                    Try Another URL
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <AlertTriangle className="w-12 h-12 text-warning mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-text-primary mb-2">
                  Analysis Failed
                </h3>
                <p className="text-text-secondary mb-4">
                  Unable to extract data from this URL
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={handleAnalyze}
                    className="btn-secondary"
                  >
                    Retry
                  </button>
                  <button
                    onClick={() => navigate('/app/research/add-manually')}
                    className="btn-primary"
                  >
                    Enter Data Manually
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function StepIndicator({ 
  number, 
  label, 
  active, 
  completed 
}: { 
  number: number
  label: string
  active: boolean
  completed: boolean 
}) {
  return (
    <div className="flex items-center gap-2">
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
        active ? 'bg-gold text-obsidian' : 
        completed ? 'bg-gold-muted text-gold' : 
        'bg-charcoal text-text-muted'
      )}>
        {completed ? <Check className="w-4 h-4" /> : number}
      </div>
      <span className={cn(
        'text-sm',
        active ? 'text-text-primary' : 'text-text-muted'
      )}>
        {label}
      </span>
    </div>
  )
}

function FieldPreview({ label, value, source }: { label: string; value: string; source: string }) {
  return (
    <div className="bg-surface rounded-lg p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-text-muted">{label}</span>
        <span className={cn(
          'badge text-[10px]',
          source === 'AUTO' ? 'badge-auto' : 
          source === 'MANUAL' ? 'badge-manual' : 'badge-missing'
        )}>
          {source}
        </span>
      </div>
      <p className="text-sm text-text-primary font-medium">{value}</p>
    </div>
  )
}
