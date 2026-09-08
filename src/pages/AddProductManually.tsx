import { useState, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, 
  X, 
  Package,
  DollarSign,
  Weight,
  Truck,
  Box,
  AlertCircle,
  Check,
  Loader2,
  Image as ImageIcon
} from 'lucide-react'
import { useAppState } from '@/stores/AppState'
import { cn, formatCurrency } from '@/lib/utils'
import { defaultCurrencyRates } from '@/lib/mock-data'
import { 
  calculateProductCosts, 
  createManualProductFields, 
  createCostScenario,
  generateProductId,
  type ProductCostInput 
} from '@/lib/calculations'
import type { Product, ProductStatus } from '@/types'

interface FormData {
  name: string
  imageFile: File | null
  imagePreview: string | null
  purchasePriceRmb: number
  quantity: number
  weightGrams: number
  shippingCostPerKgUsd: number
  cartonLengthCm: number | null
  cartonWidthCm: number | null
  cartonHeightCm: number | null
}

interface FormErrors {
  name?: string
  imageFile?: string
  purchasePriceRmb?: string
  quantity?: string
  weightGrams?: string
  shippingCostPerKgUsd?: string
  cartonLengthCm?: string
  cartonWidthCm?: string
  cartonHeightCm?: string
}

const initialFormData: FormData = {
  name: '',
  imageFile: null,
  imagePreview: null,
  purchasePriceRmb: 0,
  quantity: 100,
  weightGrams: 0,
  shippingCostPerKgUsd: 9.40,
  cartonLengthCm: null,
  cartonWidthCm: null,
  cartonHeightCm: null,
}

export function AddProductManually() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { addProduct, addActivityLog, addNotification, currentUser } = useAppState()
  
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  // Calculate cost input for the calculation engine
  const costInput: ProductCostInput = useMemo(() => ({
    purchasePriceRmb: formData.purchasePriceRmb,
    quantity: formData.quantity,
    weightGrams: formData.weightGrams,
    shippingCostPerKgUsd: formData.shippingCostPerKgUsd,
    cartonLengthCm: formData.cartonLengthCm ?? undefined,
    cartonWidthCm: formData.cartonWidthCm ?? undefined,
    cartonHeightCm: formData.cartonHeightCm ?? undefined,
  }), [formData])

  // Real-time calculations using the centralized engine
  const calculations = useMemo(() => {
    return calculateProductCosts(costInput, defaultCurrencyRates)
  }, [costInput])

  // Validate form
  const validateForm = useCallback((): FormErrors => {
    const newErrors: FormErrors = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Product name is required'
    }

    if (!formData.imageFile) {
      newErrors.imageFile = 'Product image is required'
    }

    if (formData.purchasePriceRmb <= 0) {
      newErrors.purchasePriceRmb = 'Purchase price must be greater than 0'
    }

    if (!Number.isInteger(formData.quantity) || formData.quantity <= 0) {
      newErrors.quantity = 'Quantity must be a positive integer'
    }

    if (formData.weightGrams <= 0) {
      newErrors.weightGrams = 'Product weight must be greater than 0'
    }

    if (formData.shippingCostPerKgUsd < 0) {
      newErrors.shippingCostPerKgUsd = 'Shipping cost cannot be negative'
    }

    // Validate carton dimensions (if any are entered)
    if (formData.cartonLengthCm !== null && formData.cartonLengthCm <= 0) {
      newErrors.cartonLengthCm = 'Length must be greater than 0'
    }
    if (formData.cartonWidthCm !== null && formData.cartonWidthCm <= 0) {
      newErrors.cartonWidthCm = 'Width must be greater than 0'
    }
    if (formData.cartonHeightCm !== null && formData.cartonHeightCm <= 0) {
      newErrors.cartonHeightCm = 'Height must be greater than 0'
    }

    return newErrors
  }, [formData])

  // Handle image upload
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setErrors(prev => ({ ...prev, imageFile: 'Please upload JPG, PNG, or WEBP' }))
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, imageFile: 'Image must be less than 5MB' }))
      return
    }

    // Create preview
    const reader = new FileReader()
    reader.onload = (event) => {
      setFormData(prev => ({
        ...prev,
        imageFile: file,
        imagePreview: event.target?.result as string,
      }))
      setErrors(prev => ({ ...prev, imageFile: undefined }))
    }
    reader.readAsDataURL(file)
  }, [])

  // Remove image
  const handleRemoveImage = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      imageFile: null,
      imagePreview: null,
    }))
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  // Handle form field changes
  const handleChange = useCallback((field: keyof FormData, value: string | number | null) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }, [errors])

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    
    const validationErrors = validateForm()
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    setIsSubmitting(true)

    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500))

      // Generate product ID
      const productId = generateProductId()

      // Create image URL (in real app, this would upload to storage)
      const imageUrl = formData.imagePreview || undefined

      // Create product fields with MANUAL source type
      const fields = createManualProductFields(costInput)

      // Create cost scenario
      const costScenario = createCostScenario(productId, costInput, calculations)

      // Create the product object
      const newProduct: Product = {
        id: productId,
        name: formData.name.trim(),
        sourceUrl: '',
        sourcePlatform: 'MANUAL',
        description: '',
        category: '',
        status: 'RESEARCH' as ProductStatus,
        score: undefined,
        notes: '',
        imageUrl,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAnalyzedAt: new Date(),
        fields,
        variants: [],
        creatives: [],
        links: [],
        supplier: undefined,
        shippingProfile: undefined,
        costScenario,
        codScenario: undefined,
        offers: [],
        tests: [],
        decisionHistory: [],
      }

      // In a real app, this would save to the database
      // For now, we'll store in localStorage
      addProduct(newProduct)
      addActivityLog({
        id: Date.now().toString(36) + Math.random().toString(36).substring(2, 10),
        action: 'PRODUCT_CREATED',
        userId: currentUser?.id || 'u1',
        entityType: 'PRODUCT',
        entityId: productId,
        entityName: formData.name.trim(),
        createdAt: new Date(),
      })
      addNotification({
        id: Date.now().toString(36) + Math.random().toString(36).substring(2, 10),
        type: 'GENERAL',
        title: 'Product created',
        message: `"${formData.name.trim()}" has been created`,
        link: `/app/research/${productId}`,
        isRead: false,
        userId: currentUser?.id || 'u1',
        createdAt: new Date(),
      })

      setSubmitSuccess(true)

      // Redirect to product detail after a short delay
      setTimeout(() => {
        navigate(`/app/research/${productId}`)
      }, 1000)

    } catch {
      setErrors({ name: 'Failed to create product. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }, [formData, costInput, calculations, validateForm, navigate])

  return (
    <div className="max-w-7xl mx-auto space-y-6">
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
        <h1 className="text-2xl font-bold text-text-primary">Add Product Manually</h1>
        <p className="text-text-secondary mt-1">
          Enter the essential product information to calculate your COD economics.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Form Fields */}
          <div className="lg:col-span-2 space-y-6">
            {/* Product Information Card */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-gold-muted">
                  <Package className="w-5 h-5 text-gold" />
                </div>
                <h2 className="text-lg font-semibold text-text-primary">Product Information</h2>
              </div>

              <div className="space-y-6">
                {/* Product Name */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Product Name <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="e.g., 6 in 1 Wireless Earbuds"
                    className={cn(
                      'input-field',
                      errors.name && 'border-danger focus:border-danger focus:ring-danger/30'
                    )}
                  />
                  {errors.name && (
                    <p className="mt-2 text-sm text-danger flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4" />
                      {errors.name}
                    </p>
                  )}
                </div>

                {/* Product Image */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Product Image <span className="text-danger">*</span>
                  </label>
                  
                  {formData.imagePreview ? (
                    <div className="relative inline-block">
                      <img
                        src={formData.imagePreview}
                        alt="Product preview"
                        className="w-40 h-40 object-cover rounded-xl border border-border"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-danger rounded-full flex items-center justify-center text-white hover:bg-danger/80 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute bottom-2 right-2 px-3 py-1.5 bg-charcoal/90 rounded-lg text-xs text-text-primary hover:bg-surface-hover transition-colors"
                      >
                        Replace
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className={cn(
                        'w-full h-40 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 transition-colors',
                        errors.imageFile 
                          ? 'border-danger bg-danger/5 hover:bg-danger/10' 
                          : 'border-border hover:border-border-light hover:bg-surface'
                      )}
                    >
                      <div className="p-3 rounded-full bg-charcoal">
                        <ImageIcon className="w-6 h-6 text-text-muted" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-text-secondary">Upload Product Image</p>
                        <p className="text-xs text-text-muted mt-1">JPG / PNG / WEBP</p>
                      </div>
                    </button>
                  )}
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  
                  {errors.imageFile && (
                    <p className="mt-2 text-sm text-danger flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4" />
                      {errors.imageFile}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Product Cost Card */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-gold-muted">
                  <DollarSign className="w-5 h-5 text-gold" />
                </div>
                <h2 className="text-lg font-semibold text-text-primary">Product Cost</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Purchase Price */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Purchase Price (RMB) <span className="text-danger">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">¥</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.purchasePriceRmb || ''}
                      onChange={(e) => handleChange('purchasePriceRmb', parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className={cn(
                        'input-field pl-8',
                        errors.purchasePriceRmb && 'border-danger focus:border-danger focus:ring-danger/30'
                      )}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted">RMB</span>
                  </div>
                  {errors.purchasePriceRmb && (
                    <p className="mt-2 text-sm text-danger flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4" />
                      {errors.purchasePriceRmb}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-text-muted">
                    Enter price in RMB/CNY ¥
                  </p>
                </div>

                {/* Quantity */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    PCS Wanted <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={formData.quantity || ''}
                    onChange={(e) => handleChange('quantity', parseInt(e.target.value) || 0)}
                    placeholder="100"
                    className={cn(
                      'input-field',
                      errors.quantity && 'border-danger focus:border-danger focus:ring-danger/30'
                    )}
                  />
                  {errors.quantity && (
                    <p className="mt-2 text-sm text-danger flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4" />
                      {errors.quantity}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-text-muted">
                    Quantity you plan to purchase
                  </p>
                </div>
              </div>
            </div>

            {/* Product Weight Card */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-gold-muted">
                  <Weight className="w-5 h-5 text-gold" />
                </div>
                <h2 className="text-lg font-semibold text-text-primary">Product Weight</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Weight */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Weight (grams) <span className="text-danger">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      value={formData.weightGrams || ''}
                      onChange={(e) => handleChange('weightGrams', parseFloat(e.target.value) || 0)}
                      placeholder="180"
                      className={cn(
                        'input-field pr-8',
                        errors.weightGrams && 'border-danger focus:border-danger focus:ring-danger/30'
                      )}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted">g</span>
                  </div>
                  {errors.weightGrams && (
                    <p className="mt-2 text-sm text-danger flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4" />
                      {errors.weightGrams}
                    </p>
                  )}
                </div>

                {/* Total Weight (Read-only) */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Total Shipping Weight
                  </label>
                  <div className="input-field bg-charcoal-light cursor-not-allowed">
                    <span className="text-text-primary font-medium">
                      {calculations.totalWeightKg.toFixed(2)} KG
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-text-muted">
                    Weight × Quantity = {formData.weightGrams}g × {formData.quantity}
                  </p>
                </div>
              </div>
            </div>

            {/* Carton Information Card */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-gold-muted">
                  <Box className="w-5 h-5 text-gold" />
                </div>
                <h2 className="text-lg font-semibold text-text-primary">Carton Information</h2>
                <span className="text-xs text-text-muted">(Optional)</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Length */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Length
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      value={formData.cartonLengthCm ?? ''}
                      onChange={(e) => handleChange('cartonLengthCm', e.target.value ? parseFloat(e.target.value) : null)}
                      placeholder="50"
                      className={cn(
                        'input-field pr-8',
                        errors.cartonLengthCm && 'border-danger focus:border-danger focus:ring-danger/30'
                      )}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted">cm</span>
                  </div>
                  {errors.cartonLengthCm && (
                    <p className="mt-2 text-sm text-danger flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4" />
                      {errors.cartonLengthCm}
                    </p>
                  )}
                </div>

                {/* Width */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Width
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      value={formData.cartonWidthCm ?? ''}
                      onChange={(e) => handleChange('cartonWidthCm', e.target.value ? parseFloat(e.target.value) : null)}
                      placeholder="40"
                      className={cn(
                        'input-field pr-8',
                        errors.cartonWidthCm && 'border-danger focus:border-danger focus:ring-danger/30'
                      )}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted">cm</span>
                  </div>
                  {errors.cartonWidthCm && (
                    <p className="mt-2 text-sm text-danger flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4" />
                      {errors.cartonWidthCm}
                    </p>
                  )}
                </div>

                {/* Height */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Height
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      value={formData.cartonHeightCm ?? ''}
                      onChange={(e) => handleChange('cartonHeightCm', e.target.value ? parseFloat(e.target.value) : null)}
                      placeholder="30"
                      className={cn(
                        'input-field pr-8',
                        errors.cartonHeightCm && 'border-danger focus:border-danger focus:ring-danger/30'
                      )}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted">cm</span>
                  </div>
                  {errors.cartonHeightCm && (
                    <p className="mt-2 text-sm text-danger flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4" />
                      {errors.cartonHeightCm}
                    </p>
                  )}
                </div>
              </div>

              {/* Carton Volume (Read-only) */}
              {calculations.cartonVolumeCm3 !== null && (
                <div className="mt-6 p-4 bg-surface rounded-lg">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-text-muted">Carton Volume</p>
                      <p className="text-sm text-text-primary font-medium">
                        {calculations.cartonVolumeCm3.toLocaleString()} cm³
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-text-muted">CBM</p>
                      <p className="text-sm text-text-primary font-medium">
                        {calculations.cartonVolumeCbm?.toFixed(4)} CBM
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Shipping Cost Card */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-gold-muted">
                  <Truck className="w-5 h-5 text-gold" />
                </div>
                <h2 className="text-lg font-semibold text-text-primary">Shipping Cost</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Shipping Cost per KG */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Shipping Cost (USD/KG) <span className="text-danger">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.shippingCostPerKgUsd || ''}
                      onChange={(e) => handleChange('shippingCostPerKgUsd', parseFloat(e.target.value) || 0)}
                      placeholder="9.40"
                      className={cn(
                        'input-field pl-8 pr-12',
                        errors.shippingCostPerKgUsd && 'border-danger focus:border-danger focus:ring-danger/30'
                      )}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted">/ KG</span>
                  </div>
                  {errors.shippingCostPerKgUsd && (
                    <p className="mt-2 text-sm text-danger flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4" />
                      {errors.shippingCostPerKgUsd}
                    </p>
                  )}
                </div>

                {/* Calculated Shipping Cost */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    International Shipping Cost
                  </label>
                  <div className="input-field bg-charcoal-light cursor-not-allowed">
                    <span className="text-text-primary font-medium">
                      ${calculations.shippingCostUsd.toFixed(2)}
                    </span>
                    <span className="text-text-muted ml-2">
                      ≈ {formatCurrency(calculations.shippingCostDzd, 'DZD')}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-text-muted">
                    {calculations.totalWeightKg.toFixed(2)} KG × ${formData.shippingCostPerKgUsd}/KG
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Cost Summary (Sticky) */}
          <div className="lg:col-span-1">
            <div className="sticky top-6">
              <div className="glass-card p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-lg bg-gold-muted">
                    <DollarSign className="w-5 h-5 text-gold" />
                  </div>
                  <h2 className="text-lg font-semibold text-text-primary">Cost Summary</h2>
                </div>

                <div className="space-y-4">
                  {/* Purchase Price */}
                  <div className="flex justify-between items-center">
                    <span className="text-text-secondary text-sm">Purchase Price / PCS</span>
                    <span className="text-text-primary font-medium">
                      {formatCurrency(formData.purchasePriceRmb, 'RMB')}
                    </span>
                  </div>

                  {/* Quantity */}
                  <div className="flex justify-between items-center">
                    <span className="text-text-secondary text-sm">PCS Wanted</span>
                    <span className="text-text-primary font-medium">{formData.quantity}</span>
                  </div>

                  {/* Total Product Cost */}
                  <div className="pt-4 border-t border-border">
                    <p className="text-xs text-text-muted mb-2">Total Product Cost</p>
                    <div className="space-y-1">
                      <p className="text-text-primary font-medium">
                        {formatCurrency(calculations.productCostDisplay.rmb, 'RMB')}
                      </p>
                      <p className="text-sm text-text-secondary">
                        {formatCurrency(calculations.productCostDisplay.usd, 'USD')}
                      </p>
                      <p className="text-sm text-text-muted">
                        {formatCurrency(calculations.productCostDisplay.dzd, 'DZD')}
                      </p>
                    </div>
                  </div>

                  {/* Total Weight */}
                  <div className="flex justify-between items-center">
                    <span className="text-text-secondary text-sm">Total Weight</span>
                    <span className="text-text-primary font-medium">
                      {calculations.totalWeightKg.toFixed(2)} KG
                    </span>
                  </div>

                  {/* Shipping Cost */}
                  <div className="pt-4 border-t border-border">
                    <p className="text-xs text-text-muted mb-2">Shipping Cost</p>
                    <div className="space-y-1">
                      <p className="text-text-primary font-medium">
                        {formatCurrency(calculations.shippingDisplay.usd, 'USD')}
                      </p>
                      <p className="text-sm text-text-muted">
                        {formatCurrency(calculations.shippingDisplay.dzd, 'DZD')}
                      </p>
                    </div>
                  </div>

                  {/* Total Investment */}
                  <div className="pt-4 border-t border-border">
                    <p className="text-xs text-text-muted mb-2">TOTAL INVESTMENT</p>
                    <div className="space-y-1">
                      <p className="text-xl font-bold text-gold">
                        {formatCurrency(calculations.totalInvestmentDisplay.usd, 'USD')}
                      </p>
                      <p className="text-sm text-text-secondary">
                        {formatCurrency(calculations.totalInvestmentDisplay.dzd, 'DZD')}
                      </p>
                    </div>
                  </div>

                  {/* Landed Cost per PCS */}
                  <div className="pt-4 border-t border-border">
                    <p className="text-xs text-text-muted mb-2">LANDED COST / PCS</p>
                    <div className="space-y-1">
                      <p className="text-xl font-bold text-gold">
                        {formatCurrency(calculations.landedCostPerUnitDisplay.usd, 'USD')}
                      </p>
                      <p className="text-sm text-text-secondary">
                        ≈ {formatCurrency(calculations.landedCostPerUnitDisplay.dzd, 'DZD')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="mt-6 pt-6 border-t border-border">
                  <button
                    type="submit"
                    disabled={isSubmitting || submitSuccess}
                    className={cn(
                      'w-full btn-primary text-base py-3',
                      (isSubmitting || submitSuccess) && 'opacity-70 cursor-not-allowed'
                    )}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Creating Product...
                      </>
                    ) : submitSuccess ? (
                      <>
                        <Check className="w-5 h-5" />
                        Product Created!
                      </>
                    ) : (
                      <>
                        <Package className="w-5 h-5" />
                        Create & Calculate
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Exchange Rates Info */}
              <div className="mt-4 p-4 glass-card">
                <p className="text-xs text-text-muted mb-2">Exchange Rates</p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-text-muted">1 RMB</span>
                    <span className="text-text-secondary">= ${defaultCurrencyRates.rmbToUsd} USD</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">1 USD</span>
                    <span className="text-text-secondary">= {defaultCurrencyRates.usdToDzd} DZD</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">1 RMB</span>
                    <span className="text-text-secondary">= {defaultCurrencyRates.rmbToUsd * defaultCurrencyRates.usdToDzd} DZD</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
