import { Hono } from 'hono';
import type { Env } from '../types/env';
import { successResponse, errorResponse } from '../utils/response';
import { authenticate } from '../middleware/auth';

const ecom = new Hono<{ Bindings: Env }>();

const BASE_URL = 'https://ecom-dz.com/api_v2';

async function apiRequest(c: Env, method: string, path: string, body?: unknown): Promise<unknown> {
  const headers: Record<string, string> = {
    'X-API-Key': c.ECOM_API_KEY || '',
    'X-API-Token': c.ECOM_API_TOKEN || '',
    'Content-Type': 'application/json',
  };

  const opts: RequestInit = { method, headers };
  if (body && method !== 'GET') {
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(`${BASE_URL}${path}`, opts);
  const text = await res.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!res.ok) {
    throw new Error(`E-com API ${res.status}: ${(data as Record<string, string>).erreur || text}`);
  }
  return data;
}

// Health check
ecom.get('/health', (c) => {
  return c.json(successResponse({
    status: 'ok',
    ecomConfigured: !!(c.env.ECOM_API_KEY && c.env.ECOM_API_TOKEN),
  }));
});

// Test connection
ecom.get('/ecom/test', async (c) => {
  try {
    const result = await apiRequest(c.env, 'GET', '/test');
    return c.json(successResponse(result));
  } catch (err) {
    return c.json(errorResponse(err instanceof Error ? err.message : 'Test failed'), 500);
  }
});

// Reference data
ecom.get('/ecom/wilayas', async (c) => {
  try {
    const data = await apiRequest(c.env, 'GET', '/wilayas');
    return c.json(data);
  } catch (err) {
    return c.json(errorResponse(err instanceof Error ? err.message : 'Failed'), 500);
  }
});

ecom.get('/ecom/communes/:wilayaId', async (c) => {
  try {
    const data = await apiRequest(c.env, 'GET', `/communes?id_wilaya=${c.req.param('wilayaId')}`);
    return c.json(data);
  } catch (err) {
    return c.json(errorResponse(err instanceof Error ? err.message : 'Failed'), 500);
  }
});

ecom.get('/ecom/stopdesks/:wilayaId', async (c) => {
  try {
    const data = await apiRequest(c.env, 'GET', `/stopdesks?id_wilaya=${c.req.param('wilayaId')}`);
    return c.json(data);
  } catch (err) {
    return c.json(errorResponse(err instanceof Error ? err.message : 'Failed'), 500);
  }
});

ecom.get('/ecom/situations', async (c) => {
  try {
    const data = await apiRequest(c.env, 'GET', '/situations');
    return c.json(data);
  } catch (err) {
    return c.json(errorResponse(err instanceof Error ? err.message : 'Failed'), 500);
  }
});

ecom.get('/ecom/etats-logistiques', async (c) => {
  try {
    const data = await apiRequest(c.env, 'GET', '/etats-logistiques');
    return c.json(data);
  } catch (err) {
    return c.json(errorResponse(err instanceof Error ? err.message : 'Failed'), 500);
  }
});

ecom.get('/ecom/tarifs', async (c) => {
  try {
    const data = await apiRequest(c.env, 'GET', '/tarifs');
    return c.json(data);
  } catch (err) {
    return c.json(errorResponse(err instanceof Error ? err.message : 'Failed'), 500);
  }
});

// Colis CRUD
ecom.post('/ecom/colis', async (c) => {
  try {
    const body = await c.req.json();
    const data = await apiRequest(c.env, 'POST', '/colis', body);
    return c.json(data);
  } catch (err) {
    return c.json(errorResponse(err instanceof Error ? err.message : 'Failed'), 500);
  }
});

ecom.get('/ecom/colis', async (c) => {
  try {
    const qs = new URL(c.req.url).searchParams.toString();
    const data = await apiRequest(c.env, 'GET', `/colis${qs ? '?' + qs : ''}`);
    return c.json(data);
  } catch (err) {
    return c.json(errorResponse(err instanceof Error ? err.message : 'Failed'), 500);
  }
});

ecom.get('/ecom/colis/:tracking', async (c) => {
  try {
    const data = await apiRequest(c.env, 'GET', `/colis/${c.req.param('tracking')}`);
    return c.json(data);
  } catch (err) {
    return c.json(errorResponse(err instanceof Error ? err.message : 'Failed'), 500);
  }
});

ecom.put('/ecom/colis/:tracking', async (c) => {
  try {
    const body = await c.req.json();
    const data = await apiRequest(c.env, 'PUT', `/colis/${c.req.param('tracking')}`, body);
    return c.json(data);
  } catch (err) {
    return c.json(errorResponse(err instanceof Error ? err.message : 'Failed'), 500);
  }
});

ecom.post('/ecom/colis/confirmer', async (c) => {
  try {
    const { trackings } = await c.req.json();
    const data = await apiRequest(c.env, 'POST', '/colis/confirmer', { trackings });
    return c.json(data);
  } catch (err) {
    return c.json(errorResponse(err instanceof Error ? err.message : 'Failed'), 500);
  }
});

ecom.delete('/ecom/colis/:tracking', async (c) => {
  try {
    const data = await apiRequest(c.env, 'DELETE', `/colis/${c.req.param('tracking')}`);
    return c.json(data);
  } catch (err) {
    return c.json(errorResponse(err instanceof Error ? err.message : 'Failed'), 500);
  }
});

ecom.post('/ecom/colis/statuts', async (c) => {
  try {
    const { trackings } = await c.req.json();
    const data = await apiRequest(c.env, 'POST', '/colis/statuts', { trackings });
    return c.json(data);
  } catch (err) {
    return c.json(errorResponse(err instanceof Error ? err.message : 'Failed'), 500);
  }
});

ecom.post('/ecom/colis/historique', async (c) => {
  try {
    const { trackings } = await c.req.json();
    const data = await apiRequest(c.env, 'POST', '/colis/historique', { trackings });
    return c.json(data);
  } catch (err) {
    return c.json(errorResponse(err instanceof Error ? err.message : 'Failed'), 500);
  }
});

ecom.get('/ecom/colis/resume', async (c) => {
  try {
    const data = await apiRequest(c.env, 'GET', '/colis/resume');
    return c.json(data);
  } catch (err) {
    return c.json(errorResponse(err instanceof Error ? err.message : 'Failed'), 500);
  }
});

// Bordereaux
ecom.get('/ecom/colis/:tracking/bordereau', async (c) => {
  try {
    const format = new URL(c.req.url).searchParams.get('format') || '10x13';
    const data = await apiRequest(c.env, 'GET', `/colis/${c.req.param('tracking')}/bordereau?format=${format}`);
    return c.json(data);
  } catch (err) {
    return c.json(errorResponse(err instanceof Error ? err.message : 'Failed'), 500);
  }
});

ecom.post('/ecom/colis/bordereaux', async (c) => {
  try {
    const { trackings } = await c.req.json();
    const data = await apiRequest(c.env, 'POST', '/colis/bordereaux', { trackings });
    return c.json(data);
  } catch (err) {
    return c.json(errorResponse(err instanceof Error ? err.message : 'Failed'), 500);
  }
});

// Produits
ecom.get('/ecom/produits', async (c) => {
  try {
    const data = await apiRequest(c.env, 'GET', '/produits');
    return c.json(data);
  } catch (err) {
    return c.json(errorResponse(err instanceof Error ? err.message : 'Failed'), 500);
  }
});

ecom.post('/ecom/produits', async (c) => {
  try {
    const body = await c.req.json();
    const data = await apiRequest(c.env, 'POST', '/produits', body);
    return c.json(data);
  } catch (err) {
    return c.json(errorResponse(err instanceof Error ? err.message : 'Failed'), 500);
  }
});

ecom.put('/ecom/produits/:id', async (c) => {
  try {
    const body = await c.req.json();
    const data = await apiRequest(c.env, 'PUT', `/produits/${c.req.param('id')}`, body);
    return c.json(data);
  } catch (err) {
    return c.json(errorResponse(err instanceof Error ? err.message : 'Failed'), 500);
  }
});

// Paiements
ecom.get('/ecom/paiements', async (c) => {
  try {
    const data = await apiRequest(c.env, 'GET', '/paiements');
    return c.json(data);
  } catch (err) {
    return c.json(errorResponse(err instanceof Error ? err.message : 'Failed'), 500);
  }
});

ecom.get('/ecom/paiements/:id', async (c) => {
  try {
    const data = await apiRequest(c.env, 'GET', `/paiements/${c.req.param('id')}`);
    return c.json(data);
  } catch (err) {
    return c.json(errorResponse(err instanceof Error ? err.message : 'Failed'), 500);
  }
});

// Webhook config
ecom.get('/ecom/webhook', async (c) => {
  try {
    const data = await apiRequest(c.env, 'GET', '/webhook');
    return c.json(data);
  } catch (err) {
    return c.json(errorResponse(err instanceof Error ? err.message : 'Failed'), 500);
  }
});

ecom.put('/ecom/webhook', async (c) => {
  try {
    const body = await c.req.json();
    const data = await apiRequest(c.env, 'PUT', '/webhook', body);
    return c.json(data);
  } catch (err) {
    return c.json(errorResponse(err instanceof Error ? err.message : 'Failed'), 500);
  }
});

ecom.delete('/ecom/webhook', async (c) => {
  try {
    const data = await apiRequest(c.env, 'DELETE', '/webhook');
    return c.json(data);
  } catch (err) {
    return c.json(errorResponse(err instanceof Error ? err.message : 'Failed'), 500);
  }
});

ecom.post('/ecom/webhook/test', async (c) => {
  try {
    const data = await apiRequest(c.env, 'POST', '/webhook/test');
    return c.json(data);
  } catch (err) {
    return c.json(errorResponse(err instanceof Error ? err.message : 'Failed'), 500);
  }
});

ecom.get('/ecom/webhook/events', async (c) => {
  try {
    const data = await apiRequest(c.env, 'GET', '/webhook/events');
    return c.json(data);
  } catch (err) {
    return c.json(errorResponse(err instanceof Error ? err.message : 'Failed'), 500);
  }
});

ecom.get('/ecom/webhook/logs', async (c) => {
  try {
    const data = await apiRequest(c.env, 'GET', '/webhook/logs');
    return c.json(data);
  } catch (err) {
    return c.json(errorResponse(err instanceof Error ? err.message : 'Failed'), 500);
  }
});

// Create colis from confirmation
ecom.post('/ecom/create-from-confirmation', async (c) => {
  try {
    const conf = await c.req.json();
    const payload = {
      nom_prenom: conf.fullName,
      telephone: conf.phone,
      telephone2: conf.phoneAlt || '',
      id_wilaya: parseInt(conf.wilayaCode) || 0,
      commune: conf.baladiya || '',
      adresse: conf.address || '',
      type_livraison: conf.shippingMethod === 'HOME' ? 'Domicile' : 'Stopdesk',
      id_stopdesk: conf.officeRef || '',
      note: conf.notes || '',
      produit: conf.productName || conf.product || '',
      quantite: conf.quantity || 1,
      prix_total: conf.total || 0,
      prix_livraison: conf.deliveryPrice || 0,
      id_externe: conf.id || '',
    };
    const data = await apiRequest(c.env, 'POST', '/colis', payload);
    return c.json(data);
  } catch (err) {
    return c.json(errorResponse(err instanceof Error ? err.message : 'Failed'), 500);
  }
});

// Sync recent
ecom.post('/ecom/sync-recent', async (c) => {
  try {
    const { date_debut, date_fin } = await c.req.json().catch(() => ({}));
    const debut = date_debut || new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const fin = date_fin || new Date().toISOString().split('T')[0];
    const data = await apiRequest(c.env, 'GET', `/colis?type_date=action&date_debut=${debut}&date_fin=${fin}&limit=100`);
    return c.json(data);
  } catch (err) {
    return c.json(errorResponse(err instanceof Error ? err.message : 'Failed'), 500);
  }
});

// Internal delivery endpoints
ecom.post('/deliveries', async (c) => {
  const delivery = await c.req.json();
  const { id } = delivery;

  const existing = await c.env.DB.prepare('SELECT id FROM ecom_deliveries WHERE id = ?').bind(id).first();
  if (existing) {
    const fields = Object.keys(delivery).filter(k => k !== 'id');
    const sets = fields.map(f => `${f.replace(/([A-Z])/g, '_$1').toLowerCase()} = ?`).join(', ');
    const values = fields.map(f => delivery[f]);
    await c.env.DB.prepare(`UPDATE ecom_deliveries SET ${sets}, updated_at = datetime('now') WHERE id = ?`).bind(...values, id).run();
  } else {
    const cols = Object.keys(delivery).map(k => k.replace(/([A-Z])/g, '_$1').toLowerCase());
    const placeholders = cols.map(() => '?').join(', ');
    const values = Object.values(delivery);
    await c.env.DB.prepare(`INSERT INTO ecom_deliveries (${cols.join(', ')}) VALUES (${placeholders})`).bind(...values).run();
  }
  return c.json(successResponse({ ok: true }));
});

ecom.get('/deliveries', async (c) => {
  const results = await c.env.DB.prepare('SELECT * FROM ecom_deliveries ORDER BY created_at DESC').all();
  return c.json(results.results);
});

ecom.get('/deliveries/:id', async (c) => {
  const delivery = await c.env.DB.prepare('SELECT * FROM ecom_deliveries WHERE id = ?').bind(c.req.param('id')).first();
  if (!delivery) return c.json(errorResponse('Not found', 404));
  return c.json(delivery);
});

ecom.post('/deliveries/:id/history', async (c) => {
  const entry = await c.req.json();
  const id = 'dh-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
  await c.env.DB.prepare(
    `INSERT INTO delivery_history (id, delivery_id, ecom_event_id, situation, situation_id, etat_logistique, etat_logistique_id, commentaire, wilaya_code, received_at, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, c.req.param('id'), entry.ecomEventId || null, entry.situation, entry.situationId || null,
    entry.etatLogistique || null, entry.etatLogistiqueId || null, entry.commentaire || '',
    entry.wilayaCode || null, entry.receivedAt || new Date().toISOString(), entry.source || 'manual'
  ).run();
  return c.json(successResponse({ ok: true }));
});

ecom.get('/deliveries/:id/history', async (c) => {
  const results = await c.env.DB.prepare(
    'SELECT * FROM delivery_history WHERE delivery_id = ? ORDER BY received_at ASC'
  ).bind(c.req.param('id')).all();
  return c.json(results.results);
});

export default ecom;
