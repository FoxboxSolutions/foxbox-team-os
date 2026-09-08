import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency: 'RMB' | 'USD' | 'DZD'): string {
  const formatters = {
    RMB: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'CNY', minimumFractionDigits: 2 }),
    USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }),
    DZD: new Intl.NumberFormat('fr-DZ', { style: 'decimal', minimumFractionDigits: 2 }),
  }
  
  if (currency === 'DZD') {
    return `${formatters.DZD.format(amount)} DA`
  }
  
  return formatters[currency].format(amount)
}

export function convertCurrency(
  amount: number,
  from: 'RMB' | 'USD' | 'DZD',
  to: 'RMB' | 'USD' | 'DZD',
  rates: { rmbToUsd: number; usdToDzd: number }
): number {
  if (from === to) return amount
  
  // Convert to USD first
  let usdAmount: number
  switch (from) {
    case 'RMB':
      usdAmount = amount * rates.rmbToUsd
      break
    case 'DZD':
      usdAmount = amount / rates.usdToDzd
      break
    default:
      usdAmount = amount
  }
  
  // Note: rmbToDzd is available as rates.rmbToUsd * rates.usdToDzd if needed
  
  // Convert from USD to target
  switch (to) {
    case 'RMB':
      return usdAmount / rates.rmbToUsd
    case 'DZD':
      return usdAmount * rates.usdToDzd
    default:
      return usdAmount
  }
}

export function calculateShipping(
  weightKg: number,
  quantity: number,
  ratePerKg: number,
  minimumChargeKg: number = 1
): number {
  const totalWeight = weightKg * quantity
  const chargeableWeight = Math.max(totalWeight, minimumChargeKg)
  return chargeableWeight * ratePerKg
}

export function calculateLandedCost(
  productCostRmb: number,
  shippingCostUsd: number,
  otherCostsUsd: number,
  rates: { rmbToUsd: number; usdToDzd: number }
): {
  totalUsd: number
  totalDzd: number
  unitUsd: number
  unitDzd: number
} {
  const productCostUsd = productCostRmb * rates.rmbToUsd
  const totalUsd = productCostUsd + shippingCostUsd + otherCostsUsd
  const totalDzd = totalUsd * rates.usdToDzd
  
  return {
    totalUsd,
    totalDzd,
    unitUsd: totalUsd,
    unitDzd: totalDzd,
  }
}

export function calculateCODProfitability(params: {
  sellingPriceDzd: number
  deliveryFeeDzd: number
  cpaDzd: number
  confirmationCostDzd: number
  confirmationRate: number
  deliveryRate: number
  returnRate: number
  returnCostDzd: number
  otherCostsDzd: number
  landedCostDzd: number
  fulfillmentCostDzd: number
}): {
  grossMargin: number
  expectedProfitPerOrder: number
  expectedProfitPerDelivered: number
  roi: number
  breakEvenCpa: number
  maxAcceptableCpa: number
} {
  const {
    sellingPriceDzd,
    deliveryFeeDzd,
    cpaDzd,
    confirmationCostDzd,
    confirmationRate,
    deliveryRate,
    returnRate,
    returnCostDzd,
    otherCostsDzd,
    landedCostDzd,
    fulfillmentCostDzd,
  } = params
  
  const grossMargin = sellingPriceDzd - landedCostDzd - deliveryFeeDzd - fulfillmentCostDzd
  const costPerOrder = cpaDzd + (confirmationCostDzd * confirmationRate) + (returnCostDzd * returnRate) + otherCostsDzd
  const expectedProfitPerOrder = (grossMargin * confirmationRate * deliveryRate) - costPerOrder
  
  const successfulDeliveryRate = confirmationRate * deliveryRate
  const expectedProfitPerDelivered = grossMargin - (cpaDzd / successfulDeliveryRate) - fulfillmentCostDzd
  
  const totalCostPerOrder = landedCostDzd + costPerOrder
  const roi = (expectedProfitPerOrder / totalCostPerOrder) * 100
  
  const breakEvenCpa = (grossMargin * confirmationRate * deliveryRate) - (confirmationCostDzd * confirmationRate) - (returnCostDzd * returnRate) - otherCostsDzd
  const maxAcceptableCpa = breakEvenCpa * 0.8
  
  return {
    grossMargin,
    expectedProfitPerOrder,
    expectedProfitPerDelivered,
    roi,
    breakEvenCpa,
    maxAcceptableCpa,
  }
}

export function calculateProductScore(params: {
  margin: number
  weight: number
  returnRisk: number
  perceivedValue: number
}): number {
  const { margin, weight, returnRisk, perceivedValue } = params
  
  // Profitability (30%)
  const marginScore = Math.min(100, Math.max(0, (margin / 50) * 100))
  
  // COD Potential (25%)
  const weightScore = Math.min(100, Math.max(0, 100 - (weight * 2)))
  const codPotential = (weightScore * 0.5 + (100 - returnRisk) * 0.5)
  
  // Market Potential (20%)
  const marketPotential = perceivedValue
  
  // Logistics (10%)
  const logisticsScore = Math.min(100, Math.max(0, 100 - (weight * 1.5)))
  
  const totalScore = 
    (marginScore * 0.3) +
    (codPotential * 0.25) +
    (marketPotential * 0.2) +
    (logisticsScore * 0.1) +
    (50 * 0.15) // Competition placeholder
  
  return Math.round(Math.min(100, Math.max(0, totalScore)))
}
