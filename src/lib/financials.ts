/**
 * Centralized Financial Calculation Utility
 * =========================================
 * Single source of truth for all financial metrics across the application.
 *
 * Formulas:
 *   Revenue           = sellingPrice × qualifyingUnitsSold
 *   COGS              = purchaseCost × qualifyingUnitsSold
 *   Gross Profit      = Revenue - COGS
 *   Operating Costs   = ads + packaging + confirmation + other
 *   Net Profit        = Gross Profit - Operating Costs
 *   Gross Margin %    = (Gross Profit / Revenue) × 100
 *   Net Margin %      = (Net Profit / Revenue) × 100
 */

import type { SellingProduct, Order, Expense } from '@/types'

// ─── Types ───────────────────────────────────────────────────
export interface ProductFinancials {
  // Per-unit
  purchaseCostPerUnit: number
  sellingPricePerUnit: number
  grossProfitPerUnit: number

  // Inventory
  unitsPurchased: number
  unitsSold: number
  unitsRemaining: number

  // Totals
  totalPurchaseCost: number
  potentialRevenue: number
  potentialGrossProfit: number
  actualRevenue: number
  actualCOGS: number
  grossProfit: number

  // Operating costs
  advertisingCost: number
  packagingCost: number
  confirmationCost: number
  otherCosts: number
  totalOperatingCosts: number

  // Net
  netProfit: number

  // Margins
  grossMarginPercent: number
  netMarginPercent: number

  // Data completeness
  hasOperatingCosts: boolean
}

export interface DashboardFinancials {
  totalRevenue: number
  totalCOGS: number
  totalGrossProfit: number
  totalOperatingCosts: number
  totalNetProfit: number
  grossMarginPercent: number
  netMarginPercent: number
  totalProducts: number
  activeProducts: number
  totalStock: number
  totalUnitsSold: number
}

// ─── Rounding ────────────────────────────────────────────────
function roundDzd(value: number): number {
  return Math.round(value)
}

function roundPercent(value: number): number {
  return Math.round(value * 10) / 10
}

// ─── Product-Level Financials ────────────────────────────────
export function calculateProductFinancials(
  product: SellingProduct,
  orders: Order[],
  expenses: Expense[],
): ProductFinancials {
  const sellingPrice = product.sellingPriceDzd || 0
  const purchaseCost = product.costPriceDzd || 0
  const unitsPurchased = product.stock || 0

  // Per-unit calculations
  const grossProfitPerUnit = sellingPrice - purchaseCost

  // Order-based metrics — only DELIVERED orders count as actual revenue
  const productOrders = orders.filter(o => o.productId === product.id)
  const deliveredOrders = productOrders.filter(o => o.status === 'DELIVERED')

  const unitsSold = deliveredOrders.length
  const unitsRemaining = Math.max(0, unitsPurchased - unitsSold)

  // Actual revenue = sum of sellingPriceDzd from DELIVERED orders
  const actualRevenue = deliveredOrders.reduce((sum, o) => sum + (o.sellingPriceDzd || 0), 0)

  // COGS = purchase cost per unit × units actually sold
  const actualCOGS = purchaseCost * unitsSold

  // Gross Profit = Revenue - COGS
  const grossProfit = actualRevenue - actualCOGS

  // Potential revenue if all purchased units were sold
  const potentialRevenue = sellingPrice * unitsPurchased
  const potentialGrossProfit = grossProfitPerUnit * unitsPurchased

  // Total purchase cost
  const totalPurchaseCost = purchaseCost * unitsPurchased

  // Operating costs — expenses linked to this product
  const productExpenses = expenses.filter(e => e.productId === product.id)
  const advertisingCost = productExpenses
    .filter(e => e.category === 'ADVERTISING')
    .reduce((sum, e) => sum + (e.amountDzd || 0), 0)
  const packagingCost = productExpenses
    .filter(e => e.category === 'PACKAGING')
    .reduce((sum, e) => sum + (e.amountDzd || 0), 0)
  const confirmationCost = productExpenses
    .filter(e => e.category === 'DELIVERY')
    .reduce((sum, e) => sum + (e.amountDzd || 0), 0)
  const otherCosts = productExpenses
    .filter(e => !['ADVERTISING', 'PACKAGING', 'DELIVERY', 'PRODUCT', 'SHIPPING'].includes(e.category))
    .reduce((sum, e) => sum + (e.amountDzd || 0), 0)

  const totalOperatingCosts = advertisingCost + packagingCost + confirmationCost + otherCosts
  const hasOperatingCosts = totalOperatingCosts > 0

  // Net Profit = Gross Profit - Operating Costs
  const netProfit = grossProfit - totalOperatingCosts

  // Margins (avoid division by zero)
  const grossMarginPercent = actualRevenue > 0 ? roundPercent((grossProfit / actualRevenue) * 100) : 0
  const netMarginPercent = actualRevenue > 0 ? roundPercent((netProfit / actualRevenue) * 100) : 0

  return {
    purchaseCostPerUnit: roundDzd(purchaseCost),
    sellingPricePerUnit: roundDzd(sellingPrice),
    grossProfitPerUnit: roundDzd(grossProfitPerUnit),
    unitsPurchased,
    unitsSold,
    unitsRemaining,
    totalPurchaseCost: roundDzd(totalPurchaseCost),
    potentialRevenue: roundDzd(potentialRevenue),
    potentialGrossProfit: roundDzd(potentialGrossProfit),
    actualRevenue: roundDzd(actualRevenue),
    actualCOGS: roundDzd(actualCOGS),
    grossProfit: roundDzd(grossProfit),
    advertisingCost: roundDzd(advertisingCost),
    packagingCost: roundDzd(packagingCost),
    confirmationCost: roundDzd(confirmationCost),
    otherCosts: roundDzd(otherCosts),
    totalOperatingCosts: roundDzd(totalOperatingCosts),
    netProfit: roundDzd(netProfit),
    grossMarginPercent,
    netMarginPercent,
    hasOperatingCosts,
  }
}

// ─── Dashboard-Level Financials ──────────────────────────────
export function calculateDashboardFinancials(
  products: SellingProduct[],
  orders: Order[],
  expenses: Expense[],
): DashboardFinancials {
  const activeProducts = products.filter(p => p.status === 'ACTIVE')
  const totalStock = products.reduce((sum, p) => sum + (p.stock || 0), 0)

  // Aggregate all delivered orders
  const deliveredOrders = orders.filter(o => o.status === 'DELIVERED')
  const totalRevenue = deliveredOrders.reduce((sum, o) => sum + (o.sellingPriceDzd || 0), 0)
  const totalUnitsSold = deliveredOrders.length

  // Aggregate COGS — sum of (purchaseCost × units) for each delivered order's product
  let totalCOGS = 0
  deliveredOrders.forEach(o => {
    const product = products.find(p => p.id === o.productId)
    if (product) {
      totalCOGS += (product.costPriceDzd || 0) * (o.quantity || 1)
    }
  })

  const totalGrossProfit = totalRevenue - totalCOGS

  // Aggregate operating costs from expenses
  const totalOperatingCosts = expenses.reduce((sum, e) => sum + (e.amountDzd || 0), 0)

  const totalNetProfit = totalGrossProfit - totalOperatingCosts

  const grossMarginPercent = totalRevenue > 0 ? roundPercent((totalGrossProfit / totalRevenue) * 100) : 0
  const netMarginPercent = totalRevenue > 0 ? roundPercent((totalNetProfit / totalRevenue) * 100) : 0

  return {
    totalRevenue: roundDzd(totalRevenue),
    totalCOGS: roundDzd(totalCOGS),
    totalGrossProfit: roundDzd(totalGrossProfit),
    totalOperatingCosts: roundDzd(totalOperatingCosts),
    totalNetProfit: roundDzd(totalNetProfit),
    grossMarginPercent,
    netMarginPercent,
    totalProducts: products.length,
    activeProducts: activeProducts.length,
    totalStock,
    totalUnitsSold,
  }
}

// ─── Formatting ──────────────────────────────────────────────
export function formatDzd(amount: number): string {
  return amount.toLocaleString('fr-DZ') + ' DA'
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}
