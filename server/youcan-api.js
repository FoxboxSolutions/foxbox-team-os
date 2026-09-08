// ============================================================
// YouCan API Client — OAuth 2.0 + Auto-Refresh + Custom Fields
// ============================================================

import crypto from 'crypto'

const YOUCAN_AUTH_URL = process.env.YOUCAN_AUTH_URL || 'https://seller-area.youcan.shop/admin/oauth/authorize'
const YOUCAN_TOKEN_URL = process.env.YOUCAN_TOKEN_URL || 'https://api.youcan.shop/oauth/token'
const YOUCAN_API_BASE = process.env.YOUCAN_API_BASE_URL || 'https://api.youcan.shop'

const CLIENT_ID = process.env.YOUCAN_CLIENT_ID || ''
const CLIENT_SECRET = process.env.YOUCAN_CLIENT_SECRET || ''
const REDIRECT_URI = process.env.YOUCAN_REDIRECT_URI || 'http://localhost:3001/api/youcan/oauth/callback'

const SCOPES = [
  'read-orders', 'write-orders', 'read-products',
  'read-customers', 'read-store-details', 'read-resthooks', 'write-resthooks'
]

// ─── In-Memory Token Store (replace with DB in production) ────

let connectionStore = null

export function setConnectionStore(store) {
  connectionStore = store
}

export function getConnection() {
  if (connectionStore) return connectionStore
  // Fallback: read from env (dev mode)
  return {
    id: 'youcan-001',
    accessToken: process.env.YOUCAN_ACCESS_TOKEN || '',
    refreshToken: process.env.YOUCAN_REFRESH_TOKEN || '',
    expiresAt: process.env.YOUCAN_TOKEN_EXPIRES_AT || null,
    clientId: CLIENT_ID,
    status: 'DISCONNECTED',
    storeName: '',
    lastSyncAt: null,
    lastWebhookAt: null,
    ordersSyncedCount: 0,
  }
}

export function saveConnection(data) {
  if (connectionStore) {
    Object.assign(connectionStore, data)
  } else {
    connectionStore = { ...getConnection(), ...data }
  }
}

// ─── OAuth URL Builder ─────────────────────────────────────

export function getAuthorizationUrl(state) {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    state: state || crypto.randomUUID(),
  })
  SCOPES.forEach(s => params.append('scope[]', s))
  return `${YOUCAN_AUTH_URL}?${params.toString()}`
}

// ─── Token Exchange ─────────────────────────────────────────

export async function exchangeCodeForTokens(code) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    code,
  })

  const res = await fetch(YOUCAN_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Token exchange failed: ${res.status} ${err}`)
  }

  const data = await res.json()
  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString()

  saveConnection({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
    tokenType: data.token_type || 'Bearer',
    status: 'CONNECTED',
  })

  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt }
}

// ─── Token Refresh ──────────────────────────────────────────

export async function refreshAccessToken() {
  const conn = getConnection()
  if (!conn.refreshToken) throw new Error('No refresh token available')

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: conn.refreshToken,
  })

  const res = await fetch(YOUCAN_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const err = await res.text()
    saveConnection({ status: 'ERROR', errorMessage: `Refresh failed: ${res.status}` })
    throw new Error(`Token refresh failed: ${res.status} ${err}`)
  }

  const data = await res.json()
  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString()

  saveConnection({
    accessToken: data.access_token,
    refreshToken: data.refresh_token || conn.refreshToken,
    expiresAt,
    status: 'CONNECTED',
    errorMessage: null,
  })

  console.log('[YouCan] Token refreshed successfully')
  return { accessToken: data.access_token, expiresAt }
}

// ─── Get Valid Token (auto-refresh if needed) ───────────────

async function getValidToken() {
  const conn = getConnection()
  if (!conn.accessToken) throw new Error('Not connected to YouCan')

  // Check if token expires within 1 hour
  if (conn.expiresAt) {
    const expiresAt = new Date(conn.expiresAt).getTime()
    const now = Date.now()
    const oneHour = 3600000
    if (expiresAt - now < oneHour) {
      console.log('[YouCan] Token expiring soon, refreshing...')
      const { accessToken } = await refreshAccessToken()
      return accessToken
    }
  }

  return conn.accessToken
}

// ─── API Request Helper ─────────────────────────────────────

export async function youcanRequest(method, path, body = null) {
  const token = await getValidToken()
  const url = `${YOUCAN_API_BASE}${path}`

  const opts = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  }
  if (body && method !== 'GET') {
    opts.body = JSON.stringify(body)
  }

  const res = await fetch(url, opts)

  // Handle 401 → try refresh once
  if (res.status === 401) {
    console.log('[YouCan] Got 401, attempting token refresh...')
    const { accessToken } = await refreshAccessToken()
    opts.headers['Authorization'] = `Bearer ${accessToken}`
    const retryRes = await fetch(url, opts)
    if (!retryRes.ok) {
      const err = await retryRes.text()
      throw new Error(`YouCan API error after refresh: ${retryRes.status} ${err}`)
    }
    return retryRes.json()
  }

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`YouCan API error: ${res.status} ${err}`)
  }

  return res.json()
}

// ─── Test Connection ────────────────────────────────────────

export async function testConnection() {
  try {
    const data = await youcanRequest('GET', '/stores')
    return { success: true, store: data }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

// ─── List Orders (paginated) ────────────────────────────────

export async function listOrders(page = 1, perPage = 50) {
  return youcanRequest('GET', `/orders?page=${page}&per_page=${perPage}`)
}

// ─── Get Single Order ───────────────────────────────────────

export async function getOrder(orderId) {
  return youcanRequest('GET', `/orders/${orderId}`)
}

// ─── Update Order Status ────────────────────────────────────

export async function updateOrderStatus(orderId, status) {
  return youcanRequest('PUT', `/orders/${orderId}/status`, { status })
}

// ─── Custom Fields Parser ───────────────────────────────────

const CUSTOM_FIELD_IDS = {
  wilaya: 'custom_field_fFrOxH7GM72dryHs',
  baladiya: 'custom_field_qWinKYIa7mPhzCoz',
  delivery: 'custom_field_qS2U2G8nm4EoHNsO',
  phone: 'custom_field_ejW2E1CnndIqK5Px',
}

export function parseCustomFields(extraFields = {}) {
  const result = {
    wilaya: null,
    wilayaCode: null,
    baladiya: null,
    deliveryMethod: 'domicile',
    officeCode: null,
    officeName: null,
    phone: null,
  }

  // Parse Wilaya: "44 ~ عين الدفلى"
  const wilayaRaw = extraFields[CUSTOM_FIELD_IDS.wilaya] || ''
  if (wilayaRaw) {
    const parts = wilayaRaw.split('~').map(s => s.trim())
    if (parts.length >= 2) {
      result.wilayaCode = parts[0]
      result.wilaya = parts[1]
    } else {
      result.wilaya = wilayaRaw
    }
  }

  // Parse Baladiya
  result.baladiya = extraFields[CUSTOM_FIELD_IDS.baladiya] || null

  // Parse Delivery method from custom field
  const deliveryRaw = extraFields[CUSTOM_FIELD_IDS.delivery] || ''
  const deliveryLower = deliveryRaw.toLowerCase()
  if (deliveryLower.includes('مكتب') || deliveryLower.includes('stop') || deliveryLower.includes('desk') || deliveryLower.includes('bureau')) {
    result.deliveryMethod = 'bureau'
    // Extract office code: look for pattern like "44B"
    const officeMatch = deliveryRaw.match(/(\d{2}[A-Z])/)
    if (officeMatch) result.officeCode = officeMatch[1]
    // Extract office name from the delivery string
    const nameMatch = deliveryRaw.match(/(?:مكتب|stop\s*desk|bureau)\s*[-–]?\s*(.+?)(?:\s*-\s*|$)/i)
    if (nameMatch) result.officeName = nameMatch[1].trim()
  } else {
    result.deliveryMethod = 'domicile'
  }

  // Parse Phone
  result.phone = extraFields[CUSTOM_FIELD_IDS.phone] || null

  return result
}

// ─── Normalize YouCan Order → FoxBox Format ─────────────────

export function normalizeYouCanOrder(ycOrder) {
  const custom = parseCustomFields(ycOrder.extra_fields || {})

  const items = (ycOrder.products || []).map(p => ({
    externalProductId: p.product_id || null,
    productName: p.name || 'Unknown Product',
    variant: p.variant || null,
    sku: p.sku || null,
    qty: parseInt(p.quantity) || 1,
    unitPrice: parseFloat(p.price) || 0,
    totalPrice: parseFloat(p.total) || parseFloat(p.price) || 0,
  }))

  return {
    externalOrderId: String(ycOrder.id),
    source: 'YOUCAN',
    storeId: ycOrder.store_id || null,
    storeName: ycOrder.store_name || null,
    customerName: ycOrder.customer?.name || ycOrder.shipping_address?.name || null,
    customerEmail: ycOrder.customer?.email || null,
    customerPhone: custom.phone || ycOrder.customer?.phone || null,
    wilaya: custom.wilaya,
    wilayaCode: custom.wilayaCode,
    baladiya: custom.baladiya,
    address: ycOrder.shipping_address?.address || null,
    shippingMethod: custom.deliveryMethod,
    officeCode: custom.officeCode,
    officeName: custom.officeName,
    orderItems: items,
    quantity: items.reduce((sum, i) => sum + i.qty, 0),
    subtotal: parseFloat(ycOrder.subtotal) || 0,
    deliveryFee: parseFloat(ycOrder.shipping_cost) || 0,
    total: parseFloat(ycOrder.total) || 0,
    currency: ycOrder.currency || 'DZD',
    paymentStatus: ycOrder.payment_status || 'pending',
    shippingStatus: ycOrder.fulfillment_status || 'unfulfilled',
    orderStatus: ycOrder.status || 'open',
    youcanCreatedAt: ycOrder.created_at || null,
    youcanUpdatedAt: ycOrder.updated_at || null,
    rawPayload: ycOrder,
  }
}
