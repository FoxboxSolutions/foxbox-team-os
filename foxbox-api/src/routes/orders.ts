import { Hono } from 'hono';
import type { Env } from '../types/env';
import { query, queryOne, execute, generateId, nowISO } from '../db/client';
import { successResponse, errorResponse } from '../utils/response';
import { authenticate } from '../middleware/auth';

const orders = new Hono<{ Bindings: Env }>();

// List orders
orders.get('/', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const url = new URL(c.req.url);
  const status = url.searchParams.get('status');
  const search = url.searchParams.get('search');
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '50');

  let sql = 'SELECT * FROM orders WHERE 1=1';
  const params: unknown[] = [];

  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (search) {
    sql += ' AND (order_number LIKE ? OR customer LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  const countResult = await c.env.DB.prepare(sql.replace('SELECT *', 'SELECT COUNT(*) as count')).bind(...params).first() as { count: number };
  const total = countResult?.count || 0;

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, (page - 1) * limit);

  const results = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json(successResponse({ orders: results.results, total, page, totalPages: Math.ceil(total / limit) }));
});

// Get single order
orders.get('/:id', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const order = await queryOne(c.env, 'SELECT * FROM orders WHERE id = ?', [c.req.param('id')]);
  if (!order) return c.json(errorResponse('Order not found', 404));
  return c.json(successResponse(order));
});

// Create order
orders.post('/', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const data = await c.req.json();
  const id = generateId();
  const now = nowISO();
  const orderNumber = `FOX-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

  await execute(c.env,
    `INSERT INTO orders (id, order_number, customer, product_id, quantity, selling_price_dzd, delivery_fee_dzd, payment_method, carrier_id, tracking_number, status, confirmation_status, notes, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, orderNumber, JSON.stringify(data.customer), data.productId, data.quantity || 1, data.sellingPriceDzd || 0, data.deliveryFeeDzd || 0, data.paymentMethod || 'COD', data.carrierId || null, data.trackingNumber || null, data.status || 'NEW', data.confirmationStatus || 'PENDING', data.notes || null, authResult.auth!.user.sub, now, now]
  );

  return c.json(successResponse({ id, orderNumber }));
});

// Update order
orders.put('/:id', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const data = await c.req.json();
  const now = nowISO();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.status) { fields.push('status = ?'); values.push(data.status); }
  if (data.confirmationStatus) { fields.push('confirmation_status = ?'); values.push(data.confirmationStatus); }
  if (data.trackingNumber) { fields.push('tracking_number = ?'); values.push(data.trackingNumber); }
  if (data.carrierId) { fields.push('carrier_id = ?'); values.push(data.carrierId); }
  if (data.notes !== undefined) { fields.push('notes = ?'); values.push(data.notes); }
  if (data.confirmedAt) { fields.push('confirmed_at = ?'); values.push(data.confirmedAt); }
  if (data.shippedAt) { fields.push('shipped_at = ?'); values.push(data.shippedAt); }
  if (data.deliveredAt) { fields.push('delivered_at = ?'); values.push(data.deliveredAt); }
  if (data.returnedAt) { fields.push('returned_at = ?'); values.push(data.returnedAt); }

  fields.push('updated_at = ?');
  values.push(now);
  values.push(c.req.param('id'));

  await execute(c.env, `UPDATE orders SET ${fields.join(', ')} WHERE id = ?`, values);
  return c.json(successResponse(null, 'Order updated'));
});

// Delete order
orders.delete('/:id', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  await execute(c.env, 'DELETE FROM orders WHERE id = ?', [c.req.param('id')]);
  return c.json(successResponse(null, 'Order deleted'));
});

export default orders;
