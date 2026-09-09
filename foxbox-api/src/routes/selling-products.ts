import { Hono } from 'hono';
import type { Env } from '../types/env';
import { query, queryOne, execute, generateId, nowISO } from '../db/client';
import { successResponse, errorResponse } from '../utils/response';
import { authenticate } from '../middleware/auth';

const sellingProducts = new Hono<{ Bindings: Env }>();

// ─── List ──────────────────────────────────────────────────
sellingProducts.get('/', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const url = new URL(c.req.url);
  const status = url.searchParams.get('status');
  const search = url.searchParams.get('search');

  let sql = 'SELECT * FROM selling_products WHERE 1=1';
  const params: unknown[] = [];
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (search) { sql += ' AND (name LIKE ? OR sku LIKE ? OR description LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  sql += ' ORDER BY created_at DESC';

  const results = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json(successResponse(results.results));
});

// ─── Get single ────────────────────────────────────────────
sellingProducts.get('/:id', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const product = await queryOne(c.env, 'SELECT * FROM selling_products WHERE id = ?', [c.req.param('id')]);
  if (!product) return c.json(errorResponse('Not found', 404));
  return c.json(successResponse(product));
});

// ─── Check if research product is already linked ───────────
sellingProducts.get('/check-research/:researchProductId', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const researchProductId = c.req.param('researchProductId');
  const existing = await queryOne(
    c.env,
    'SELECT id, name FROM selling_products WHERE research_product_id = ?',
    [researchProductId],
  );
  if (existing) {
    return c.json(successResponse({ exists: true, sellingProduct: existing }));
  }
  return c.json(successResponse({ exists: false }));
});

// ─── Create ────────────────────────────────────────────────
sellingProducts.post('/', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const data = await c.req.json();
  const id = generateId();
  const now = nowISO();

  // Validate required fields
  if (!data.name || !data.sku) {
    return c.json(errorResponse('name and sku are required', 400));
  }

  // Duplicate prevention: check if research product already linked
  if (data.researchProductId) {
    const existing = await queryOne(
      c.env,
      'SELECT id, name FROM selling_products WHERE research_product_id = ?',
      [data.researchProductId],
    );
    if (existing) {
      return c.json(errorResponse('This product is already in Selling Products', 409));
    }
  }

  await execute(c.env,
    `INSERT INTO selling_products (id, name, sku, description, image_url, selling_price_dzd, cost_price_dzd, stock, available_stock, status, weight, supplier, supplier_ref, notes, research_product_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.name,
      data.sku,
      data.description || null,
      data.imageUrl || null,
      data.sellingPriceDzd || 0,
      data.costPriceDzd || 0,
      data.stock || 0,
      data.availableStock || data.stock || 0,
      data.status || 'ACTIVE',
      data.weight || null,
      data.supplier || null,
      data.supplierRef || null,
      data.notes || null,
      data.researchProductId || null,
      now,
      now,
    ]
  );

  return c.json(successResponse({ id }));
});

// ─── Update ────────────────────────────────────────────────
sellingProducts.put('/:id', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const data = await c.req.json();
  const now = nowISO();
  const fields: string[] = ['updated_at = ?'];
  const values: unknown[] = [now];

  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data.sku !== undefined) { fields.push('sku = ?'); values.push(data.sku); }
  if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
  if (data.imageUrl !== undefined) { fields.push('image_url = ?'); values.push(data.imageUrl); }
  if (data.sellingPriceDzd !== undefined) { fields.push('selling_price_dzd = ?'); values.push(data.sellingPriceDzd); }
  if (data.costPriceDzd !== undefined) { fields.push('cost_price_dzd = ?'); values.push(data.costPriceDzd); }
  if (data.stock !== undefined) { fields.push('stock = ?'); values.push(data.stock); }
  if (data.availableStock !== undefined) { fields.push('available_stock = ?'); values.push(data.availableStock); }
  if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
  if (data.weight !== undefined) { fields.push('weight = ?'); values.push(data.weight); }
  if (data.supplier !== undefined) { fields.push('supplier = ?'); values.push(data.supplier); }
  if (data.supplierRef !== undefined) { fields.push('supplier_ref = ?'); values.push(data.supplierRef); }
  if (data.notes !== undefined) { fields.push('notes = ?'); values.push(data.notes); }

  values.push(c.req.param('id'));
  await execute(c.env, `UPDATE selling_products SET ${fields.join(', ')} WHERE id = ?`, values);
  return c.json(successResponse(null, 'Selling product updated'));
});

// ─── Delete ────────────────────────────────────────────────
sellingProducts.delete('/:id', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const id = c.req.param('id');
  const product = await queryOne(c.env, 'SELECT id, name FROM selling_products WHERE id = ?', [id]);
  if (!product) return c.json(errorResponse('Not found', 404));

  await execute(c.env, 'DELETE FROM selling_products WHERE id = ?', [id]);
  return c.json(successResponse(null, 'Selling product deleted'));
});

export default sellingProducts;
