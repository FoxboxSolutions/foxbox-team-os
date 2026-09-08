// ============================================================
// FOXBOX TEAM OS — Delivery Service
// Reusable helpers around the existing delivery data
// ============================================================

import { PRICE, DATA, BUREAUX } from './delivery-data'

// ─── Types ──────────────────────────────────────────────────

export interface WilayaInfo {
  code: string
  nameAr: string
  nameCode: string
}

export interface Baladiya {
  name: string
}

export interface DeliveryPrice {
  home: number
  office: number
}

export interface OfficeInfo {
  code: string
  lieu: string
  adresse: string
  tel: string
  transporteur: string
}

// ─── Helpers ────────────────────────────────────────────────

function parseWilayaKey(key: string): { code: string; nameAr: string } {
  const parts = key.split(' ~ ')
  return { code: parts[0] || '', nameAr: parts[1] || '' }
}

// ─── Service Functions ──────────────────────────────────────

export function getWilayas(): WilayaInfo[] {
  return Object.keys(DATA).map(key => {
    const { code, nameAr } = parseWilayaKey(key)
    return { code, nameAr, nameCode: key }
  }).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
}

export function getWilayaByCode(code: string): WilayaInfo | null {
  const key = Object.keys(DATA).find(k => parseWilayaKey(k).code === code)
  if (!key) return null
  const { code: c, nameAr } = parseWilayaKey(key)
  return { code: c, nameAr, nameCode: key }
}

export function getBaladiyas(wilayaCode: string): Baladiya[] {
  const key = Object.keys(DATA).find(k => parseWilayaKey(k).code === wilayaCode)
  if (!key) return []
  return (DATA[key] || []).map(name => ({ name }))
}

export function getDeliveryPrice(wilayaCode: string): DeliveryPrice | null {
  const p = PRICE[wilayaCode]
  if (!p) return null
  return { home: p[0], office: p[1] }
}

export function getOffices(wilayaCode: string): OfficeInfo[] {
  const raw = BUREAUX[wilayaCode]
  if (!raw) return []
  return raw.map(([code, lieu, adresse, tel, transporteur]) => ({
    code, lieu, adresse, tel, transporteur,
  }))
}

export function getOfficeByRef(wilayaCode: string, ref: string): OfficeInfo | null {
  const offices = getOffices(wilayaCode)
  return offices.find(o => o.code === ref) || null
}

export function getDeliveryInfo(
  wilayaCode: string,
  method: 'HOME' | 'OFFICE',
  officeRef?: string
): {
  price: number | null
  priceAvailable: boolean
  office: OfficeInfo | null
  officesAvailable: boolean
} {
  const priceData = getDeliveryPrice(wilayaCode)
  const offices = getOffices(wilayaCode)
  const office = officeRef ? getOfficeByRef(wilayaCode, officeRef) : null

  return {
    price: priceData ? (method === 'HOME' ? priceData.home : priceData.office) : null,
    priceAvailable: priceData !== null,
    officesAvailable: offices.length > 0,
    office,
  }
}

export function formatWilayaDisplay(code: string, nameAr: string): string {
  return `${code} — ${nameAr}`
}

export function formatOfficeDisplay(o: OfficeInfo): string {
  return `${o.code} — ${o.lieu}`
}

export function getAllTransporters(): string[] {
  const set = new Set<string>()
  Object.values(BUREAUX).forEach(offices => {
    offices.forEach(([, , , , transporteur]) => set.add(transporteur))
  })
  return Array.from(set).sort()
}
