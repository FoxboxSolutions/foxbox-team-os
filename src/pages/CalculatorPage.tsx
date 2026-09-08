import { useState } from 'react'
import { Calculator as CalcIcon, TrendingUp, DollarSign, Package, Truck } from 'lucide-react'
import { defaultCurrencyRates, shippingProfiles } from '@/lib/mock-data'
import { cn, formatCurrency, convertCurrency } from '@/lib/utils'

interface CalculatorInputs {
  // Product
  unitPriceRmb: number
  quantity: number
  weightKg: number
  
  // Shipping
  shippingProfileId: string
  shippingCost: number
  
  // Other
  packagingCost: number
  customsCost: number
  agentFee: number
  
  // COD
  sellingPriceDzd: number
  deliveryFeeDzd: number
  cpaDzd: number
  confirmationCostDzd: number
  confirmationRate: number
  deliveryRate: number
  returnRate: number
  returnCostDzd: number
}

export function CalculatorPage() {
  const rates = defaultCurrencyRates
  
  const [inputs, setInputs] = useState<CalculatorInputs>({
    unitPriceRmb: 25,
    quantity: 100,
    weightKg: 0.2,
    shippingProfileId: '1',
    shippingCost: 0,
    packagingCost: 10,
    customsCost: 0,
    agentFee: 15,
    sellingPriceDzd: 4500,
    deliveryFeeDzd: 600,
    cpaDzd: 700,
    confirmationCostDzd: 200,
    confirmationRate: 0.80,
    deliveryRate: 0.75,
    returnRate: 0.25,
    returnCostDzd: 400,
  })

  const selectedProfile = shippingProfiles.find(p => p.id === inputs.shippingProfileId)
  
  // Calculate shipping
  const totalWeightKg = inputs.weightKg * inputs.quantity
  const shippingCost = selectedProfile 
    ? Math.max(totalWeightKg, selectedProfile.minimumCharge) * selectedProfile.rate
    : inputs.shippingCost

  // Cost calculations
  const productCostRmb = inputs.unitPriceRmb * inputs.quantity
  const productCostUsd = convertCurrency(productCostRmb, 'RMB', 'USD', rates)
  const totalCostUsd = productCostUsd + shippingCost + inputs.packagingCost + inputs.customsCost + inputs.agentFee
  const totalCostDzd = totalCostUsd * rates.usdToDzd
  const unitCostUsd = totalCostUsd / inputs.quantity
  const unitCostDzd = totalCostDzd / inputs.quantity

  // COD calculations
  const landedCostDzd = unitCostDzd
  const grossMargin = inputs.sellingPriceDzd - landedCostDzd - inputs.deliveryFeeDzd
  const costPerOrder = inputs.cpaDzd + (inputs.confirmationCostDzd * inputs.confirmationRate) + (inputs.returnCostDzd * inputs.returnRate)
  const expectedProfit = (grossMargin * inputs.confirmationRate * inputs.deliveryRate) - costPerOrder
  const roi = totalCostDzd > 0 ? (expectedProfit * inputs.quantity / totalCostDzd) * 100 : 0
  const breakEvenCpa = (grossMargin * inputs.confirmationRate * inputs.deliveryRate) - (inputs.confirmationCostDzd * inputs.confirmationRate) - (inputs.returnCostDzd * inputs.returnRate)

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Calculator</h1>
        <p className="text-text-secondary mt-1">Calculate product costs and COD profitability</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Inputs */}
        <div className="space-y-6">
          {/* Product Costs */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-gold-muted">
                <Package className="w-5 h-5 text-gold" />
              </div>
              <h2 className="text-lg font-semibold text-text-primary">Product Costs</h2>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-text-muted block mb-1">Unit Price (RMB)</label>
                <input
                  type="number"
                  value={inputs.unitPriceRmb}
                  onChange={(e) => setInputs({ ...inputs, unitPriceRmb: Number(e.target.value) })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">Quantity</label>
                <input
                  type="number"
                  value={inputs.quantity}
                  onChange={(e) => setInputs({ ...inputs, quantity: Number(e.target.value) })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">Unit Weight (kg)</label>
                <input
                  type="number"
                  step="0.01"
                  value={inputs.weightKg}
                  onChange={(e) => setInputs({ ...inputs, weightKg: Number(e.target.value) })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">Packaging ($)</label>
                <input
                  type="number"
                  value={inputs.packagingCost}
                  onChange={(e) => setInputs({ ...inputs, packagingCost: Number(e.target.value) })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">Customs/Tax ($)</label>
                <input
                  type="number"
                  value={inputs.customsCost}
                  onChange={(e) => setInputs({ ...inputs, customsCost: Number(e.target.value) })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">Agent Fee ($)</label>
                <input
                  type="number"
                  value={inputs.agentFee}
                  onChange={(e) => setInputs({ ...inputs, agentFee: Number(e.target.value) })}
                  className="input-field"
                />
              </div>
            </div>
          </div>

          {/* Shipping */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-gold-muted">
                <Truck className="w-5 h-5 text-gold" />
              </div>
              <h2 className="text-lg font-semibold text-text-primary">Shipping</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs text-text-muted block mb-1">Shipping Profile</label>
                <select
                  value={inputs.shippingProfileId}
                  onChange={(e) => setInputs({ ...inputs, shippingProfileId: e.target.value })}
                  className="input-field"
                >
                  {shippingProfiles.map(profile => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name} (${profile.rate}/{profile.rateUnit})
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="bg-surface rounded-lg p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Total Weight</span>
                  <span className="text-text-primary">{totalWeightKg.toFixed(2)} kg</span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-text-muted">Shipping Cost</span>
                  <span className="text-gold font-medium">${shippingCost.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* COD Assumptions */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-gold-muted">
                <TrendingUp className="w-5 h-5 text-gold" />
              </div>
              <h2 className="text-lg font-semibold text-text-primary">COD Assumptions</h2>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-text-muted block mb-1">Selling Price (DZD)</label>
                <input
                  type="number"
                  value={inputs.sellingPriceDzd}
                  onChange={(e) => setInputs({ ...inputs, sellingPriceDzd: Number(e.target.value) })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">Delivery Fee (DZD)</label>
                <input
                  type="number"
                  value={inputs.deliveryFeeDzd}
                  onChange={(e) => setInputs({ ...inputs, deliveryFeeDzd: Number(e.target.value) })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">CPA (DZD)</label>
                <input
                  type="number"
                  value={inputs.cpaDzd}
                  onChange={(e) => setInputs({ ...inputs, cpaDzd: Number(e.target.value) })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">Confirmation Cost (DZD)</label>
                <input
                  type="number"
                  value={inputs.confirmationCostDzd}
                  onChange={(e) => setInputs({ ...inputs, confirmationCostDzd: Number(e.target.value) })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">Confirmation Rate (%)</label>
                <input
                  type="number"
                  value={inputs.confirmationRate * 100}
                  onChange={(e) => setInputs({ ...inputs, confirmationRate: Number(e.target.value) / 100 })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">Delivery Rate (%)</label>
                <input
                  type="number"
                  value={inputs.deliveryRate * 100}
                  onChange={(e) => setInputs({ ...inputs, deliveryRate: Number(e.target.value) / 100 })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">Return Rate (%)</label>
                <input
                  type="number"
                  value={inputs.returnRate * 100}
                  onChange={(e) => setInputs({ ...inputs, returnRate: Number(e.target.value) / 100 })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">Return Cost (DZD)</label>
                <input
                  type="number"
                  value={inputs.returnCostDzd}
                  onChange={(e) => setInputs({ ...inputs, returnCostDzd: Number(e.target.value) })}
                  className="input-field"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Results */}
        <div className="space-y-6">
          {/* Cost Summary */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-gold-muted">
                <DollarSign className="w-5 h-5 text-gold" />
              </div>
              <h2 className="text-lg font-semibold text-text-primary">Cost Summary</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-text-muted">Product Cost ({inputs.quantity} units)</span>
                <span className="text-text-primary">{formatCurrency(productCostRmb, 'RMB')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Shipping</span>
                <span className="text-text-primary">${shippingCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Packaging</span>
                <span className="text-text-primary">${inputs.packagingCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Customs/Tax</span>
                <span className="text-text-primary">${inputs.customsCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Agent Fee</span>
                <span className="text-text-primary">${inputs.agentFee.toFixed(2)}</span>
              </div>
              
              <div className="border-t border-border pt-4">
                <div className="flex justify-between">
                  <span className="text-text-primary font-medium">Total Investment</span>
                  <div className="text-right">
                    <p className="text-gold font-bold text-lg">{formatCurrency(totalCostUsd, 'USD')}</p>
                    <p className="text-sm text-text-muted">{formatCurrency(totalCostDzd, 'DZD')}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-gold-muted rounded-lg p-4 mt-4">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Landed Cost per Unit</span>
                  <div className="text-right">
                    <p className="text-gold font-bold text-xl">{formatCurrency(unitCostUsd, 'USD')}</p>
                    <p className="text-sm text-text-muted">{formatCurrency(unitCostDzd, 'DZD')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* COD Results */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-gold-muted">
                <CalcIcon className="w-5 h-5 text-gold" />
              </div>
              <h2 className="text-lg font-semibold text-text-primary">COD Economics</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-text-muted">Gross Margin</span>
                <span className="text-gold font-medium">{formatCurrency(grossMargin, 'DZD')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Cost per Order</span>
                <span className="text-text-primary">{formatCurrency(costPerOrder, 'DZD')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Break-even CPA</span>
                <span className="text-text-primary">{formatCurrency(breakEvenCpa, 'DZD')}</span>
              </div>
              
              <div className="border-t border-border pt-4">
                <div className="flex justify-between">
                  <span className="text-text-primary font-medium">Expected Profit/Order</span>
                  <span className={cn(
                    'font-bold text-xl',
                    expectedProfit > 0 ? 'text-success' : 'text-danger'
                  )}>
                    {formatCurrency(expectedProfit, 'DZD')}
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="bg-surface rounded-lg p-4 text-center">
                  <p className="text-xs text-text-muted mb-1">ROI</p>
                  <p className={cn(
                    'text-2xl font-bold',
                    roi > 0 ? 'text-success' : 'text-danger'
                  )}>
                    {roi.toFixed(1)}%
                  </p>
                </div>
                <div className="bg-surface rounded-lg p-4 text-center">
                  <p className="text-xs text-text-muted mb-1">Expected Profit</p>
                  <p className={cn(
                    'text-2xl font-bold',
                    expectedProfit > 0 ? 'text-success' : 'text-danger'
                  )}>
                    {formatCurrency(expectedProfit * inputs.quantity, 'DZD')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
