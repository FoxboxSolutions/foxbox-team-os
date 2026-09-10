import { Hono } from 'hono';
import type { Env } from '../types/env';
import { execute, generateId, nowISO, queryOne } from '../db/client';
import { successResponse, errorResponse } from '../utils/response';
import { authenticate } from '../middleware/auth';
import { awardConfirmationCommission } from './members';

const confirmations = new Hono<{ Bindings: Env }>();

confirmations.get('/', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const url = new URL(c.req.url);
  const status = url.searchParams.get('status');
  const phone = url.searchParams.get('phone');

  let sql = 'SELECT * FROM confirmations WHERE 1=1';
  const params: unknown[] = [];
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (phone) { sql += ' AND phone = ?'; params.push(phone); }
  sql += ' ORDER BY created_at DESC';

  const results = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json(results.results);
});

confirmations.get('/:id', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const result = await c.env.DB.prepare('SELECT * FROM confirmations WHERE id = ?').bind(c.req.param('id')).first();
  if (!result) return errorResponse('Not found', 404);
  return successResponse(result);
});

confirmations.post('/', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const data = await c.req.json();
  const id = generateId();
  const now = nowISO();
  const creatorId = authResult.auth!.user.sub as string;
  const initialStatus = data.status || 'PENDING';
  const confirmedNow = initialStatus === 'CONFIRMED';

  await execute(c.env,
    `INSERT INTO confirmations (id, full_name, phone, wilaya_code, wilaya_name, baladiya, shipping_method, delivery_price, address, office_ref, office_name, office_address, office_phone, transporter, product_id, product_price, quantity, total, notes, status, created_by, confirmed_by, confirmed_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.fullName, data.phone, data.wilayaCode, data.wilayaName, data.baladiya, data.shippingMethod || 'HOME', data.deliveryPrice || 0, data.address || null, data.officeRef || null, data.officeName || null, data.officeAddress || null, data.officePhone || null, data.transporter || null, data.productId || null, data.productPrice || 0, data.quantity || 1, data.total || 0, data.notes || null, initialStatus, creatorId, confirmedNow ? creatorId : null, confirmedNow ? now : null, now, now]
  );

  // Commission is earned only on CONFIRMED (idempotent ledger)
  let commissionAwarded = false;
  if (confirmedNow) {
    commissionAwarded = (await awardConfirmationCommission(c.env, id, creatorId)).awarded;
  }

  return successResponse({ id, commissionAwarded });
});

confirmations.put('/:id', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const data = await c.req.json();
  const now = nowISO();
  const confirmationId = c.req.param('id');
  const actingUserId = authResult.auth!.user.sub as string;

  const current = await queryOne<{ status: string; created_by: string; confirmed_by: string | null }>(
    c.env, 'SELECT status, created_by, confirmed_by FROM confirmations WHERE id = ?', [confirmationId]
  );
  if (!current) return errorResponse('Confirmation not found', 404);

  const fields: string[] = ['updated_at = ?'];
  const values: unknown[] = [now];

  const newStatus = data.status as string | undefined;
  const transitionsToConfirmed = !!newStatus && newStatus === 'CONFIRMED' && current.status !== 'CONFIRMED';
  if (newStatus) { fields.push('status = ?'); values.push(newStatus); }
  if (transitionsToConfirmed && !current.confirmed_by) {
    fields.push('confirmed_by = ?');
    values.push(actingUserId);
    fields.push('confirmed_at = ?');
    values.push(now);
  }
  if (data.notes !== undefined) { fields.push('notes = ?'); values.push(data.notes); }
  if (data.ecomTracking) { fields.push('ecom_tracking = ?'); values.push(data.ecomTracking); }
  if (data.ecomStatus) { fields.push('ecom_status = ?'); values.push(data.ecomStatus); }

  values.push(confirmationId);
  await execute(c.env, `UPDATE confirmations SET ${fields.join(', ')} WHERE id = ?`, values);

  // Commission ONLY on transition into CONFIRMED; ledger UNIQUE blocks duplicates
  let commissionAwarded = false;
  if (transitionsToConfirmed) {
    const agentId = current.confirmed_by || actingUserId;
    commissionAwarded = (await awardConfirmationCommission(c.env, confirmationId, agentId)).awarded;
  }
  return successResponse({ commissionAwarded }, 'Confirmation updated');
});

confirmations.delete('/:id', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;
  await execute(c.env, 'DELETE FROM confirmations WHERE id = ?', [c.req.param('id')]);
  return successResponse(null, 'Confirmation deleted');
});

// Get confirmation by phone (for quick lookup)
confirmations.get('/phone/:phone', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const result = await c.env.DB.prepare('SELECT * FROM confirmations WHERE phone = ? ORDER BY created_at DESC LIMIT 1').bind(c.req.param('phone')).first();
  return successResponse(result || null);
});

export default confirmations;
