// ============================================================
// E-com Delivery API v2 — Service
// All communication with E-com Delivery API
// ============================================================

const BASE_URL = process.env.ECOM_API_BASE_URL || 'https://ecom-dz.com/api_v2'
const API_KEY = process.env.ECOM_API_KEY || ''
const API_TOKEN = process.env.ECOM_API_TOKEN || ''

const HEADERS = {
  'X-API-Key': API_KEY,
  'X-API-Token': API_TOKEN,
  'Content-Type': 'application/json',
}

// ─── Rate Limiting ─────────────────────────────────────────

const rateLimiter = {
  requests: [],
  MAX_PER_MINUTE: 45,
  MAX_PER_HOUR: 1800,
  MAX_PER_DAY: 18000,

  canMakeRequest() {
    const now = Date.now()
    this.requests = this.requests.filter(t => now - t < 86400000)
    const lastMinute = this.requests.filter(t => now - t < 60000).length
    const lastHour = this.requests.filter(t => now - t < 3600000).length
    const lastDay = this.requests.length
    return lastMinute < this.MAX_PER_MINUTE && lastHour < this.MAX_PER_HOUR && lastDay < this.MAX_PER_DAY
  },

  recordRequest() {
    this.requests.push(Date.now())
  },

  getRetryAfterMs() {
    const now = Date.now()
    const lastMinute = this.requests.filter(t => now - t < 60000).length
    if (lastMinute >= this.MAX_PER_MINUTE) return 60000 - (now - Math.min(...this.requests.filter(t => now - t < 60000)))
    return 0
  },
}

// ─── Cache ─────────────────────────────────────────────────

const cache = new Map()
const CACHE_TTL = {
  wilayas: 86400000,
  communes: 86400000,
  stopdesks: 86400000,
  situations: 3600000,
  etatsLogistiques: 3600000,
  tarifs: 3600000,
  produits: 3600000,
}

function getCached(key) {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.time > (CACHE_TTL[key.split(':')[0]] || 60000)) {
    cache.delete(key)
    return null
  }
  return entry.data
}

function setCache(key, data) {
  cache.set(key, { data, time: Date.now() })
}

// ─── HTTP Client ───────────────────────────────────────────

async function apiRequest(method, path, body = null, retries = 2) {
  if (!rateLimiter.canMakeRequest()) {
    const retryAfter = rateLimiter.getRetryAfterMs()
    if (retries > 0) {
      await new Promise(r => setTimeout(r, Math.min(retryAfter, 5000)))
      return apiRequest(method, path, body, retries - 1)
    }
    throw new Error('Rate limit exceeded. Try again later.')
  }

  const url = `${BASE_URL}${path}`
  const options = {
    method,
    headers: HEADERS,
  }
  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    options.body = JSON.stringify(body)
  }

  rateLimiter.recordRequest()
  const startTime = Date.now()

  try {
    const res = await fetch(url, options)
    const elapsed = Date.now() - startTime

    if (res.status === 429) {
      if (retries > 0) {
        const retryAfter = parseInt(res.headers.get('retry-after') || '5') * 1000
        await new Promise(r => setTimeout(r, Math.min(retryAfter, 10000)))
        return apiRequest(method, path, body, retries - 1)
      }
      throw new Error('Rate limit (429) exceeded after retries')
    }

    const text = await res.text()
    let data
    try { data = JSON.parse(text) } catch { data = { raw: text } }

    logRequest(method, path, res.status, elapsed, data)

    if (!res.ok && res.status !== 200 && res.status !== 201) {
      throw new Error(`E-com API error ${res.status}: ${data.erreur || data.message || text}`)
    }

    return data
  } catch (err) {
    const elapsed = Date.now() - startTime
    logRequest(method, path, 0, elapsed, { error: err.message })
    throw err
  }
}

// ─── Request Logging ───────────────────────────────────────

const requestLogs = []
const MAX_LOGS = 500

function logRequest(method, path, status, elapsed, data) {
  requestLogs.unshift({
    method,
    path,
    status,
    elapsed,
    timestamp: new Date().toISOString(),
    success: status >= 200 && status < 300,
    error: data?.erreur || data?.error || null,
  })
  if (requestLogs.length > MAX_LOGS) requestLogs.length = MAX_LOGS
}

// ─── API Methods ───────────────────────────────────────────

export async function testConnection() {
  return apiRequest('GET', '/test')
}

export async function getWilayas() {
  const cached = getCached('wilayas')
  if (cached) return cached
  const data = await apiRequest('GET', '/wilayas')
  setCache('wilayas', data)
  return data
}

export async function getCommunes(wilayaId) {
  const key = `communes:${wilayaId}`
  const cached = getCached(key)
  if (cached) return cached
  const data = await apiRequest('GET', `/communes?id_wilaya=${wilayaId}`)
  setCache(key, data)
  return data
}

export async function getStopdesks(wilayaId) {
  const key = `stopdesks:${wilayaId}`
  const cached = getCached(key)
  if (cached) return cached
  const data = await apiRequest('GET', `/stopdesks?id_wilaya=${wilayaId}`)
  setCache(key, data)
  return data
}

export async function getSituations() {
  const cached = getCached('situations')
  if (cached) return cached
  const data = await apiRequest('GET', '/situations')
  setCache('situations', data)
  return data
}

export async function getEtatsLogistiques() {
  const cached = getCached('etatsLogistiques')
  if (cached) return cached
  const data = await apiRequest('GET', '/etats-logistiques')
  setCache('etatsLogistiques', data)
  return data
}

export async function getTarifs() {
  const cached = getCached('tarifs')
  if (cached) return cached
  const data = await apiRequest('GET', '/tarifs')
  setCache('tarifs', data)
  return data
}

export async function createColis(payload) {
  return apiRequest('POST', '/colis', payload)
}

export async function getColis(params = {}) {
  const query = new URLSearchParams()
  if (params.page) query.set('page', params.page)
  if (params.limit) query.set('limit', params.limit)
  if (params.type_date) query.set('type_date', params.type_date)
  if (params.date_debut) query.set('date_debut', params.date_debut)
  if (params.date_fin) query.set('date_fin', params.date_fin)
  const qs = query.toString()
  return apiRequest('GET', `/colis${qs ? '?' + qs : ''}`)
}

export async function getColisByTracking(tracking) {
  return apiRequest('GET', `/colis/${tracking}`)
}

export async function getColisStatuts(trackings) {
  return apiRequest('POST', '/colis/statuts', { trackings })
}

export async function getHistorique(trackings) {
  return apiRequest('POST', '/colis/historique', { trackings })
}

export async function updateColis(tracking, payload) {
  return apiRequest('PUT', `/colis/${tracking}`, payload)
}

export async function confirmColis(trackings) {
  return apiRequest('POST', '/colis/confirmer', { trackings })
}

export async function deleteColis(tracking) {
  return apiRequest('DELETE', `/colis/${tracking}`)
}

export async function getBordereau(tracking, format = '10x13') {
  return apiRequest('GET', `/colis/${tracking}/bordereau?format=${format}`)
}

export async function getBordereaux(trackings) {
  return apiRequest('POST', '/colis/bordereaux', { trackings })
}

export async function getProduits() {
  const cached = getCached('produits')
  if (cached) return cached
  const data = await apiRequest('GET', '/produits')
  setCache('produits', data)
  return data
}

export async function createProduit(payload) {
  cache.delete('produits')
  return apiRequest('POST', '/produits', payload)
}

export async function updateProduit(id, payload) {
  cache.delete('produits')
  return apiRequest('PUT', `/produits/${id}`, payload)
}

export async function getResume() {
  return apiRequest('GET', '/colis/resume')
}

export async function getPaiements() {
  return apiRequest('GET', '/paiements')
}

export async function getPaiement(id) {
  return apiRequest('GET', `/paiements/${id}`)
}

export async function getWebhook() {
  return apiRequest('GET', '/webhook')
}

export async function configureWebhook(payload) {
  return apiRequest('PUT', '/webhook', payload)
}

export async function deleteWebhook() {
  return apiRequest('DELETE', '/webhook')
}

export async function testWebhook() {
  return apiRequest('POST', '/webhook/test')
}

export async function getWebhookEvents() {
  return apiRequest('GET', '/webhook/events')
}

export async function getWebhookLogs() {
  return apiRequest('GET', '/webhook/logs')
}

export function getRequestLogs() {
  return requestLogs
}

export function isConfigured() {
  return !!(API_KEY && API_TOKEN && BASE_URL)
}
