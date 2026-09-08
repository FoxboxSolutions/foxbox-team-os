// ============================================================
// Webhook Handler — E-com Delivery
// HMAC verification + idempotence + event processing
// ============================================================

import crypto from 'crypto'

const WEBHOOK_SECRET = process.env.ECOM_WEBHOOK_SECRET || ''
const TIMESTAMP_TOLERANCE = 300000 // 5 minutes

// ─── Idempotency Store (in-memory, reset on server restart) ──

const processedEvents = new Map()
const MAX_EVENT_AGE = 86400000 // 24h

function isEventProcessed(eventId) {
  return processedEvents.has(eventId)
}

function markEventProcessed(eventId) {
  processedEvents.set(eventId, Date.now())
  // Cleanup old entries
  if (processedEvents.size > 10000) {
    const now = Date.now()
    for (const [id, time] of processedEvents) {
      if (now - time > MAX_EVENT_AGE) processedEvents.delete(id)
    }
  }
}

// ─── HMAC Verification ─────────────────────────────────────

function verifySignature(rawBody, signatureHeader, timestampHeader) {
  if (!WEBHOOK_SECRET) {
    console.warn('[Webhook] No ECOM_WEBHOOK_SECRET configured — skipping signature verification')
    return true
  }

  if (!signatureHeader || !timestampHeader) {
    return false
  }

  // Check timestamp tolerance
  const timestamp = parseInt(timestampHeader)
  if (isNaN(timestamp)) return false
  const age = Date.now() - timestamp * 1000
  if (Math.abs(age) > TIMESTAMP_TOLERANCE) {
    console.warn(`[Webhook] Timestamp too old/new: ${age}ms difference`)
    return false
  }

  // Compute HMAC
  const payload = `${timestampHeader}.${rawBody}`
  const expected = 'sha256=' + crypto.createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex')

  // Timing-safe comparison
  try {
    return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected))
  } catch {
    return false
  }
}

// ─── Event Processing ──────────────────────────────────────

export function processWebhookEvent(event, deliveries, updateDelivery, addDeliveryHistory) {
  const { id, tracking, situation, id_situation, etat_logistique, id_etat_logistique, commentaire, date, ville } = event

  // Idempotence check
  if (isEventProcessed(id)) {
    return { status: 'already_processed', eventId: id }
  }

  // Find delivery by tracking
  const delivery = deliveries.find(d => d.ecomTracking === tracking)
  if (!delivery) {
    console.warn(`[Webhook] No delivery found for tracking: ${tracking}`)
    markEventProcessed(id)
    return { status: 'delivery_not_found', tracking }
  }

  // Check if this event is newer than what we have
  const eventTime = new Date(date).getTime()
  const lastSync = delivery.ecomLastSyncAt ? new Date(delivery.ecomLastSyncAt).getTime() : 0
  if (eventTime < lastSync) {
    console.warn(`[Webhook] Event older than last sync for ${tracking}, skipping`)
    markEventProcessed(id)
    return { status: 'stale_event', tracking }
  }

  // Update delivery
  const updated = {
    ...delivery,
    ecomSituation: situation,
    ecomSituationId: id_situation,
    ecomEtatLogistique: etat_logistique,
    ecomEtatLogistiqueId: id_etat_logistique,
    ecomLastActionAt: date,
    ecomLastSyncAt: new Date().toISOString(),
    status: mapEcomSituationToStatus(situation, id_situation),
    statusLabel: situation,
    updatedAt: new Date().toISOString(),
  }

  // Extract payment info if present
  if (event.encaisser !== undefined) updated.ecomEncaisser = event.encaisser
  if (event.recouvert !== undefined) updated.ecomRecouvert = event.recouvert
  if (event.tarif_livraison !== undefined) updated.ecomTarifLivraison = event.tarif_livraison
  if (event.tarif_annulation !== undefined) updated.ecomTarifAnnulation = event.tarif_annulation

  updateDelivery(updated)

  // Add history entry
  addDeliveryHistory({
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`,
    deliveryId: delivery.id,
    ecomEventId: id,
    situation,
    situationId: id_situation,
    etatLogistique: etat_logistique,
    etatLogistiqueId: id_etat_logistique,
    commentaire: commentaire || '',
    wilayaCode: ville?.toString() || delivery.wilayaCode,
    receivedAt: new Date().toISOString(),
    source: 'webhook',
  })

  markEventProcessed(id)
  return { status: 'updated', tracking, situation }
}

// ─── Situation → Status Mapping ────────────────────────────

function mapEcomSituationToStatus(situation, id_situation) {
  const s = (situation || '').toLowerCase()
  if (s.includes('livrée') || s.includes('livree')) return 'DELIVERED'
  if (s.includes('annul')) return 'CANCELLED'
  if (s.includes('retour')) return 'RETURNED'
  if (s.includes('encaisser')) return 'COLLECTED'
  if (s.includes('recouvert')) return 'RECOVERED'
  if (s.includes('ne répond') || s.includes('repond')) return 'NO_ANSWER'
  if (s.includes('report')) return 'POSTPONED'
  if (s.includes('dispatcher') || s.includes('dispatch')) return 'DISPATCHED'
  if (s.includes('bureau')) return 'AT_OFFICE'
  if (s.includes('livraison') || s.includes('sortir')) return 'OUT_FOR_DELIVERY'
  if (s.includes('préparation') || s.includes('preparation')) return 'PREPARING'
  if (s.includes('traitement')) return 'PROCESSING'
  if (s.includes('confirm')) return 'CONFIRMED'
  if (s.includes('suivi')) return 'TRACKING'
  return 'IN_PROGRESS'
}

// ─── Express Middleware ─────────────────────────────────────

export function webhookMiddleware(req, res, next) {
  // Capture raw body for HMAC verification
  let rawBody = ''
  req.on('data', chunk => { rawBody += chunk })
  req.on('end', () => {
    req.rawBody = rawBody

    // Verify signature
    const signature = req.headers['x-webhook-signature']
    const timestamp = req.headers['x-webhook-timestamp']

    if (!verifySignature(rawBody, signature, timestamp)) {
      console.warn('[Webhook] Invalid signature — rejecting')
      return res.status(401).json({ error: 'Invalid signature' })
    }

    // Parse body
    try {
      req.body = JSON.parse(rawBody)
    } catch {
      return res.status(400).json({ error: 'Invalid JSON' })
    }

    next()
  })
}

export { isEventProcessed, markEventProcessed }
