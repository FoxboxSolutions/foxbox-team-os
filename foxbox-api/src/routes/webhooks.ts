import { Hono } from 'hono';
import type { Env } from '../types/env';
import { execute, generateId } from '../db/client';
import { successResponse, errorResponse } from '../utils/response';

const webhooks = new Hono<{ Bindings: Env }>();

// E-com Delivery webhook receiver
webhooks.post('/webhooks/ecom-delivery', async (c) => {
  const rawBody = await c.req.text();
  const signature = c.req.header('x-webhook-signature');
  const timestamp = c.req.header('x-webhook-timestamp');

  // HMAC verification (if secret configured)
  const secret = c.env.ECOM_WEBHOOK_SECRET;
  if (secret && signature && timestamp) {
    const ts = parseInt(timestamp);
    if (isNaN(ts) || Math.abs(Date.now() - ts * 1000) > 300000) {
      return c.json(errorResponse('Timestamp expired'), 401);
    }

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const payload = `${timestamp}.${rawBody}`;
    const sigBuffer = Uint8Array.from(atob(signature.replace('sha256=', '')), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBuffer, new TextEncoder().encode(payload));

    if (!valid) {
      return c.json(errorResponse('Invalid signature'), 401);
    }
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return c.json(errorResponse('Invalid JSON'), 400);
  }

  const { id, tracking, situation, id_situation, etat_logistique, id_etat_logistique, commentaire, date } = event;

  if (!tracking) {
    return c.json(errorResponse('Missing tracking'), 400);
  }

  // Find delivery
  const delivery = await c.env.DB.prepare('SELECT * FROM ecom_deliveries WHERE ecom_tracking = ?').bind(tracking).first() as Record<string, unknown> | null;

  if (!delivery) {
    console.log(`[Webhook] No delivery found for tracking: ${tracking}`);
    return c.json(successResponse({ received: true, status: 'delivery_not_found' }));
  }

  // Check event is newer
  const eventTime = new Date(date as string).getTime();
  const lastSync = delivery.ecom_last_sync_at ? new Date(delivery.ecom_last_sync_at as string).getTime() : 0;
  if (eventTime < lastSync) {
    return c.json(successResponse({ received: true, status: 'stale_event' }));
  }

  // Map situation to status
  const s = (situation as string || '').toLowerCase();
  let status = 'IN_PROGRESS';
  if (s.includes('livrée') || s.includes('livree')) status = 'DELIVERED';
  else if (s.includes('annul')) status = 'CANCELLED';
  else if (s.includes('retour')) status = 'RETURNED';
  else if (s.includes('encaisser')) status = 'COLLECTED';
  else if (s.includes('ne répond') || s.includes('repond')) status = 'NO_ANSWER';
  else if (s.includes('report')) status = 'POSTPONED';
  else if (s.includes('dispatcher') || s.includes('dispatch')) status = 'DISPATCHED';
  else if (s.includes('bureau')) status = 'AT_OFFICE';
  else if (s.includes('livraison') || s.includes('sortir')) status = 'OUT_FOR_DELIVERY';
  else if (s.includes('préparation') || s.includes('preparation')) status = 'PREPARING';
  else if (s.includes('traitement')) status = 'PROCESSING';

  const now = new Date().toISOString();
  await c.env.DB.prepare(`
    UPDATE ecom_deliveries SET
      ecom_situation = ?, ecom_situation_id = ?, ecom_etat_logistique = ?, ecom_etat_logistique_id = ?,
      status = ?, status_label = ?, ecom_last_action_at = ?, ecom_last_sync_at = ?, updated_at = ?
    WHERE ecom_tracking = ?
  `).bind(
    situation, id_situation || 0, etat_logistique || '', id_etat_logistique || 0,
    status, situation, date, now, now, tracking
  ).run();

  // Add history
  const historyId = 'dh-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
  await c.env.DB.prepare(`
    INSERT INTO delivery_history (id, delivery_id, ecom_event_id, situation, situation_id, etat_logistique, etat_logistique_id, commentaire, wilaya_code, received_at, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'webhook')
  `).bind(
    historyId, delivery.id, id, situation, id_situation || null,
    etat_logistique || null, id_etat_logistique || null, commentaire || '',
    (event.ville as string) || delivery.wilaya_code, now
  ).run();

  return c.json(successResponse({ received: true, status: 'updated' }));
});

export default webhooks;
