// ============================================================
// Foxbox Team — E-com Delivery Backend Server
// Express server handling E-com API + Webhooks
// ============================================================

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import crypto from 'crypto'
import * as ecom from './services/ecomDelivery.js'
import { webhookMiddleware, processWebhookEvent } from './webhook.js'
import youcanRoutes from './youcan-routes.js'

const app = express()
const PORT = process.env.PORT || 3001

// ─── Middleware ─────────────────────────────────────────────

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type'],
}))

// IMPORTANT: Raw body for webhook HMAC verification
app.use('/api/webhooks', express.raw({ type: 'application/json' }))
app.use(express.json())

// ─── In-memory stores (would be DB in production) ──────────

let deliveries = []
let deliveryHistory = []
let webhookEvents = []

function updateDelivery(updated) {
  const idx = deliveries.findIndex(d => d.id === updated.id)
  if (idx >= 0) deliveries[idx] = updated
}

function addDeliveryHistory(entry) {
  deliveryHistory.push(entry)
}

function findDeliveryByTracking(tracking) {
  return deliveries.find(d => d.ecomTracking === tracking)
}

// ─── Health & Connection ───────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    ecomConfigured: ecom.isConfigured(),
    timestamp: new Date().toISOString(),
  })
})

app.get('/api/ecom/test', async (req, res) => {
  try {
    const result = await ecom.testConnection()
    res.json({ ok: true, data: result })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ─── E-com Reference Data (cached) ─────────────────────────

app.get('/api/ecom/wilayas', async (req, res) => {
  try {
    const data = await ecom.getWilayas()
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/ecom/communes/:wilayaId', async (req, res) => {
  try {
    const data = await ecom.getCommunes(req.params.wilayaId)
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/ecom/stopdesks/:wilayaId', async (req, res) => {
  try {
    const data = await ecom.getStopdesks(req.params.wilayaId)
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/ecom/situations', async (req, res) => {
  try {
    const data = await ecom.getSituations()
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/ecom/etats-logistiques', async (req, res) => {
  try {
    const data = await ecom.getEtatsLogistiques()
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/ecom/tarifs', async (req, res) => {
  try {
    const data = await ecom.getTarifs()
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── Create Colis from Foxbox Confirmation ────────────────

app.post('/api/ecom/create-from-confirmation', async (req, res) => {
  try {
    const c = req.body
    // Map Foxbox Confirmation → E-com Delivery API payload
    const payload = {
      nom_prenom: c.fullName,
      telephone: c.phone,
      telephone2: c.phoneAlt || '',
      id_wilaya: parseInt(c.wilayaCode) || 0,
      commune: c.baladiya || '',
      adresse: c.address || '',
      type_livraison: c.shippingMethod === 'HOME' ? 'Domicile' : 'Stopdesk',
      id_stopdesk: c.officeRef || '',
      note: c.notes || '',
      produit: c.productName || c.product || '',
      quantite: c.quantity || 1,
      prix_total: c.total || 0,
      prix_livraison: c.deliveryPrice || 0,
      id_externe: c.id || '',
    }
    const result = await ecom.createColis(payload)
    res.json(result)
  } catch (err) {
    const status = err.message?.includes('429') ? 429 : 500
    res.status(status).json({ error: err.message })
  }
})

// ─── Colis CRUD ────────────────────────────────────────────

app.post('/api/ecom/colis', async (req, res) => {
  try {
    const result = await ecom.createColis(req.body)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/ecom/colis', async (req, res) => {
  try {
    const data = await ecom.getColis(req.query)
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/ecom/colis/:tracking', async (req, res) => {
  try {
    const data = await ecom.getColisByTracking(req.params.tracking)
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.put('/api/ecom/colis/:tracking', async (req, res) => {
  try {
    const data = await ecom.updateColis(req.params.tracking, req.body)
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/ecom/colis/confirmer', async (req, res) => {
  try {
    const data = await ecom.confirmColis(req.body.trackings)
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.delete('/api/ecom/colis/:tracking', async (req, res) => {
  try {
    const data = await ecom.deleteColis(req.params.tracking)
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/ecom/colis/statuts', async (req, res) => {
  try {
    const data = await ecom.getColisStatuts(req.body.trackings)
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/ecom/colis/historique', async (req, res) => {
  try {
    const data = await ecom.getHistorique(req.body.trackings)
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/ecom/colis/resume', async (req, res) => {
  try {
    const data = await ecom.getResume()
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── Bordereaux ────────────────────────────────────────────

app.get('/api/ecom/colis/:tracking/bordereau', async (req, res) => {
  try {
    const format = req.query.format || '10x13'
    const data = await ecom.getBordereau(req.params.tracking, format)
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/ecom/colis/bordereaux', async (req, res) => {
  try {
    const data = await ecom.getBordereaux(req.body.trackings)
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── Produits ──────────────────────────────────────────────

app.get('/api/ecom/produits', async (req, res) => {
  try {
    const data = await ecom.getProduits()
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/ecom/produits', async (req, res) => {
  try {
    const data = await ecom.createProduit(req.body)
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.put('/api/ecom/produits/:id', async (req, res) => {
  try {
    const data = await ecom.updateProduit(req.params.id, req.body)
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── Paiements ─────────────────────────────────────────────

app.get('/api/ecom/paiements', async (req, res) => {
  try {
    const data = await ecom.getPaiements()
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/ecom/paiements/:id', async (req, res) => {
  try {
    const data = await ecom.getPaiement(req.params.id)
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── Webhook Configuration ─────────────────────────────────

app.get('/api/ecom/webhook', async (req, res) => {
  try {
    const data = await ecom.getWebhook()
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.put('/api/ecom/webhook', async (req, res) => {
  try {
    const data = await ecom.configureWebhook(req.body)
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.delete('/api/ecom/webhook', async (req, res) => {
  try {
    const data = await ecom.deleteWebhook()
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/ecom/webhook/test', async (req, res) => {
  try {
    const data = await ecom.testWebhook()
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/ecom/webhook/events', async (req, res) => {
  try {
    const data = await ecom.getWebhookEvents()
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/ecom/webhook/logs', async (req, res) => {
  try {
    const data = await ecom.getWebhookLogs()
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── Webhook Receiver (POST) ───────────────────────────────

app.post('/api/webhooks/ecom-delivery', webhookMiddleware, (req, res) => {
  const event = req.body

  console.log(`[Webhook] Received: ${event.id} — tracking: ${event.tracking} — situation: ${event.situation}`)

  // Process event
  const result = processWebhookEvent(event, deliveries, updateDelivery, addDeliveryHistory)

  // Store webhook event
  webhookEvents.unshift({
    id: event.id,
    tracking: event.tracking,
    situation: event.situation,
    receivedAt: new Date().toISOString(),
    result: result.status,
  })
  if (webhookEvents.length > 1000) webhookEvents.length = 1000

  console.log(`[Webhook] Result: ${result.status}`)

  // Always respond 200 quickly
  res.status(200).json({ received: true })
})

// ─── Internal Sync Endpoints ───────────────────────────────

// Store deliveries (called from frontend when creating/syncing)
app.post('/api/deliveries', (req, res) => {
  const delivery = req.body
  const idx = deliveries.findIndex(d => d.id === delivery.id)
  if (idx >= 0) deliveries[idx] = delivery
  else deliveries.push(delivery)
  res.json({ ok: true })
})

app.get('/api/deliveries', (req, res) => {
  res.json(deliveries)
})

app.get('/api/deliveries/:id', (req, res) => {
  const d = deliveries.find(d => d.id === req.params.id)
  if (!d) return res.status(404).json({ error: 'Not found' })
  res.json(d)
})

app.post('/api/deliveries/:id/history', (req, res) => {
  addDeliveryHistory({ ...req.body, deliveryId: req.params.id })
  res.json({ ok: true })
})

app.get('/api/deliveries/:id/history', (req, res) => {
  const history = deliveryHistory.filter(h => h.deliveryId === req.params.id)
  res.json(history.sort((a, b) => new Date(a.receivedAt) - new Date(b.receivedAt)))
})

app.get('/api/webhook-events', (req, res) => {
  res.json(webhookEvents)
})

app.get('/api/logs', (req, res) => {
  res.json(ecom.getRequestLogs())
})

// ─── Fallback Sync (security net) ──────────────────────────

app.post('/api/ecom/sync-recent', async (req, res) => {
  try {
    const { date_debut, date_fin } = req.body
    const data = await ecom.getColis({
      type_date: 'action',
      date_debut: date_debut || new Date(Date.now() - 86400000).toISOString().split('T')[0],
      date_fin: date_fin || new Date().toISOString().split('T')[0],
      limit: 100,
    })

    let updated = 0
    if (data.colis) {
      for (const ecomColis of data.colis) {
        const delivery = findDeliveryByTracking(ecomColis.tracking)
        if (delivery) {
          const eventTime = new Date(ecomColis.date_action || ecomColis.updated_at).getTime()
          const lastSync = delivery.ecomLastSyncAt ? new Date(delivery.ecomLastSyncAt).getTime() : 0
          if (eventTime > lastSync) {
            const event = {
              id: `sync-${ecomColis.tracking}-${Date.now()}`,
              tracking: ecomColis.tracking,
              situation: ecomColis.situation,
              id_situation: ecomColis.id_situation,
              etat_logistique: ecomColis.etat_logistique,
              id_etat_logistique: ecomColis.id_etat_logistique,
              commentaire: ecomColis.commentaire,
              date: ecomColis.date_action,
              ville: ecomColis.ville,
              encaisser: ecomColis.encaisser,
              recouvert: ecomColis.recouvert,
              tarif_livraison: ecomColis.tarif_livraison,
              tarif_annulation: ecomColis.tarif_annulation,
            }
            processWebhookEvent(event, deliveries, updateDelivery, addDeliveryHistory)
            updated++
          }
        }
      }
    }

    res.json({ ok: true, updated, total: data.total || 0 })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── YouCan Routes ──────────────────────────────────────────

app.use('/api', youcanRoutes)

// ─── Start Server ──────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🦊 Foxbox E-com Server running on port ${PORT}`)
  console.log(`   Health: http://localhost:${PORT}/api/health`)
  console.log(`   Webhook: http://localhost:${PORT}/api/webhooks/ecom-delivery`)
  console.log(`   E-com configured: ${ecom.isConfigured()}\n`)
})
