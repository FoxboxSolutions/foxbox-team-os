import { Hono } from 'hono';
import type { Env } from './types/env';
import { corsResponse } from './utils/response';

// Routes
import authRoutes from './routes/auth';
import ecomRoutes from './routes/ecom';
import youcanRoutes from './routes/youcan';
import webhookRoutes from './routes/webhooks';
import orderRoutes from './routes/orders';
import productRoutes from './routes/products';
import sellingProductRoutes from './routes/selling-products';
import confirmationRoutes from './routes/confirmations';
import teamRoutes from './routes/team';
import financeRoutes from './routes/finance';
import filesRoutes from './routes/files';
import membersRoutes from './routes/members';
import landingPagesRoutes from './routes/landing-pages';
import deliveryIntegrationsRoutes from './routes/delivery-integrations';

const app = new Hono<{ Bindings: Env }>();

// ─── CORS ───────────────────────────────────────────────────

app.use('*', async (c, next) => {
  if (c.req.method === 'OPTIONS') {
    return corsResponse();
  }
  await next();
});

app.use('*', async (c, next) => {
  await next();
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
});

// ─── Health Check ───────────────────────────────────────────

app.get('/api/health', (c) => {
  return c.json({
    success: true,
    data: {
      status: 'ok',
      service: 'foxbox-api',
      version: '1.0.0',
      environment: c.env.ENVIRONMENT || 'development',
      timestamp: new Date().toISOString(),
    },
  });
});

// ─── Mount Routes ───────────────────────────────────────────

app.route('/api/auth', authRoutes);
app.route('/api', ecomRoutes);
app.route('/api', youcanRoutes);
app.route('/api', webhookRoutes);
app.route('/api/orders', orderRoutes);
app.route('/api/products', productRoutes);
app.route('/api/selling-products', sellingProductRoutes);
app.route('/api/confirmations', confirmationRoutes);
app.route('/api', teamRoutes);
app.route('/api', financeRoutes);
app.route('/api', filesRoutes);
app.route('/api', membersRoutes);
app.route('/api', landingPagesRoutes);
app.route('/api', deliveryIntegrationsRoutes);

// ─── 404 Fallback ───────────────────────────────────────────

app.notFound((c) => {
  return c.json({ success: false, error: `Route ${c.req.method} ${c.req.url} not found` }, 404);
});

// ─── Error Handler ──────────────────────────────────────────

app.onError((err, c) => {
  console.error(`[Error] ${c.req.method} ${c.req.url}:`, err);
  return c.json({ success: false, error: err.message || 'Internal server error' }, 500);
});

export default app;
