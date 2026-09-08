import { Hono } from 'hono';
import type { Env } from '../types/env';
import { queryOne, execute, generateId, nowISO } from '../db/client';
import { successResponse, errorResponse } from '../utils/response';
import { authenticate } from '../middleware/auth';

const products = new Hono<{ Bindings: Env }>();

products.get('/', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const url = new URL(c.req.url);
  const status = url.searchParams.get('status');
  const search = url.searchParams.get('search');

  let sql = 'SELECT * FROM products WHERE 1=1';
  const params: unknown[] = [];
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (search) { sql += ' AND (name LIKE ? OR category LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  sql += ' ORDER BY created_at DESC';

  const results = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json(results.results);
});

products.get('/:id', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const product = await queryOne(c.env, 'SELECT * FROM products WHERE id = ?', [c.req.param('id')]);
  if (!product) return c.json(errorResponse('Not found', 404));
  return c.json(successResponse(product));
});

products.post('/', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const data = await c.req.json();
  const id = generateId();
  const now = nowISO();

  await execute(c.env,
    `INSERT INTO products (id, name, source_url, source_platform, source_product_id, description, category, status, score, notes, image_url, created_at, updated_at, is_winner, fields, variants, product_creatives, links, supplier, shipping_profile, cost_scenario, cod_scenario, offers, tests, decision_history)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.name, data.sourceUrl || '', data.sourcePlatform || '', data.sourceProductId || null, data.description || null, data.category || null, data.status || 'IDEA', data.score || null, data.notes || null, data.imageUrl || null, now, now, data.isWinner ? 1 : 0, JSON.stringify(data.fields || []), JSON.stringify(data.variants || []), JSON.stringify(data.creatives || []), JSON.stringify(data.links || []), data.supplier ? JSON.stringify(data.supplier) : null, data.shippingProfile ? JSON.stringify(data.shippingProfile) : null, data.costScenario ? JSON.stringify(data.costScenario) : null, data.codScenario ? JSON.stringify(data.codScenario) : null, JSON.stringify(data.offers || []), JSON.stringify(data.tests || []), JSON.stringify(data.decisionHistory || [])]
  );

  return c.json(successResponse({ id }));
});

products.put('/:id', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const data = await c.req.json();
  const now = nowISO();
  const fields: string[] = ['updated_at = ?'];
  const values: unknown[] = [now];

  if (data.name) { fields.push('name = ?'); values.push(data.name); }
  if (data.status) { fields.push('status = ?'); values.push(data.status); }
  if (data.score !== undefined) { fields.push('score = ?'); values.push(data.score); }
  if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
  if (data.category !== undefined) { fields.push('category = ?'); values.push(data.category); }
  if (data.notes !== undefined) { fields.push('notes = ?'); values.push(data.notes); }
  if (data.imageUrl !== undefined) { fields.push('image_url = ?'); values.push(data.imageUrl); }
  if (data.isWinner !== undefined) { fields.push('is_winner = ?'); values.push(data.isWinner ? 1 : 0); }
  if (data.fields) { fields.push('fields = ?'); values.push(JSON.stringify(data.fields)); }
  if (data.variants) { fields.push('variants = ?'); values.push(JSON.stringify(data.variants)); }
  if (data.supplier !== undefined) { fields.push('supplier = ?'); values.push(data.supplier ? JSON.stringify(data.supplier) : null); }
  if (data.costScenario !== undefined) { fields.push('cost_scenario = ?'); values.push(data.costScenario ? JSON.stringify(data.costScenario) : null); }
  if (data.codScenario !== undefined) { fields.push('cod_scenario = ?'); values.push(data.codScenario ? JSON.stringify(data.codScenario) : null); }

  values.push(c.req.param('id'));
  await execute(c.env, `UPDATE products SET ${fields.join(', ')} WHERE id = ?`, values);
  return c.json(successResponse(null, 'Product updated'));
});

products.delete('/:id', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;
  await execute(c.env, 'DELETE FROM products WHERE id = ?', [c.req.param('id')]);
  return c.json(successResponse(null, 'Product deleted'));
});

export default products;
