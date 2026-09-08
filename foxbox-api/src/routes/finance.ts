import { Hono } from 'hono';
import type { Env } from '../types/env';
import { execute, generateId, nowISO } from '../db/client';
import { successResponse, errorResponse } from '../utils/response';
import { authenticate } from '../middleware/auth';

const finance = new Hono<{ Bindings: Env }>();

// ─── EXPENSES ───────────────────────────────────────────────

finance.get('/expenses', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const url = new URL(c.req.url);
  const category = url.searchParams.get('category');

  let sql = 'SELECT * FROM expenses WHERE 1=1';
  const params: unknown[] = [];
  if (category) { sql += ' AND category = ?'; params.push(category); }
  sql += ' ORDER BY created_at DESC';

  const results = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json(results.results);
});

finance.post('/expenses', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const data = await c.req.json();
  const id = generateId();

  await execute(c.env,
    `INSERT INTO expenses (id, category, description, amount_dzd, amount_usd, product_id, order_id, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.category, data.description, data.amountDzd || 0, data.amountUsd || null, data.productId || null, data.orderId || null, authResult.auth!.user.sub, nowISO()]
  );

  return c.json(successResponse({ id }));
});

finance.delete('/expenses/:id', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;
  await execute(c.env, 'DELETE FROM expenses WHERE id = ?', [c.req.param('id')]);
  return c.json(successResponse(null, 'Expense deleted'));
});

// ─── REVENUES ───────────────────────────────────────────────

finance.get('/revenues', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const results = await c.env.DB.prepare('SELECT * FROM revenues ORDER BY created_at DESC').all();
  return c.json(results.results);
});

finance.post('/revenues', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const data = await c.req.json();
  const id = generateId();

  await execute(c.env,
    `INSERT INTO revenues (id, source, amount_dzd, order_id, product_id, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, data.source || 'ORDER', data.amountDzd || 0, data.orderId || null, data.productId || null, nowISO()]
  );

  return c.json(successResponse({ id }));
});

// ─── DELIVERY PROVIDERS ─────────────────────────────────────

finance.get('/delivery-providers', async (c) => {
  const results = await c.env.DB.prepare('SELECT * FROM delivery_providers ORDER BY name').all();
  return c.json(results.results.map((p: Record<string, unknown>) => ({
    ...p,
    services: JSON.parse(p.services as string || '[]'),
  })));
});

// ─── SHIPMENTS ──────────────────────────────────────────────

finance.get('/shipments', async (c) => {
  const results = await c.env.DB.prepare('SELECT * FROM shipments ORDER BY created_at DESC').all();
  return c.json(results.results);
});

// ─── NOTIFICATIONS ──────────────────────────────────────────

finance.get('/notifications', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const results = await c.env.DB.prepare(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
  ).bind(authResult.auth!.user.sub).all();
  return c.json(results.results);
});

finance.post('/notifications/:id/read', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  await execute(c.env, 'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [c.req.param('id'), authResult.auth!.user.sub]);
  return c.json(successResponse(null, 'Marked as read'));
});

finance.post('/notifications/read-all', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  await execute(c.env, 'UPDATE notifications SET is_read = 1 WHERE user_id = ?', [authResult.auth!.user.sub]);
  return c.json(successResponse(null, 'All marked as read'));
});

// ─── ACTIVITY LOG ───────────────────────────────────────────

finance.get('/activity', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const url = new URL(c.req.url);
  const limit = parseInt(url.searchParams.get('limit') || '50');

  const results = await c.env.DB.prepare(
    'SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT ?'
  ).bind(limit).all();
  return c.json(results.results);
});

finance.post('/activity', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const data = await c.req.json();
  const id = generateId();

  await execute(c.env,
    `INSERT INTO activity_logs (id, action, user_id, entity_type, entity_id, entity_name, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.action, authResult.auth!.user.sub, data.entityType, data.entityId, data.entityName, data.details || null, nowISO()]
  );

  return c.json(successResponse({ id }));
});

// ─── SETTINGS ───────────────────────────────────────────────

finance.get('/settings', async (c) => {
  const results = await c.env.DB.prepare('SELECT * FROM settings').all();
  const settings: Record<string, unknown> = {};
  for (const row of results.results) {
    settings[(row as Record<string, unknown>).key as string] = (row as Record<string, unknown>).value;
  }
  return c.json(successResponse(settings));
});

finance.put('/settings', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;
  if (authResult.auth!.user.role !== 'administrator') {
    return c.json(errorResponse('Admin only', 403));
  }

  const data = await c.req.json();
  for (const [key, value] of Object.entries(data)) {
    await execute(c.env,
      `INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))`,
      [key, String(value)]
    );
  }
  return c.json(successResponse(null, 'Settings updated'));
});

// ─── WILAYAS (public) ───────────────────────────────────────

finance.get('/wilayas', async (c) => {
  const results = await c.env.DB.prepare('SELECT * FROM wilayas ORDER BY code').all();
  return c.json(results.results.map((w: Record<string, unknown>) => ({
    ...w,
    communes: JSON.parse(w.communes as string || '[]'),
  })));
});

finance.get('/wilayas/:code/prices', async (c) => {
  const result = await c.env.DB.prepare('SELECT * FROM delivery_prices WHERE wilaya_code = ?').bind(c.req.param('code')).first();
  return c.json(successResponse(result || null));
});

finance.get('/bureaux', async (c) => {
  const url = new URL(c.req.url);
  const wilayaCode = url.searchParams.get('wilaya_code');

  let sql = 'SELECT * FROM bureaux';
  const params: unknown[] = [];
  if (wilayaCode) { sql += ' WHERE wilaya_code = ?'; params.push(wilayaCode); }
  sql += ' ORDER BY wilaya_code, code';

  const results = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json(results.results);
});

export default finance;
