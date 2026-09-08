// ============================================================
// YouCan Routes — OAuth, Sync, Webhook, Orders
// ============================================================

import { Router } from 'express'
import {
  getAuthorizationUrl, exchangeCodeForTokens, refreshAccessToken,
  testConnection, listOrders, getOrder, updateOrderStatus,
  normalizeYouCanOrder, getConnection, saveConnection, youcanRequest
} from './youcan-api.js'
import crypto from 'crypto'

const router = Router()

// ─── In-Memory Stores ───────────────────────────────────────

const youcanOrders = []
const webhookLogs = []

function findOrderByExternalId(externalOrderId) {
  return youcanOrders.find(o => o.externalOrderId === externalOrderId)
}

function upsertYoucanOrder(normalized) {
  const existing = findOrderByExternalId(normalized.externalOrderId)
  if (existing) {
    Object.assign(existing, normalized, { updatedAt: new Date().toISOString() })
    return existing
  }
  const order = {
    id: 'yc-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8),
    ...normalized,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  youcanOrders.push(order)
  return order
}

// ─── OAuth Routes ───────────────────────────────────────────

// Step 1: Redirect to YouCan authorization
router.get('/youcan/oauth/connect', (req, res) => {
  if (!process.env.YOUCAN_CLIENT_ID || !process.env.YOUCAN_CLIENT_SECRET) {
    return res.status(500).json({ error: 'YouCan OAuth not configured. Set YOUCAN_CLIENT_ID and YOUCAN_CLIENT_SECRET in .env' })
  }
  const state = crypto.randomUUID()
  const url = getAuthorizationUrl(state)
  res.json({ url, state })
})

// Step 2: OAuth callback
router.get('/youcan/oauth/callback', async (req, res) => {
  const { code, error, state } = req.query

  if (error) {
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/app/settings?youcan=error&message=${encodeURIComponent(error)}`)
  }

  if (!code) {
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/app/settings?youcan=error&message=no_code`)
  }

  try {
    const tokens = await exchangeCodeForTokens(code)

    // Try to get store info
    let storeName = 'YouCan Store'
    try {
      const storeData = await youcanRequest('GET', '/stores')
      if (storeData?.name) storeName = storeData.name
    } catch { /* ignore */ }

    saveConnection({
      id: 'youcan-001',
      storeName,
      status: 'CONNECTED',
      connectedAt: new Date().toISOString(),
      ordersSyncedCount: 0,
    })

    console.log(`[YouCan] OAuth connected: ${storeName}`)
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/app/settings?youcan=connected`)
  } catch (err) {
    console.error('[YouCan] OAuth callback error:', err.message)
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/app/settings?youcan=error&message=${encodeURIComponent(err.message)}`)
  }
})

// Disconnect
router.post('/youcan/oauth/disconnect', (req, res) => {
  saveConnection({
    accessToken: '',
    refreshToken: '',
    expiresAt: null,
    status: 'DISCONNECTED',
    storeName: '',
    errorMessage: null,
  })
  console.log('[YouCan] Disconnected')
  res.json({ success: true })
})

// ─── Connection Status ──────────────────────────────────────

router.get('/youcan/status', (req, res) => {
  const conn = getConnection()
  const hasCredentials = !!(process.env.YOUCAN_CLIENT_ID && process.env.YOUCAN_CLIENT_SECRET)
  const hasToken = !!conn.accessToken

  let tokenStatus = 'none'
  if (hasToken) {
    if (conn.expiresAt) {
      const timeLeft = new Date(conn.expiresAt).getTime() - Date.now()
      if (timeLeft > 0) {
        tokenStatus = timeLeft < 3600000 ? 'expiring_soon' : 'valid'
      } else {
        tokenStatus = 'expired'
      }
    } else {
      tokenStatus = 'valid'
    }
  }

  res.json({
    configured: hasCredentials,
    connected: conn.status === 'CONNECTED' && hasToken,
    status: conn.status,
    storeName: conn.storeName,
    connectedAt: conn.connectedAt,
    lastSyncAt: conn.lastSyncAt,
    lastWebhookAt: conn.lastWebhookAt,
    ordersSyncedCount: conn.ordersSyncedCount,
    tokenStatus,
    expiresAt: conn.expiresAt,
    errorMessage: conn.errorMessage,
    clientId: process.env.YOUCAN_CLIENT_ID ? '***configured***' : 'not configured',
  })
})

// ─── Test Connection ────────────────────────────────────────

router.post('/youcan/test', async (req, res) => {
  const result = await testConnection()
  res.json(result)
})

// ─── Manual Sync Orders ─────────────────────────────────────

router.post('/youcan/sync', async (req, res) => {
  try {
    let page = 1
    let totalSynced = 0
    const maxPages = 100 // Safety limit
    const perPage = 50

    while (page <= maxPages) {
      const data = await listOrders(page, perPage)
      const orders = data.data || data || []

      if (orders.length === 0) break

      for (const ycOrder of orders) {
        const normalized = normalizeYouCanOrder(ycOrder)
        upsertYoucanOrder(normalized)
        totalSynced++
      }

      // Check if there are more pages
      if (data.meta?.current_page >= data.meta?.last_page) break
      page++
    }

    saveConnection({
      lastSyncAt: new Date().toISOString(),
      ordersSyncedCount: youcanOrders.length,
    })

    console.log(`[YouCan] Sync completed: ${totalSynced} orders imported`)
    res.json({ success: true, ordersSynced: totalSynced, totalPages: page })
  } catch (err) {
    console.error('[YouCan] Sync error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─── List Orders (local) ────────────────────────────────────

router.get('/youcan/orders', (req, res) => {
  let orders = [...youcanOrders]

  // Filtering
  const { status, payment_status, shipping_status, wilaya, delivery_method, search, sort, page = 1, limit = 50 } = req.query

  if (status) orders = orders.filter(o => o.orderStatus === status)
  if (payment_status) orders = orders.filter(o => o.paymentStatus === payment_status)
  if (shipping_status) orders = orders.filter(o => o.shippingStatus === shipping_status)
  if (wilaya) orders = orders.filter(o => o.wilaya?.includes(wilaya) || o.wilayaCode === wilaya)
  if (delivery_method) orders = orders.filter(o => o.shippingMethod === delivery_method)

  if (search) {
    const q = search.toLowerCase()
    orders = orders.filter(o =>
      o.externalOrderId?.toLowerCase().includes(q) ||
      o.customerName?.toLowerCase().includes(q) ||
      o.customerPhone?.includes(q) ||
      o.customerEmail?.toLowerCase().includes(q) ||
      o.wilaya?.toLowerCase().includes(q) ||
      o.orderItems?.some(i => i.productName?.toLowerCase().includes(q))
    )
  }

  // Sorting
  if (sort === 'oldest') orders.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  else if (sort === 'amount_asc') orders.sort((a, b) => a.total - b.total)
  else if (sort === 'amount_desc') orders.sort((a, b) => b.total - a.total)
  else if (sort === 'customer') orders.sort((a, b) => (a.customerName || '').localeCompare(b.customerName || ''))
  else orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) // newest first

  // Pagination
  const pageNum = parseInt(page)
  const limitNum = parseInt(limit)
  const offset = (pageNum - 1) * limitNum
  const paginated = orders.slice(offset, offset + limitNum)

  // KPIs
  const today = new Date().toDateString()
  const kpis = {
    totalOrders: youcanOrders.length,
    newToday: youcanOrders.filter(o => new Date(o.createdAt).toDateString() === today).length,
    pending: youcanOrders.filter(o => o.orderStatus === 'open').length,
    confirmed: youcanOrders.filter(o => o.orderStatus === 'confirmed').length,
    cancelled: youcanOrders.filter(o => o.orderStatus === 'cancelled').length,
    totalRevenue: youcanOrders.reduce((sum, o) => sum + (o.total || 0), 0),
  }

  res.json({
    orders: paginated,
    total: orders.length,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(orders.length / limitNum),
    kpis,
  })
})

// ─── Get Single Order ───────────────────────────────────────

router.get('/youcan/orders/:id', (req, res) => {
  const order = youcanOrders.find(o => o.id === req.params.id || o.externalOrderId === req.params.id)
  if (!order) return res.status(404).json({ error: 'Order not found' })
  res.json(order)
})

// ─── Update Order Status via YouCan API ─────────────────────

router.put('/youcan/orders/:id/status', async (req, res) => {
  const { status } = req.body
  const order = youcanOrders.find(o => o.id === req.params.id || o.externalOrderId === req.params.id)
  if (!order) return res.status(404).json({ error: 'Order not found' })

  try {
    await updateOrderStatus(order.externalOrderId, status)
    order.orderStatus = status
    order.updatedAt = new Date().toISOString()
    console.log(`[YouCan] Order ${order.externalOrderId} status updated to ${status}`)
    res.json({ success: true, order })
  } catch (err) {
    console.error(`[YouCan] Failed to update order ${order.externalOrderId}:`, err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─── Webhook Receiver ───────────────────────────────────────

router.post('/webhooks/youcan/orders', (req, res) => {
  const startTime = Date.now()
  const payload = req.body
  const eventId = payload.id || payload.event_id || `wh-${Date.now().toString(36)}`
  const eventType = payload.event || payload.type || 'unknown'

  // Log webhook
  const log = {
    id: 'wl-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8),
    eventId,
    eventType,
    receivedAt: new Date().toISOString(),
    orderId: null,
    status: 'RECEIVED',
    error: null,
    processingTimeMs: 0,
  }

  try {
    // Extract order from payload
    const ycOrder = payload.data || payload.order || payload
    if (!ycOrder || !ycOrder.id) {
      log.status = 'FAILED'
      log.error = 'No order data in webhook payload'
      webhookLogs.push(log)
      return res.status(400).json({ error: 'Invalid payload' })
    }

    log.orderId = String(ycOrder.id)

    // Check for duplicate
    const existing = findOrderByExternalId(String(ycOrder.id))
    if (existing && existing.rawPayload?.updated_at === ycOrder.updated_at) {
      log.status = 'DUPLICATE'
      log.processingTimeMs = Date.now() - startTime
      webhookLogs.push(log)
      return res.json({ status: 'duplicate', orderId: ycOrder.id })
    }

    // Normalize and upsert
    const normalized = normalizeYouCanOrder(ycOrder)
    const saved = upsertYoucanOrder(normalized)

    // Update connection stats
    const conn = getConnection()
    saveConnection({ lastWebhookAt: new Date().toISOString() })

    log.status = 'PROCESSED'
    log.processingTimeMs = Date.now() - startTime
    webhookLogs.push(log)

    console.log(`[YouCan Webhook] Order ${ycOrder.id} ${existing ? 'updated' : 'created'} (${log.processingTimeMs}ms)`)
    res.json({ status: 'ok', orderId: ycOrder.id, action: existing ? 'updated' : 'created' })
  } catch (err) {
    log.status = 'FAILED'
    log.error = err.message
    log.processingTimeMs = Date.now() - startTime
    webhookLogs.push(log)
    console.error('[YouCan Webhook] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─── Webhook Logs ───────────────────────────────────────────

router.get('/youcan/webhook-logs', (req, res) => {
  const { page = 1, limit = 50 } = req.query
  const pageNum = parseInt(page)
  const limitNum = parseInt(limit)
  const offset = (pageNum - 1) * limitNum
  const sorted = [...webhookLogs].sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt))
  res.json({
    logs: sorted.slice(offset, offset + limitNum),
    total: webhookLogs.length,
    page: pageNum,
    totalPages: Math.ceil(webhookLogs.length / limitNum),
  })
})

// ─── Refresh Token Manually ─────────────────────────────────

router.post('/youcan/refresh-token', async (req, res) => {
  try {
    const result = await refreshAccessToken()
    res.json({ success: true, expiresAt: result.expiresAt })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
