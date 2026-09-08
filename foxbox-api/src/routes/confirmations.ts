import { Hono } from 'hono';
import type { Env } from '../types/env';
import { execute, generateId, nowISO } from '../db/client';
import { successResponse, errorResponse } from '../utils/response';
import { authenticate } from '../middleware/auth';

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
  if (!result) return c.json(errorResponse('Not found', 404));
  return c.json(successResponse(result));
});

confirmations.post('/', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const data = await c.req.json();
  const id = generateId();
  const now = nowISO();

  await execute(c.env,
    `INSERT INTO confirmations (id, full_name, phone, wilaya_code, wilaya_name, baladiya, shipping_method, delivery_price, address, office_ref, office_name, office_address, office_phone, transporter, product_id, product_price, quantity, total, notes, status, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.fullName, data.phone, data.wilayaCode, data.wilayaName, data.baladiya, data.shippingMethod || 'HOME', data.deliveryPrice || 0, data.address || null, data.officeRef || null, data.officeName || null, data.officeAddress || null, data.officePhone || null, data.transporter || null, data.productId || null, data.productPrice || 0, data.quantity || 1, data.total || 0, data.notes || null, data.status || 'PENDING', authResult.auth!.user.sub, now, now]
  );

  return c.json(successResponse({ id }));
});

confirmations.put('/:id', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const data = await c.req.json();
  const now = nowISO();
  const fields: string[] = ['updated_at = ?'];
  const values: unknown[] = [now];

  if (data.status) { fields.push('status = ?'); values.push(data.status); }
  if (data.notes !== undefined) { fields.push('notes = ?'); values.push(data.notes); }
  if (data.ecomTracking) { fields.push('ecom_tracking = ?'); values.push(data.ecomTracking); }
  if (data.ecomStatus) { fields.push('ecom_status = ?'); values.push(data.ecomStatus); }

  values.push(c.req.param('id'));
  await execute(c.env, `UPDATE confirmations SET ${fields.join(', ')} WHERE id = ?`, values);
  return c.json(successResponse(null, 'Confirmation updated'));
});

confirmations.delete('/:id', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;
  await execute(c.env, 'DELETE FROM confirmations WHERE id = ?', [c.req.param('id')]);
  return c.json(successResponse(null, 'Confirmation deleted'));
});

// Get confirmation by phone (for quick lookup)
confirmations.get('/phone/:phone', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const result = await c.env.DB.prepare('SELECT * FROM confirmations WHERE phone = ? ORDER BY created_at DESC LIMIT 1').bind(c.req.param('phone')).first();
  return c.json(successResponse(result || null));
});

export default confirmations;
