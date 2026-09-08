import type { ProductField, CostScenario } from '@/types'

export interface CurrencyRates {
  rmbToUsd: number
  usdToDzd: number
}

export interface ProductCostInput {
  purchasePriceRmb: number
  quantity: number
  weightGrams: number
  shippingCostPerKgUsd: number
  cartonLengthCm?: number
  cartonWidthCm?: number
  cartonHeightCm?: number
  packagingCostUsd?: number
  customsCostUsd?: number
  agentFeeUsd?: number
}

export interface ProductCostResult {
  // Product cost
  totalProductCostRmb: number
  totalProductCostUsd: number
  totalProductCostDzd: number
  
  // Weight
  totalWeightKg: number
  
  // Carton
  cartonVolumeCm3: number | null
  cartonVolumeCbm: number | null
  
  // Shipping
  shippingCostUsd: number
  shippingCostDzd: number
  
  // Other costs
  otherCostsUsd: number
  
  // Totals
  totalInvestmentUsd: number
  totalInvestmentDzd: number
  
  // Per unit
  landedCostPerUnitUsd: number
  landedCostPerUnitDzd: number
  
  // Currency conversions for display
  productCostDisplay: {
    rmb: number
    usd: number
    dzd: number
  }
  shippingDisplay: {
    usd: number
    dzd: number
  }
  totalInvestmentDisplay: {
    usd: number
    dzd: number
  }
  landedCostPerUnitDisplay: {
    usd: number
    dzd: number
  }
}

/**
 * Centralized calculation engine for product costs.
 * This is the single source of truth for all cost calculations.
 */
export function calculateProductCosts(
  input: ProductCostInput,
  rates: CurrencyRates
): ProductCostResult {
  const {
    purchasePriceRmb,
    quantity,
    weightGrams,
    shippingCostPerKgUsd,
    cartonLengthCm,
    cartonWidthCm,
    cartonHeightCm,
    packagingCostUsd = 0,
    customsCostUsd = 0,
    agentFeeUsd = 0,
  } = input

  // Product cost calculations
  const totalProductCostRmb = purchasePriceRmb * quantity
  const totalProductCostUsd = totalProductCostRmb * rates.rmbToUsd
  const totalProductCostDzd = totalProductCostUsd * rates.usdToDzd

  // Weight calculations
  const totalWeightKg = (weightGrams * quantity) / 1000

  // Carton calculations (if dimensions provided)
  let cartonVolumeCm3: number | null = null
  let cartonVolumeCbm: number | null = null
  
  if (cartonLengthCm && cartonWidthCm && cartonHeightCm) {
    cartonVolumeCm3 = cartonLengthCm * cartonWidthCm * cartonHeightCm
    cartonVolumeCbm = cartonVolumeCm3 / 1000000
  }

  // Shipping calculations
  const shippingCostUsd = totalWeightKg * shippingCostPerKgUsd
  const shippingCostDzd = shippingCostUsd * rates.usdToDzd

  // Other costs
  const otherCostsUsd = packagingCostUsd + customsCostUsd + agentFeeUsd

  // Total investment
  const totalInvestmentUsd = totalProductCostUsd + shippingCostUsd + otherCostsUsd
  const totalInvestmentDzd = totalInvestmentUsd * rates.usdToDzd

  // Landed cost per unit
  const landedCostPerUnitUsd = totalInvestmentUsd / quantity
  const landedCostPerUnitDzd = totalInvestmentDzd / quantity

  return {
    totalProductCostRmb,
    totalProductCostUsd,
    totalProductCostDzd,
    totalWeightKg,
    cartonVolumeCm3,
    cartonVolumeCbm,
    shippingCostUsd,
    shippingCostDzd,
    otherCostsUsd,
    totalInvestmentUsd,
    totalInvestmentDzd,
    landedCostPerUnitUsd,
    landedCostPerUnitDzd,
    productCostDisplay: {
      rmb: totalProductCostRmb,
      usd: totalProductCostUsd,
      dzd: totalProductCostDzd,
    },
    shippingDisplay: {
      usd: shippingCostUsd,
      dzd: shippingCostDzd,
    },
    totalInvestmentDisplay: {
      usd: totalInvestmentUsd,
      dzd: totalInvestmentDzd,
    },
    landedCostPerUnitDisplay: {
      usd: landedCostPerUnitUsd,
      dzd: landedCostPerUnitDzd,
    },
  }
}

/**
 * Create ProductField objects from manual input with MANUAL source type
 */
export function createManualProductFields(input: ProductCostInput): ProductField[] {
  const fields: ProductField[] = []

  // Weight field
  fields.push({
    fieldName: 'weight',
    sourceValue: `${input.weightGrams}g`,
    currentValue: `${input.weightGrams}g`,
    sourceType: 'MANUAL',
  })

  // Carton dimensions (if provided)
  if (input.cartonLengthCm && input.cartonWidthCm && input.cartonHeightCm) {
    fields.push({
      fieldName: 'dimensions',
      sourceValue: `${input.cartonLengthCm}x${input.cartonWidthCm}x${input.cartonHeightCm}cm`,
      currentValue: `${input.cartonLengthCm}x${input.cartonWidthCm}x${input.cartonHeightCm}cm`,
      sourceType: 'MANUAL',
    })
  }

  // Shipping cost
  fields.push({
    fieldName: 'shipping_cost_per_kg',
    sourceValue: `${input.shippingCostPerKgUsd}`,
    currentValue: `${input.shippingCostPerKgUsd}`,
    sourceType: 'MANUAL',
  })

  return fields
}

/**
 * Create CostScenario from calculated results
 */
export function createCostScenario(
  productId: string,
  input: ProductCostInput,
  result: ProductCostResult
): CostScenario {
  return {
    id: `cs_${productId}`,
    productId,
    quantity: input.quantity,
    purchaseCostRmb: result.totalProductCostRmb,
    shippingCostUsd: result.shippingCostUsd,
    otherCostUsd: result.otherCostsUsd,
    landedCostUsd: result.totalInvestmentUsd,
    landedCostDzd: result.totalInvestmentDzd,
  }
}

/**
 * Generate a unique product ID
 */
export function generateProductId(): string {
  return `prod_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}
