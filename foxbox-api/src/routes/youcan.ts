import { Hono } from 'hono';
import type { Env } from '../types/env';
import { query, queryOne, execute, generateId, nowISO } from '../db/client';
import { successResponse, errorResponse } from '../utils/response';
import { authenticate } from '../middleware/auth';

const youcan = new Hono<{ Bindings: Env }>();

const YOUCAN_AUTH_URL = 'https://seller-area.youcan.shop/admin/oauth/authorize';
const YOUCAN_TOKEN_URL = 'https://api.youcan.shop/oauth/token';
const YOUCAN_API_BASE = 'https://api.youcan.shop';
const SCOPES = ['read-orders', 'edit-orders', 'read-products', 'read-customers', 'view-store-info', 'read-rest-hooks', 'edit-rest-hooks'];

const CUSTOM_FIELD_IDS = {
  wilaya: 'custom_field_fFrOxH7GM72dryHs',
  baladiya: 'custom_field_qWinKYIa7mPhzCoz',
  delivery: 'custom_field_qS2U2G8nm4EoHNsO',
  phone: 'custom_field_ejW2E1CnndIqK5Px',
};

// ─── Delivery Fee Calculation ───────────────────────────────
// [HOME_PRICE, OFFICE_PRICE] — FoxBox operational delivery fee

const DELIVERY_PRICES: Record<string, [number, number]> = {
  "01": [1100, 750],
  "02": [700, 400],
  "03": [900, 550],
  "04": [800, 450],
  "05": [800, 450],
  "06": [700, 450],
  "07": [900, 550],
  "08": [1100, 700],
  "09": [500, 350],
  "10": [650, 450],
  "11": [1500, 1100],
  "12": [800, 500],
  "13": [800, 450],
  "14": [800, 450],
  "15": [650, 400],
  "16": [400, 300],
  "17": [900, 550],
  "18": [700, 450],
  "19": [700, 450],
  "20": [800, 450],
  "21": [700, 450],
  "22": [700, 450],
  "23": [700, 450],
  "24": [800, 450],
  "25": [700, 450],
  "26": [650, 450],
  "27": [700, 450],
  "28": [800, 500],
  "29": [700, 450],
  "30": [1000, 600],
  "31": [700, 400],
  "32": [1000, 700],
  "33": [1000, 600],
  "34": [700, 450],
  "35": [600, 350],
  "36": [800, 450],
  "37": [1000, 600],
  "38": [800, 450],
  "39": [900, 550],
  "40": [800, 500],
  "41": [800, 500],
  "42": [600, 350],
  "43": [700, 450],
  "44": [700, 450],
  "45": [1000, 600],
  "46": [700, 450],
  "47": [1000, 550],
  "48": [700, 450],
  "49": [1300, 750],
  "50": [1600, 1000],
  "51": [900, 550],
  "52": [1300, 800],
  "53": [1000, 600],
  "55": [1000, 600],
  "56": [1000, 600],
  "57": [950, 600],
  "58": [1000, 550],
};

function calculateDeliveryFee(
  wilayaCode: string | null,
  shippingMethod: string
): number | null {
  if (!wilayaCode) return null;
  const prices = DELIVERY_PRICES[wilayaCode];
  if (!prices) return null;
  return shippingMethod === 'bureau' ? prices[1] : prices[0];
}

// ─── Deleted Order Registry ─────────────────────────────────
// Centralized check: should this YouCan order be skipped?

async function isOrderPermanentlyDeleted(env: Env, youcanOrderId: string): Promise<boolean> {
  const row = await queryOne(env, 'SELECT youcan_order_id FROM deleted_youcan_orders WHERE youcan_order_id = ?', [youcanOrderId]);
  return !!row;
}

async function registerDeletedOrder(env: Env, youcanOrderId: string, deletedBy?: string, reason?: string): Promise<void> {
  // Use INSERT OR IGNORE to handle idempotent deletion
  await execute(env,
    'INSERT OR IGNORE INTO deleted_youcan_orders (youcan_order_id, deleted_at, deleted_by, reason) VALUES (?, datetime("now"), ?, ?)',
    [youcanOrderId, deletedBy || null, reason || null]
  );
}

// ─── Token Management ──────────────────────────────────────

async function getConnection(env: Env) {
  return queryOne(env, 'SELECT * FROM youcan_connections WHERE id = ?', ['youcan-001']);
}

async function saveConnection(env: Env, data: Record<string, unknown>) {
  const existing = await getConnection(env);
  if (existing) {
    const sets = Object.keys(data).map(k => `${k} = ?`).join(', ');
    const values = Object.values(data);
    await execute(env, `UPDATE youcan_connections SET ${sets}, updated_at = datetime('now') WHERE id = ?`, [...values, 'youcan-001']);
  } else {
    const cols = ['id', ...Object.keys(data)];
    const placeholders = cols.map(() => '?').join(', ');
    const values = ['youcan-001', ...Object.values(data)];
    await execute(env, `INSERT INTO youcan_connections (${cols.join(', ')}) VALUES (${placeholders})`, values);
  }
}

async function getValidToken(env: Env): Promise<string> {
  const conn = await getConnection(env);
  if (!conn?.access_token) throw new Error('Not connected to YouCan');

  if (conn.expires_at) {
    const expiresAt = new Date(conn.expires_at as string).getTime();
    const now = Date.now();
    if (expiresAt - now < 3600000) {
      const refreshed = await refreshAccessToken(env);
      return refreshed;
    }
  }
  return conn.access_token as string;
}

async function refreshAccessToken(env: Env): Promise<string> {
  const conn = await getConnection(env);
  if (!conn?.refresh_token) throw new Error('No refresh token');

  const credentials = btoa(`${env.YOUCAN_CLIENT_ID || ''}:${env.YOUCAN_CLIENT_SECRET || ''}`);
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: conn.refresh_token as string,
  });

  const res = await fetch(YOUCAN_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    await saveConnection(env, { status: 'ERROR', error_message: `Refresh failed: ${res.status}` });
    throw new Error(`Token refresh failed: ${res.status} ${err}`);
  }

  const data = await res.json() as { access_token: string; refresh_token?: string; expires_in: number };
  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

  await saveConnection(env, {
    access_token: data.access_token,
    refresh_token: data.refresh_token || conn.refresh_token,
    expires_at: expiresAt,
    status: 'CONNECTED',
    error_message: null,
  });

  return data.access_token;
}

async function youcanRequest(env: Env, method: string, path: string, body?: unknown): Promise<unknown> {
  const token = await getValidToken(env);
  const opts: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  };
  if (body && method !== 'GET') opts.body = JSON.stringify(body);

  const res = await fetch(`${YOUCAN_API_BASE}${path}`, opts);

  if (res.status === 401) {
    const newToken = await refreshAccessToken(env);
    (opts.headers as Record<string, string>)['Authorization'] = `Bearer ${newToken}`;
    const retryRes = await fetch(`${YOUCAN_API_BASE}${path}`, opts);
    if (!retryRes.ok) throw new Error(`YouCan API error after refresh: ${retryRes.status}`);
    return retryRes.json();
  }

  if (!res.ok) throw new Error(`YouCan API error: ${res.status}`);
  return res.json();
}

function parseCustomFields(ycOrder: Record<string, unknown>) {
  const result = {
    wilaya: null as string | null,
    wilayaCode: null as string | null,
    baladiya: null as string | null,
    deliveryMethod: 'domicile' as string,
    officeCode: null as string | null,
    officeName: null as string | null,
    phone: null as string | null,
  };

  const customFields = (ycOrder.custom_fields || {}) as Record<string, string>;
  const extraFields = (ycOrder.extra_fields || {}) as Record<string, string>;

  // ── Wilaya: "44 ~ عين الدفلى" → code="44", name="عين الدفلى" ──
  const wilayaRaw = customFields[CUSTOM_FIELD_IDS.wilaya] || extraFields['الولاية'] || '';
  if (wilayaRaw) {
    const tildeIdx = wilayaRaw.indexOf('~');
    if (tildeIdx !== -1) {
      result.wilayaCode = wilayaRaw.substring(0, tildeIdx).trim();
      result.wilaya = wilayaRaw.substring(tildeIdx + 1).trim();
    } else {
      const trimmed = wilayaRaw.trim();
      if (/^\d{1,2}$/.test(trimmed)) {
        result.wilayaCode = trimmed;
      } else {
        result.wilaya = trimmed;
      }
    }
  }

  // ── Baladiya ──
  result.baladiya = customFields[CUSTOM_FIELD_IDS.baladiya] || extraFields['البلدية'] || null;

  // ── Shipping method + stopdesk code ──
  const deliveryRaw = customFields[CUSTOM_FIELD_IDS.delivery] || extraFields['التوصيل'] || '';
  if (deliveryRaw.match(/مكتب|stop|desk|bureau|توصيل للمكتب/)) {
    result.deliveryMethod = 'bureau';
    const officeMatch = deliveryRaw.match(/(\d{2}[A-Z])/);
    if (officeMatch) result.officeCode = officeMatch[1];
  }

  // ── Phone ──
  result.phone = customFields[CUSTOM_FIELD_IDS.phone] || extraFields['رقم الهاتف'] || null;

  return result;
}

function normalizeYouCanOrder(ycOrder: Record<string, unknown>) {
  const custom = parseCustomFields(ycOrder);
  const variants = (ycOrder.variants || []) as Array<Record<string, unknown>>;
  const items = variants.map(v => {
    const variant = (v.variant || {}) as Record<string, unknown>;
    const product = (variant.product || {}) as Record<string, unknown>;
    return {
      externalProductId: product.id || null,
      productName: product.name || 'Unknown',
      variant: variant.variations || null,
      sku: variant.sku || null,
      ref: variant.ref || product.ref || null,
      qty: parseInt(String(v.quantity)) || 1,
      unitPrice: parseInt(String(v.price)) || 0,
      totalPrice: (parseInt(String(v.price)) || 0) * (parseInt(String(v.quantity)) || 1),
    };
  });

  const shipping = (ycOrder.shipping || {}) as Record<string, unknown>;
  const shippingAddr = (shipping.address || {}) as Record<string, unknown>;
  const payment = (ycOrder.payment || {}) as Record<string, unknown>;
  const paymentObj = (payment.status_object || {}) as Record<string, string>;
  const statusObj = (ycOrder.status_object || {}) as Record<string, string>;

  const paymentStatusMap: Record<string, string> = { unpaid: 'pending', paid: 'paid', refunded: 'refunded', partially_refunded: 'refunded' };
  const orderStatusMap: Record<string, string> = { open: 'open', confirmed: 'confirmed', cancelled: 'cancelled', completed: 'completed', closed: 'cancelled' };

  const subtotal = parseInt(String(ycOrder.subtotal)) || 0;
  const shippingCost = parseInt(String(shipping.price)) || 0;
  const total = parseInt(String(ycOrder.total)) || 0;

  const fullName = (shippingAddr.full_name || '').trim();
  const customerName = fullName || null;

  const calculatedDeliveryFee = calculateDeliveryFee(custom.wilayaCode, custom.deliveryMethod);
  const deliveryFee = calculatedDeliveryFee ?? shippingCost;
  const totalToCollect = total + (calculatedDeliveryFee ?? 0);

  // Extract note from YouCan order
  const note = ((ycOrder.note as string) || (ycOrder.customer_note as string) || '').trim() || null;

  return {
    external_order_id: String(ycOrder.id),
    order_ref: ycOrder.ref || null,
    source: 'YOUCAN',
    store_id: ycOrder.store_id || null,
    store_name: ycOrder.store_name || null,
    customer_name: customerName,
    customer_email: null,
    customer_phone: custom.phone || null,
    wilaya: custom.wilaya,
    wilaya_code: custom.wilayaCode,
    baladiya: custom.baladiya,
    address: [shippingAddr.first_line, shippingAddr.second_line].filter(Boolean).join(', ') || null,
    shipping_method: custom.deliveryMethod,
    office_code: custom.officeCode,
    office_name: custom.officeName,
    stopdesk_code: custom.deliveryMethod === 'bureau' ? custom.officeCode : null,
    order_items: JSON.stringify(items),
    quantity: items.reduce((sum: number, i: { qty: number }) => sum + i.qty, 0),
    subtotal,
    shipping_cost: shippingCost,
    delivery_fee: deliveryFee,
    total,
    total_to_collect: totalToCollect,
    currency: ycOrder.currency || 'DZD',
    payment_status: paymentStatusMap[paymentObj.slug as string] || String(ycOrder.payment_status || 'pending'),
    shipping_status: ycOrder.shipping_status || 'unfulfilled',
    order_status: orderStatusMap[statusObj.slug as string] || String(ycOrder.status || 'open'),
    note,
    exchange: 0,
    youcan_created_at: ycOrder.created_at || null,
    youcan_updated_at: ycOrder.updated_at || null,
    raw_payload: JSON.stringify(ycOrder),
  };
}

// ─── OAuth Routes ───────────────────────────────────────────

youcan.get('/youcan/oauth/connect', async (c) => {
  if (!c.env.YOUCAN_CLIENT_ID || !c.env.YOUCAN_CLIENT_SECRET) {
    return errorResponse('YouCan OAuth not configured', 500);
  }
  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: c.env.YOUCAN_CLIENT_ID,
    redirect_uri: c.env.YOUCAN_REDIRECT_URI || `${new URL(c.req.url).origin}/api/youcan/oauth/callback`,
    response_type: 'code',
    state,
  });
  SCOPES.forEach(s => params.append('scope[]', s));
  return successResponse({ url: `${YOUCAN_AUTH_URL}?${params.toString()}`, state });
});

youcan.get('/youcan/oauth/callback', async (c) => {
  const code = c.req.query('code');
  const error = c.req.query('error');
  const frontendUrl = c.env.FRONTEND_URL || 'http://localhost:5173';

  if (error || !code) {
    return c.redirect(`${frontendUrl}/app/settings?youcan=error&message=${encodeURIComponent(error || 'no_code')}`);
  }

  try {
    const credentials = btoa(`${c.env.YOUCAN_CLIENT_ID || ''}:${c.env.YOUCAN_CLIENT_SECRET || ''}`);
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      redirect_uri: c.env.YOUCAN_REDIRECT_URI || `${new URL(c.req.url).origin}/api/youcan/oauth/callback`,
      code,
    });

    const res = await fetch(YOUCAN_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: body.toString(),
    });

    if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
    const data = await res.json() as { access_token: string; refresh_token: string; expires_in: number; token_type: string };
    const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

    let storeName = 'YouCan Store';
    try {
      const token = data.access_token;
      const storeRes = await fetch(`${YOUCAN_API_BASE}/stores`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
      });
      if (storeRes.ok) {
        const storeData = await storeRes.json() as { name?: string };
        if (storeData.name) storeName = storeData.name;
      }
    } catch { /* ignore */ }

    await saveConnection(c.env, {
      store_name: storeName,
      client_id: c.env.YOUCAN_CLIENT_ID,
      client_secret: c.env.YOUCAN_CLIENT_SECRET,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: expiresAt,
      token_type: data.token_type || 'Bearer',
      scopes: JSON.stringify(SCOPES),
      status: 'CONNECTED',
      connected_at: new Date().toISOString(),
      orders_synced_count: 0,
    });

    const webhookUrl = `${c.env.YOUCAN_REDIRECT_URI?.replace('/api/youcan/oauth/callback', '') || 'https://foxbox-api.foxboxsolutions01.workers.dev'}/api/webhooks/youcan/orders`;
    try {
      await fetch(`${YOUCAN_API_BASE}/resthooks/subscribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${data.access_token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ event: 'order.create', target_url: webhookUrl }),
      });
    } catch { /* non-critical */ }

    return c.redirect(`${frontendUrl}/app/settings?youcan=connected`);
  } catch (err) {
    return c.redirect(`${frontendUrl}/app/settings?youcan=error&message=${encodeURIComponent(err instanceof Error ? err.message : 'Unknown')}`);
  }
});

youcan.post('/youcan/oauth/disconnect', async (c) => {
  await saveConnection(c.env, {
    access_token: '', refresh_token: '', expires_at: null, status: 'DISCONNECTED',
    store_name: '', error_message: null,
  });
  return successResponse(null, 'Disconnected');
});

youcan.post('/youcan/resthooks/subscribe', async (c) => {
  try {
    const frontendUrl = c.env.FRONTEND_URL || 'http://localhost:5173';
    const webhookUrl = `${c.env.YOUCAN_REDIRECT_URI?.replace('/api/youcan/oauth/callback', '') || 'https://foxbox-api.foxboxsolutions01.workers.dev'}/api/webhooks/youcan/orders`;
    const data = await youcanRequest(c.env, 'POST', '/resthooks/subscribe', {
      event: 'order.create',
      target_url: webhookUrl,
    });
    return successResponse({ success: true, hook: data });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'RestHook subscription failed', 500);
  }
});

// ─── Status ─────────────────────────────────────────────────

youcan.get('/youcan/status', async (c) => {
  const conn = await getConnection(c.env);
  const hasCredentials = !!(c.env.YOUCAN_CLIENT_ID && c.env.YOUCAN_CLIENT_SECRET);
  const hasToken = !!conn?.access_token;

  let tokenStatus = 'none';
  if (hasToken && conn?.expires_at) {
    const timeLeft = new Date(conn.expires_at as string).getTime() - Date.now();
    tokenStatus = timeLeft > 0 ? (timeLeft < 3600000 ? 'expiring_soon' : 'valid') : 'expired';
  } else if (hasToken) {
    tokenStatus = 'valid';
  }

  return successResponse({
    configured: hasCredentials,
    connected: conn?.status === 'CONNECTED' && hasToken,
    status: conn?.status || 'DISCONNECTED',
    storeName: conn?.store_name || '',
    connectedAt: conn?.connected_at,
    lastSyncAt: conn?.last_sync_at,
    lastWebhookAt: conn?.last_webhook_at,
    ordersSyncedCount: conn?.orders_synced_count || 0,
    tokenStatus,
    expiresAt: conn?.expires_at,
    errorMessage: conn?.error_message,
    clientId: c.env.YOUCAN_CLIENT_ID ? '***configured***' : 'not configured',
  });
});

youcan.post('/youcan/test', async (c) => {
  try {
    const data = await youcanRequest(c.env, 'GET', '/stores');
    return successResponse({ success: true, store: data });
  } catch (err) {
    return successResponse({ success: false, error: err instanceof Error ? err.message : 'Test failed' });
  }
});

// ─── Customer Enrichment ─────────────────────────────────────

interface CustomerIndex {
  byPhone: Record<string, string>;
  byEmail: Record<string, string>;
  sorted: Array<{ name: string; createdAt: number }>;
  raw: Array<Record<string, unknown>>;
}

async function fetchAllCustomers(env: Env): Promise<Array<Record<string, unknown>>> {
  const customers: Array<Record<string, unknown>> = [];
  let page = 1;
  const perPage = 50;
  const maxPages = 50;

  while (page <= maxPages) {
    const data = await youcanRequest(env, 'GET', `/customers?page=${page}&per_page=${perPage}`) as { data?: Record<string, unknown>[]; meta?: { current_page: number; last_page: number } };
    const batch = data.data || (data as unknown as Record<string, unknown>[]) || [];
    if (!Array.isArray(batch) || batch.length === 0) break;
    customers.push(...batch);
    if (data.meta?.current_page && data.meta?.current_page >= data.meta?.last_page) break;
    page++;
  }
  return customers;
}

function extractCustomerName(cust: Record<string, unknown>): string {
  const firstName = (cust.first_name as string || '').trim();
  const lastName = (cust.last_name as string || '').trim();
  // YouCan often stores full name in first_name
  if (firstName && lastName) return `${firstName} ${lastName}`;
  if (firstName) return firstName;
  if (lastName) return lastName;
  // Fallback: full_name field
  const fullName = (cust.full_name as string || '').trim();
  return fullName || '';
}

function buildCustomerIndex(customers: Array<Record<string, unknown>>): CustomerIndex {
  const byPhone: Record<string, string> = {};
  const byEmail: Record<string, string> = {};
  const sorted: Array<{ name: string; createdAt: number }> = [];

  for (const cust of customers) {
    const name = extractCustomerName(cust);
    if (!name) continue;

    const phone = (cust.phone as string || '').trim();
    const email = (cust.email as string || '').trim();
    const createdAtStr = (cust.created_at as string || '').trim();
    const createdAt = createdAtStr ? new Date(createdAtStr).getTime() : 0;

    if (phone) byPhone[phone] = name;
    if (email) byEmail[email] = name;
    if (createdAt > 0) sorted.push({ name, createdAt });
  }

  sorted.sort((a, b) => a.createdAt - b.createdAt);
  return { byPhone, byEmail, sorted, raw: customers };
}

function findCustomerByTimestamp(index: CustomerIndex, orderTimestampMs: number, maxDiffMs = 120000): string | null {
  // When a customer places an order, YouCan creates the customer account
  // at approximately the same time. Match by timestamp proximity.
  let best: { name: string; diff: number } | null = null;
  for (const cust of index.sorted) {
    const diff = Math.abs(cust.createdAt - orderTimestampMs);
    if (diff <= maxDiffMs && (!best || diff < best.diff)) {
      best = { name: cust.name, diff };
    }
  }
  return best?.name || null;
}

function resolveCustomerName(
  index: CustomerIndex | null,
  ycOrder: Record<string, unknown>,
  existingName: string | null
): string | null {
  // If we already have a valid name, keep it
  if (existingName && existingName.trim() && existingName.trim() !== ' ') return existingName.trim();

  if (!index) return existingName;

  // Strategy 1: Match by phone (order's custom_fields → customer's phone)
  const customFields = (ycOrder.custom_fields || {}) as Record<string, string>;
  const phone = (customFields[CUSTOM_FIELD_IDS.phone] || '').trim();
  if (phone && index.byPhone[phone]) return index.byPhone[phone];

  // Strategy 2: Match by email
  const email = ((ycOrder.email as string) || '').trim();
  if (email && index.byEmail[email]) return index.byEmail[email];

  // Strategy 3: Match by timestamp proximity (customer created ≈ order placed)
  const orderCreatedAt = (ycOrder.created_at as string || '').trim();
  if (orderCreatedAt) {
    const orderTs = new Date(orderCreatedAt).getTime();
    if (orderTs > 0) {
      const nameFromTimestamp = findCustomerByTimestamp(index, orderTs);
      if (nameFromTimestamp) return nameFromTimestamp;
    }
  }

  return existingName;
}

youcan.get('/youcan/customers', async (c) => {
  try {
    const customers = await fetchAllCustomers(c.env);
    // Return with extracted names for debugging
    const enriched = customers.map(cust => ({
      ...cust,
      _extractedName: extractCustomerName(cust),
    }));
    return successResponse({ customers: enriched, total: customers.length });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed to fetch customers', 500);
  }
});

youcan.post('/youcan/enrich-customers', async (c) => {
  try {
    const customers = await fetchAllCustomers(c.env);
    const index = buildCustomerIndex(customers);

    const orders = await query(c.env, "SELECT id, customer_name, customer_phone, customer_email, youcan_created_at, raw_payload FROM youcan_orders WHERE customer_name IS NULL OR customer_name = '' OR customer_name = ' '");
    let enriched = 0;

    for (const order of orders) {
      // Try to extract from raw_payload first
      let rawPayload: Record<string, unknown> = {};
      try { rawPayload = JSON.parse(order.raw_payload as string || '{}'); } catch {}

      const name = resolveCustomerName(index, rawPayload, order.customer_name as string | null);

      if (name && name !== order.customer_name) {
        await execute(c.env, 'UPDATE youcan_orders SET customer_name = ? WHERE id = ?', [name, order.id]);
        enriched++;
      }
    }

    return successResponse({
      totalCustomers: customers.length,
      enriched,
      customerIndex: {
        phoneMatches: Object.keys(index.byPhone).length,
        emailMatches: Object.keys(index.byEmail).length,
        timestampMatches: index.sorted.length,
      },
    });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Enrichment failed', 500);
  }
});

// ─── Backfill Delivery Fees ─────────────────────────────────

youcan.post('/youcan/backfill-delivery-fees', async (c) => {
  try {
    const orders = await query(c.env, 'SELECT id, wilaya_code, shipping_method, delivery_fee FROM youcan_orders');
    let updated = 0;
    let skipped = 0;
    const results: Array<{ id: string; wilayaCode: string; method: string; oldFee: number; newFee: number }> = [];

    for (const order of orders) {
      const wilayaCode = order.wilaya_code as string | null;
      const shippingMethod = (order.shipping_method as string) || 'domicile';
      const calculatedFee = calculateDeliveryFee(wilayaCode, shippingMethod);

      if (calculatedFee !== null) {
        const oldFee = order.delivery_fee as number;
        if (oldFee !== calculatedFee) {
          await execute(c.env, 'UPDATE youcan_orders SET delivery_fee = ?, updated_at = datetime("now") WHERE id = ?', [calculatedFee, order.id]);
          results.push({ id: order.id as string, wilayaCode: wilayaCode || '', method: shippingMethod, oldFee, newFee: calculatedFee });
          updated++;
        } else {
          skipped++;
        }
      } else {
        skipped++;
      }
    }

    return successResponse({
      totalOrders: orders.length,
      updated,
      skipped,
      results: results.slice(0, 20),
    });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Backfill failed', 500);
  }
});

// ─── Sync Orders ────────────────────────────────────────────

youcan.post('/youcan/sync', async (c) => {
  try {
    let page = 1;
    let totalSynced = 0;
    const maxPages = 100;
    const perPage = 50;

    // Pre-fetch all customers for name resolution
    let customerIndex: CustomerIndex | null = null;
    try {
      const customers = await fetchAllCustomers(c.env);
      customerIndex = buildCustomerIndex(customers);
    } catch { /* non-critical */ }

    while (page <= maxPages) {
      const data = await youcanRequest(c.env, 'GET', `/orders?page=${page}&per_page=${perPage}`) as { data?: Record<string, unknown>[]; meta?: { current_page: number; last_page: number } };
      const orders = data.data || (data as unknown as Record<string, unknown>[]) || [];

      if (!Array.isArray(orders) || orders.length === 0) break;

      for (const ycOrder of orders) {
        const ycOrderId = String(ycOrder.id);

        // PERMANENT DELETION CHECK: Skip if this order was permanently deleted
        if (await isOrderPermanentlyDeleted(c.env, ycOrderId)) {
          continue; // Silently skip — do not insert, update, or restore
        }

        // Get existing customer_name if order already exists
        const existingOrder = await queryOne(c.env, 'SELECT id, customer_name FROM youcan_orders WHERE external_order_id = ?', [ycOrderId]);
        const existingName = existingOrder?.customer_name as string | null || null;

        // Resolve customer name from Customers API
        const resolvedName = resolveCustomerName(customerIndex, ycOrder, existingName);

        const normalized = normalizeYouCanOrder(ycOrder);
        // Override customer_name with resolved name from Customers API
        if (resolvedName) normalized.customer_name = resolvedName;

        if (existingOrder) {
          const sets = Object.keys(normalized).map(k => `${k} = ?`).join(', ');
          const values = Object.values(normalized);
          await execute(c.env, `UPDATE youcan_orders SET ${sets}, updated_at = datetime('now') WHERE external_order_id = ?`, [...values, normalized.external_order_id]);
        } else {
          const cols = ['id', ...Object.keys(normalized)];
          const placeholders = cols.map(() => '?').join(', ');
          const id = 'yc-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
          const values = [id, ...Object.values(normalized)];
          await execute(c.env, `INSERT INTO youcan_orders (${cols.join(', ')}) VALUES (${placeholders})`, values);
        }
        totalSynced++;
      }

      if (data.meta?.current_page && data.meta?.current_page >= data.meta?.last_page) break;
      page++;
    }

    await saveConnection(c.env, {
      last_sync_at: new Date().toISOString(),
      orders_synced_count: totalSynced,
    });

    // Post-sync enrichment: fix any orders still missing customer names
    if (customerIndex) {
      try {
        const nullNameOrders = await query(c.env, "SELECT id, raw_payload, youcan_created_at FROM youcan_orders WHERE customer_name IS NULL OR customer_name = '' OR customer_name = ' '");
        let enriched = 0;
        for (const order of nullNameOrders) {
          let rawPayload: Record<string, unknown> = {};
          try { rawPayload = JSON.parse(order.raw_payload as string || '{}'); } catch {}
          const name = resolveCustomerName(customerIndex, rawPayload, null);
          if (name) {
            await execute(c.env, 'UPDATE youcan_orders SET customer_name = ? WHERE id = ?', [name, order.id]);
            enriched++;
          }
        }
        if (enriched > 0) {
          // Re-count total synced with enriched names
          totalSynced += enriched;
        }
      } catch { /* non-critical enrichment */ }
    }

    return successResponse({ ordersSynced: totalSynced, totalPages: page });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Sync failed', 500);
  }
});

// ─── List Orders ────────────────────────────────────────────

youcan.get('/youcan/orders', async (c) => {
  const url = new URL(c.req.url);
  const status = url.searchParams.get('status');
  const paymentStatus = url.searchParams.get('payment_status');
  const shippingStatus = url.searchParams.get('shipping_status');
  const wilaya = url.searchParams.get('wilaya');
  const deliveryMethod = url.searchParams.get('delivery_method');
  const search = url.searchParams.get('search');
  const sort = url.searchParams.get('sort') || 'newest';
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '50');

  let sql = 'SELECT * FROM youcan_orders WHERE 1=1';
  const params: unknown[] = [];

  if (status) { sql += ' AND order_status = ?'; params.push(status); }
  if (paymentStatus) { sql += ' AND payment_status = ?'; params.push(paymentStatus); }
  if (shippingStatus) { sql += ' AND shipping_status = ?'; params.push(shippingStatus); }
  if (wilaya) { sql += ' AND (wilaya LIKE ? OR wilaya_code = ?)'; params.push(`%${wilaya}%`, wilaya); }
  if (deliveryMethod) { sql += ' AND shipping_method = ?'; params.push(deliveryMethod); }
  if (search) {
    sql += ' AND (external_order_id LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ? OR customer_email LIKE ?)';
    const q = `%${search}%`;
    params.push(q, q, q, q);
  }

  // Count
  const countResult = await c.env.DB.prepare(sql.replace('SELECT *', 'SELECT COUNT(*) as count')).bind(...params).first() as { count: number };
  const total = countResult?.count || 0;

  // Sort
  if (sort === 'oldest') sql += ' ORDER BY created_at ASC';
  else if (sort === 'amount_asc') sql += ' ORDER BY total ASC';
  else if (sort === 'amount_desc') sql += ' ORDER BY total DESC';
  else if (sort === 'customer') sql += ' ORDER BY customer_name ASC';
  else sql += ' ORDER BY created_at DESC';

  // Paginate
  const offset = (page - 1) * limit;
  sql += ' LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const orders = await c.env.DB.prepare(sql).bind(...params).all();

  // KPIs
  const kpis = await c.env.DB.prepare(`
    SELECT
      COUNT(*) as totalOrders,
      SUM(CASE WHEN date(created_at) = date('now') THEN 1 ELSE 0 END) as newToday,
      SUM(CASE WHEN order_status = 'open' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN order_status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
      SUM(CASE WHEN order_status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
      SUM(total) as totalRevenue
    FROM youcan_orders
  `).first();

  return successResponse({
    orders: orders.results,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    kpis,
  });
});

youcan.get('/youcan/orders/:id', async (c) => {
  const order = await queryOne(c.env, 'SELECT * FROM youcan_orders WHERE id = ? OR external_order_id = ?', [c.req.param('id'), c.req.param('id')]);
  if (!order) return errorResponse('Order not found', 404);
  return successResponse(order);
});

youcan.put('/youcan/orders/:id/status', async (c) => {
  const { status } = await c.req.json();
  const order = await queryOne(c.env, 'SELECT * FROM youcan_orders WHERE id = ? OR external_order_id = ?', [c.req.param('id'), c.req.param('id')]);
  if (!order) return errorResponse('Order not found', 404);

  try {
    await youcanRequest(c.env, 'PUT', `/orders/${order.external_order_id}/status`, { status });
    await execute(c.env, 'UPDATE youcan_orders SET order_status = ?, updated_at = datetime("now") WHERE id = ?', [status, order.id]);
    return successResponse({ success: true });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed', 500);
  }
});

// ─── Webhook Receiver ───────────────────────────────────────

youcan.post('/webhooks/youcan/orders', async (c) => {
  const startTime = Date.now();
  const payload = await c.req.json();
  const eventId = payload.id || payload.event_id || `wh-${Date.now().toString(36)}`;
  const eventType = payload.event || payload.type || 'unknown';

  const logId = 'wl-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);

  try {
    const ycOrder = payload.data || payload.order || payload;
    if (!ycOrder?.id) {
      await execute(c.env,
        `INSERT INTO youcan_webhook_logs (id, event_id, event_type, received_at, order_id, status, error, processing_time_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [logId, eventId, eventType, new Date().toISOString(), null, 'FAILED', 'No order data', Date.now() - startTime]
      );
      return errorResponse('Invalid payload', 400);
    }

    // Check duplicate
    const existing = await queryOne(c.env, 'SELECT id, raw_payload FROM youcan_orders WHERE external_order_id = ?', [String(ycOrder.id)]);
    if (existing && (existing.raw_payload as string)?.includes(ycOrder.updated_at)) {
      await execute(c.env,
        `INSERT INTO youcan_webhook_logs (id, event_id, event_type, received_at, order_id, status, processing_time_ms) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [logId, eventId, eventType, new Date().toISOString(), String(ycOrder.id), 'DUPLICATE', Date.now() - startTime]
      );
      return successResponse({ status: 'duplicate' });
    }

    // PERMANENT DELETION CHECK: Skip if this order was permanently deleted
    if (await isOrderPermanentlyDeleted(c.env, String(ycOrder.id))) {
      await execute(c.env,
        `INSERT INTO youcan_webhook_logs (id, event_id, event_type, received_at, order_id, status, error, processing_time_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [logId, eventId, eventType, new Date().toISOString(), String(ycOrder.id), 'FAILED', 'Permanently deleted — skipped', Date.now() - startTime]
      );
      return successResponse({ status: 'skipped_deleted' });
    }

    const normalized = normalizeYouCanOrder(ycOrder);
    if (existing) {
      const sets = Object.keys(normalized).map(k => `${k} = ?`).join(', ');
      const values = Object.values(normalized);
      await execute(c.env, `UPDATE youcan_orders SET ${sets}, updated_at = datetime('now') WHERE external_order_id = ?`, [...values, normalized.external_order_id]);
    } else {
      const cols = ['id', ...Object.keys(normalized)];
      const placeholders = cols.map(() => '?').join(', ');
      const id = 'yc-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
      await execute(c.env, `INSERT INTO youcan_orders (${cols.join(', ')}) VALUES (${placeholders})`, [id, ...Object.values(normalized)]);
    }

    await saveConnection(c.env, { last_webhook_at: new Date().toISOString() });

    await execute(c.env,
      `INSERT INTO youcan_webhook_logs (id, event_id, event_type, received_at, order_id, status, processing_time_ms) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [logId, eventId, eventType, new Date().toISOString(), String(ycOrder.id), 'PROCESSED', Date.now() - startTime]
    );

    return successResponse({ status: 'ok', orderId: ycOrder.id });
  } catch (err) {
    await execute(c.env,
      `INSERT INTO youcan_webhook_logs (id, event_id, event_type, received_at, order_id, status, error, processing_time_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [logId, eventId, eventType, new Date().toISOString(), null, 'FAILED', err instanceof Error ? err.message : 'Unknown', Date.now() - startTime]
    );
    return errorResponse(err instanceof Error ? err.message : 'Webhook failed', 500);
  }
});

youcan.get('/youcan/webhook-logs', async (c) => {
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = (page - 1) * limit;

  const logs = await c.env.DB.prepare('SELECT * FROM youcan_webhook_logs ORDER BY received_at DESC LIMIT ? OFFSET ?').bind(limit, offset).all();
  const total = await c.env.DB.prepare('SELECT COUNT(*) as count FROM youcan_webhook_logs').first() as { count: number };

  return successResponse({
    logs: logs.results,
    total: total?.count || 0,
    page,
    totalPages: Math.ceil((total?.count || 0) / limit),
  });
});

youcan.post('/youcan/refresh-token', async (c) => {
  try {
    const expiresAt = await refreshAccessToken(c.env);
    return successResponse({ expiresAt });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Refresh failed', 500);
  }
});

// ─── Ecom Delivery Export ────────────────────────────────────
// Exports selected orders in Ecom Delivery's exact 13-column format

youcan.post('/youcan/ecom-export', async (c) => {
  try {
    const body = await c.req.json();
    const orderIds = body.orderIds as string[];
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return errorResponse('No order IDs provided', 400);
    }

    const placeholders = orderIds.map(() => '?').join(',');
    const orders = await query(c.env, `SELECT * FROM youcan_orders WHERE external_order_id IN (${placeholders})`, orderIds);

    const exportRows: Array<Record<string, string>> = [];
    const errors: Array<{ orderId: string; missing: string[] }> = [];

    for (const order of orders) {
      const missing: string[] = [];
      if (!order.customer_name) missing.push('customerName');
      if (!order.customer_phone) missing.push('phone');
      if (!order.order_items) missing.push('product');
      if (!order.wilaya_code) missing.push('wilayaCode');
      if (!order.baladiya) missing.push('baladiya');
      if (!order.delivery_fee) missing.push('deliveryFee');

      // Extract product name from order_items JSON
      let productName = '';
      let productRef = '';
      try {
        const items = JSON.parse(order.order_items as string || '[]');
        if (items.length > 0) {
          productName = items[0].productName || '';
          productRef = items[0].sku || items[0].ref || '';
        }
      } catch { /* empty */ }

      // Build address for Ecom: domicile → customer address, bureau → bureau info
      let ecomAddress = (order.address as string) || '';
      if (order.shipping_method === 'bureau') {
        const bureauParts = [order.office_name, order.wilaya].filter(Boolean).join(' - ');
        ecomAddress = bureauParts || ecomAddress;
      }

      const totalToCollect = (order.total as number || 0) + (order.delivery_fee as number || 0);

      // Wilaya: use code for Ecom "Nom ou Code Wilaya"
      const wilayaExport = order.wilaya_code || '';

      exportRows.push({
        'Nom Complet': order.customer_name || '',
        'Téléphone': order.customer_phone || '',
        'Article': productName,
        'Quantité': String(order.quantity || 1),
        'Adresse': ecomAddress,
        'Nom ou Code Wilaya': wilayaExport,
        'Commune': order.baladiya || '',
        'Total à ramasser': String(totalToCollect),
        'ID Externe': String(order.external_order_id || ''),
        'OUI pour Echange': (order.exchange as number) ? 'OUI' : 'NON',
        'Si Stopdesk mettez le Code du stopdesk': (order.shipping_method === 'bureau' && order.stopdesk_code) ? String(order.stopdesk_code) : '',
        'Ref Article': productRef,
        'Note': (order.note as string) || '',
      });

      if (missing.length > 0) {
        errors.push({ orderId: String(order.external_order_id), missing });
      }
    }

    return successResponse({
      rows: exportRows,
      total: exportRows.length,
      errors,
      missingCount: errors.length,
    });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Export failed', 500);
  }
});

// ─── Backfill total_to_collect + stopdesk_code ────────────────

youcan.post('/youcan/backfill-canonical-fields', async (c) => {
  try {
    const orders = await query(c.env, 'SELECT id, external_order_id, total, delivery_fee, shipping_method, office_code, stopdesk_code, total_to_collect, note, exchange FROM youcan_orders');
    let updated = 0;

    for (const order of orders) {
      const total = order.total as number || 0;
      const deliveryFee = order.delivery_fee as number || 0;
      const shippingMethod = (order.shipping_method as string) || 'domicile';
      const officeCode = order.office_code as string | null;

      const totalToCollect = total + deliveryFee;
      const stopdeskCode = shippingMethod === 'bureau' ? officeCode : null;

      // Only update if values differ
      if (
        (order.total_to_collect as number) !== totalToCollect ||
        (order.stopdesk_code as string | null) !== stopdeskCode
      ) {
        await execute(c.env,
          'UPDATE youcan_orders SET total_to_collect = ?, stopdesk_code = ?, updated_at = datetime("now") WHERE id = ?',
          [totalToCollect, stopdeskCode, order.id]
        );
        updated++;
      }
    }

    return successResponse({ totalOrders: orders.length, updated });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Backfill failed', 500);
  }
});

// ─── Delete Order (FOXBOX local + permanent registry) ───────

youcan.delete('/youcan/orders/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const order = await queryOne(c.env, 'SELECT id, external_order_id, customer_name FROM youcan_orders WHERE id = ? OR external_order_id = ?', [id, id]);
    if (!order) return errorResponse('Order not found', 404);

    const externalOrderId = order.external_order_id as string;

    // Step 1: Register as permanently deleted BEFORE removing
    await registerDeletedOrder(c.env, externalOrderId);

    // Step 2: Remove from local orders
    await execute(c.env, 'DELETE FROM youcan_orders WHERE id = ?', [order.id]);

    return successResponse({ deleted: true, id: order.id, externalOrderId });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Delete failed', 500);
  }
});

// ─── Push to Ecom Delivery ──────────────────────────────────

youcan.post('/youcan/push-to-ecom', async (c) => {
  try {
    const body = await c.req.json();
    const orderId = body.orderId as string;
    if (!orderId) return errorResponse('Missing orderId', 400);

    // Fetch the normalized order
    const order = await queryOne(c.env, 'SELECT * FROM youcan_orders WHERE id = ? OR external_order_id = ?', [orderId, orderId]);
    if (!order) return errorResponse('Order not found', 404);

    // Check if already pushed
    if (order.ecom_push_status === 'sent') {
      return errorResponse('This order has already been sent to Ecom Delivery', 409);
    }

    // Validate required fields
    const missing: string[] = [];
    if (!order.customer_name) missing.push('Nom Complet (customer name)');
    if (!order.customer_phone) missing.push('Téléphone (phone)');
    if (!order.order_items || order.order_items === '[]') missing.push('Article (product)');
    if (!order.wilaya_code) missing.push('Wilaya');
    if (!order.baladiya) missing.push('Commune (baladiya)');
    if (!order.external_order_id) missing.push('ID Externe');

    // Extract product info for validation
    let productName = '';
    let productRef = '';
    try {
      const items = JSON.parse(order.order_items as string || '[]');
      if (items.length > 0) {
        productName = items[0].productName || '';
        productRef = items[0].sku || items[0].ref || '';
      }
    } catch { /* empty */ }

    if (!productName) missing.push('Article (product name)');
    if (!productRef) missing.push('Ref Article (product reference)');

    // If bureau, require stopdesk code
    if (order.shipping_method === 'bureau' && !order.stopdesk_code) {
      missing.push('Stopdesk Code');
    }

    if (missing.length > 0) {
      return errorResponse(`Cannot push to Ecom Delivery. Missing: ${missing.join(', ')}`, 400);
    }

    // Build Ecom Delivery payload
    const totalToCollect = (order.total as number || 0) + (order.delivery_fee as number || 0);

    // Build address: domicile → customer address, bureau → bureau info
    let ecomAddress = (order.address as string) || '';
    if (order.shipping_method === 'bureau') {
      const bureauParts = [order.office_name, order.wilaya].filter(Boolean).join(' - ');
      ecomAddress = bureauParts || ecomAddress;
    }

    const payload = {
      nom_prenom: order.customer_name,
      telephone: order.customer_phone,
      telephone2: '',
      id_wilaya: parseInt(order.wilaya_code as string) || 0,
      commune: order.baladiya || '',
      adresse: ecomAddress,
      type_livraison: order.shipping_method === 'bureau' ? 'Stopdesk' : 'Domicile',
      id_stopdesk: order.stopdesk_code || '',
      note: (order.note as string) || '',
      produit: productName,
      quantite: order.quantity || 1,
      prix_total: totalToCollect,
      prix_livraison: order.delivery_fee || 0,
      id_externe: order.external_order_id,
    };

    // Call Ecom Delivery API
    const ecomHeaders: Record<string, string> = {
      'X-API-Key': c.env.ECOM_API_KEY || '',
      'X-API-Token': c.env.ECOM_API_TOKEN || '',
      'Content-Type': 'application/json',
    };

    const ecomRes = await fetch('https://ecom-dz.com/api_v2/colis', {
      method: 'POST',
      headers: ecomHeaders,
      body: JSON.stringify(payload),
    });

    const ecomText = await ecomRes.text();
    let ecomData: Record<string, unknown>;
    try { ecomData = JSON.parse(ecomText); } catch { ecomData = { raw: ecomText }; }

    if (!ecomRes.ok) {
      const errorMsg = (ecomData.erreur as string) || ecomText || `Ecom API ${ecomRes.status}`;
      await execute(c.env,
        'UPDATE youcan_orders SET ecom_push_status = ?, ecom_push_error = ?, ecom_pushed_at = datetime("now") WHERE id = ?',
        ['failed', errorMsg, order.id]
      );
      return errorResponse(`Ecom Delivery API error: ${errorMsg}`, 502);
    }

    // Save delivery record in ecom_deliveries
    const tracking = (ecomData.tracking as string) || '';
    const colisId = ecomData.id_colis || ecomData.id || null;

    if (tracking) {
      const deliveryId = 'ed-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
      const existingDelivery = await queryOne(c.env, 'SELECT id FROM ecom_deliveries WHERE ecom_tracking = ?', [tracking]);

      if (!existingDelivery) {
        await execute(c.env,
          `INSERT INTO ecom_deliveries (id, order_id, foxbox_order_number, provider, ecom_tracking, ecom_id_colis, ecom_id_externe, ecom_situation, ecom_situation_id, ecom_etat_logistique, ecom_etat_logistique_id, status, status_label, customer_name, customer_phone, wilaya_code, wilaya_name, commune, delivery_mode, address, stopdesk_code, product, quantity, total, ecom_tarif_livraison, ecom_encaisser)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            deliveryId,
            order.id,
            order.external_order_id,
            'ecom_delivery',
            tracking,
            colisId,
            order.external_order_id,
            '',
            0,
            '',
            0,
            'PREPARING',
            '',
            order.customer_name || '',
            order.customer_phone || '',
            order.wilaya_code || '',
            order.wilaya || '',
            order.baladiya || '',
            order.shipping_method === 'bureau' ? 'STOP_DESK' : 'HOME',
            ecomAddress,
            order.stopdesk_code || null,
            productName,
            order.quantity || 1,
            totalToCollect,
            order.delivery_fee || 0,
            totalToCollect,
          ]
        );
      }
    }

    // Update YouCan order push status
    await execute(c.env,
      'UPDATE youcan_orders SET ecom_push_status = ?, ecom_pushed_at = datetime("now"), ecom_push_tracking = ?, ecom_push_error = NULL WHERE id = ?',
      ['sent', tracking || null, order.id]
    );

    return successResponse({
      success: true,
      tracking,
      colisId,
      idExterne: order.external_order_id,
      message: 'Order pushed to Ecom Delivery successfully',
    });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Push to Ecom failed', 500);
  }
});

// ─── Get Ecom Push Status ───────────────────────────────────

youcan.get('/youcan/orders/:id/ecom-status', async (c) => {
  try {
    const id = c.req.param('id');
    const order = await queryOne(c.env, 'SELECT id, ecom_push_status, ecom_pushed_at, ecom_push_tracking, ecom_push_error FROM youcan_orders WHERE id = ? OR external_order_id = ?', [id, id]);
    if (!order) return errorResponse('Order not found', 404);

    return successResponse({
      pushStatus: order.ecom_push_status || 'not_sent',
      pushedAt: order.ecom_pushed_at || null,
      tracking: order.ecom_push_tracking || null,
      error: order.ecom_push_error || null,
    });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed', 500);
  }
});

// ─── Ensure ecom push columns exist ─────────────────────────
// D1 doesn't support IF NOT EXISTS for ALTER TABLE, so we run this
// as a best-effort initialization on first load

youcan.get('/youcan/init-ecom-columns', async (c) => {
  const columns = [
    "ALTER TABLE youcan_orders ADD COLUMN ecom_push_status TEXT DEFAULT 'not_sent'",
    "ALTER TABLE youcan_orders ADD COLUMN ecom_pushed_at TEXT",
    "ALTER TABLE youcan_orders ADD COLUMN ecom_push_tracking TEXT",
    "ALTER TABLE youcan_orders ADD COLUMN ecom_push_error TEXT",
  ];
  const results: string[] = [];
  for (const sql of columns) {
    try {
      await c.env.DB.prepare(sql).run();
      results.push('ok');
    } catch {
      results.push('already exists');
    }
  }
  return successResponse({ results });
});

// ─── Init Deleted Orders Table ──────────────────────────────

youcan.get('/youcan/init-deleted-table', async (c) => {
  try {
    await c.env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS deleted_youcan_orders (
        youcan_order_id TEXT NOT NULL,
        deleted_at TEXT NOT NULL DEFAULT (datetime('now')),
        deleted_by TEXT,
        reason TEXT
      )
    `).run();
    await c.env.DB.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_deleted_youcan_order_id ON deleted_youcan_orders(youcan_order_id)
    `).run();
    return successResponse({ status: 'ok', message: 'deleted_youcan_orders table ready' });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Init failed', 500);
  }
});

// ─── List Deleted Orders ────────────────────────────────────

youcan.get('/youcan/deleted-orders', async (c) => {
  try {
    const orders = await query(c.env, 'SELECT * FROM deleted_youcan_orders ORDER BY deleted_at DESC');
    return successResponse({ orders, total: orders.length });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed', 500);
  }
});

// ─── Bulk Delete Orders ─────────────────────────────────────

youcan.post('/youcan/bulk-delete', async (c) => {
  try {
    const body = await c.req.json();
    const orderIds = body.orderIds as string[];
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return errorResponse('No order IDs provided', 400);
    }

    const placeholders = orderIds.map(() => '?').join(',');
    const orders = await query(c.env, `SELECT id, external_order_id FROM youcan_orders WHERE id IN (${placeholders}) OR external_order_id IN (${placeholders})`, [...orderIds, ...orderIds]);

    if (orders.length === 0) {
      return errorResponse('No matching orders found', 404);
    }

    // Step 1: Register ALL as permanently deleted BEFORE removing
    for (const order of orders) {
      await registerDeletedOrder(c.env, order.external_order_id as string);
    }

    // Step 2: Remove from local orders
    const ids = orders.map(o => o.id as string);
    const delPlaceholders = ids.map(() => '?').join(',');
    await execute(c.env, `DELETE FROM youcan_orders WHERE id IN (${delPlaceholders})`, ids);

    return successResponse({
      deleted: orders.length,
      ids,
    });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Bulk delete failed', 500);
  }
});

// ─── Bulk Push to Ecom Delivery ─────────────────────────────

youcan.post('/youcan/bulk-push-to-ecom', async (c) => {
  try {
    const body = await c.req.json();
    const orderIds = body.orderIds as string[];
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return errorResponse('No order IDs provided', 400);
    }

    const placeholders = orderIds.map(() => '?').join(',');
    const orders = await query(c.env, `SELECT * FROM youcan_orders WHERE id IN (${placeholders}) OR external_order_id IN (${placeholders})`, [...orderIds, ...orderIds]);

    const results: Array<{ orderId: string; externalOrderId: string; status: 'sent' | 'failed' | 'skipped'; tracking?: string; error?: string }> = [];
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const order of orders) {
      const orderIdStr = String(order.external_order_id);

      // Skip if already sent
      if (order.ecom_push_status === 'sent') {
        results.push({ orderId: order.id as string, externalOrderId: orderIdStr, status: 'skipped', error: 'Already sent' });
        skipped++;
        continue;
      }

      // Validate required fields
      const missing: string[] = [];
      if (!order.customer_name) missing.push('customer name');
      if (!order.customer_phone) missing.push('phone');
      if (!order.order_items || order.order_items === '[]') missing.push('product');
      if (!order.wilaya_code) missing.push('wilaya');
      if (!order.baladiya) missing.push('commune');
      if (!order.external_order_id) missing.push('external id');

      let productName = '';
      let productRef = '';
      try {
        const items = JSON.parse(order.order_items as string || '[]');
        if (items.length > 0) {
          productName = items[0].productName || '';
          productRef = items[0].sku || items[0].ref || '';
        }
      } catch { /* empty */ }

      if (!productName) missing.push('product name');
      if (!productRef) missing.push('product reference');
      if (order.shipping_method === 'bureau' && !order.stopdesk_code) missing.push('stopdesk code');

      if (missing.length > 0) {
        const errorMsg = `Missing: ${missing.join(', ')}`;
        await execute(c.env,
          'UPDATE youcan_orders SET ecom_push_status = ?, ecom_push_error = ?, ecom_pushed_at = datetime("now") WHERE id = ?',
          ['failed', errorMsg, order.id]
        );
        results.push({ orderId: order.id as string, externalOrderId: orderIdStr, status: 'failed', error: errorMsg });
        failed++;
        continue;
      }

      // Build Ecom Delivery payload
      const totalToCollect = (order.total as number || 0) + (order.delivery_fee as number || 0);
      let ecomAddress = (order.address as string) || '';
      if (order.shipping_method === 'bureau') {
        const bureauParts = [order.office_name, order.wilaya].filter(Boolean).join(' - ');
        ecomAddress = bureauParts || ecomAddress;
      }

      const payload = {
        nom_prenom: order.customer_name,
        telephone: order.customer_phone,
        telephone2: '',
        id_wilaya: parseInt(order.wilaya_code as string) || 0,
        commune: order.baladiya || '',
        adresse: ecomAddress,
        type_livraison: order.shipping_method === 'bureau' ? 'Stopdesk' : 'Domicile',
        id_stopdesk: order.stopdesk_code || '',
        note: (order.note as string) || '',
        produit: productName,
        quantite: order.quantity || 1,
        prix_total: totalToCollect,
        prix_livraison: order.delivery_fee || 0,
        id_externe: orderIdStr,
      };

      try {
        const ecomHeaders: Record<string, string> = {
          'X-API-Key': c.env.ECOM_API_KEY || '',
          'X-API-Token': c.env.ECOM_API_TOKEN || '',
          'Content-Type': 'application/json',
        };

        const ecomRes = await fetch('https://ecom-dz.com/api_v2/colis', {
          method: 'POST',
          headers: ecomHeaders,
          body: JSON.stringify(payload),
        });

        const ecomText = await ecomRes.text();
        let ecomData: Record<string, unknown>;
        try { ecomData = JSON.parse(ecomText); } catch { ecomData = { raw: ecomText }; }

        if (!ecomRes.ok) {
          const errorMsg = (ecomData.erreur as string) || ecomText || `Ecom API ${ecomRes.status}`;
          await execute(c.env,
            'UPDATE youcan_orders SET ecom_push_status = ?, ecom_push_error = ?, ecom_pushed_at = datetime("now") WHERE id = ?',
            ['failed', errorMsg, order.id]
          );
          results.push({ orderId: order.id as string, externalOrderId: orderIdStr, status: 'failed', error: errorMsg });
          failed++;
          continue;
        }

        const tracking = (ecomData.tracking as string) || '';
        const colisId = ecomData.id_colis || ecomData.id || null;

        // Save delivery record
        if (tracking) {
          const existingDelivery = await queryOne(c.env, 'SELECT id FROM ecom_deliveries WHERE ecom_tracking = ?', [tracking]);
          if (!existingDelivery) {
            const deliveryId = 'ed-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
            await execute(c.env,
              `INSERT INTO ecom_deliveries (id, order_id, foxbox_order_number, provider, ecom_tracking, ecom_id_colis, ecom_id_externe, ecom_situation, ecom_situation_id, ecom_etat_logistique, ecom_etat_logistique_id, status, status_label, customer_name, customer_phone, wilaya_code, wilaya_name, commune, delivery_mode, address, stopdesk_code, product, quantity, total, ecom_tarif_livraison, ecom_encaisser)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                deliveryId, order.id, orderIdStr, 'ecom_delivery', tracking, colisId, orderIdStr,
                '', 0, '', 0, 'PREPARING', '', order.customer_name || '', order.customer_phone || '',
                order.wilaya_code || '', order.wilaya || '', order.baladiya || '',
                order.shipping_method === 'bureau' ? 'STOP_DESK' : 'HOME', ecomAddress,
                order.stopdesk_code || null, productName, order.quantity || 1, totalToCollect,
                order.delivery_fee || 0, totalToCollect,
              ]
            );
          }
        }

        await execute(c.env,
          'UPDATE youcan_orders SET ecom_push_status = ?, ecom_pushed_at = datetime("now"), ecom_push_tracking = ?, ecom_push_error = NULL WHERE id = ?',
          ['sent', tracking || null, order.id]
        );

        results.push({ orderId: order.id as string, externalOrderId: orderIdStr, status: 'sent', tracking });
        sent++;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        await execute(c.env,
          'UPDATE youcan_orders SET ecom_push_status = ?, ecom_push_error = ?, ecom_pushed_at = datetime("now") WHERE id = ?',
          ['failed', errorMsg, order.id]
        );
        results.push({ orderId: order.id as string, externalOrderId: orderIdStr, status: 'failed', error: errorMsg });
        failed++;
      }
    }

    return successResponse({
      total: orders.length,
      sent,
      failed,
      skipped,
      results,
    });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Bulk push failed', 500);
  }
});

export default youcan;
