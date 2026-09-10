import { Hono } from 'hono';
import type { Env } from '../types/env';
import { successResponse, errorResponse } from '../utils/response';
import { authenticate } from '../middleware/auth';

const integrations = new Hono<{ Bindings: Env }>();

// ─── Provider registry (backend) ──────────────────────────────
const PROVIDER_REGISTRY: Record<string, {
  name: string;
  envKeys: { apiKey?: string; apiToken?: string; clientId?: string; clientSecret?: string };
  testEndpoint?: string;
  testHeaders?: (env: Env) => Record<string, string>;
  testMethod?: string;
}> = {
  ecom_delivery: {
    name: 'ECOM DELIVERY',
    envKeys: { apiKey: 'ECOM_API_KEY', apiToken: 'ECOM_API_TOKEN' },
    testEndpoint: 'https://ecom-dz.com/api_v2/test',
    testHeaders: (env: Env) => ({
      'X-API-Key': env.ECOM_API_KEY || '',
      'X-API-Token': env.ECOM_API_TOKEN || '',
      'Content-Type': 'application/json',
    }),
    testMethod: 'GET',
  },
};

// ─── GET /delivery-integrations/providers ─────────────────────
integrations.get('/delivery-integrations/providers', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  try {
    const { results: integrationsList } = await c.env.DB.prepare(
      'SELECT * FROM delivery_integrations ORDER BY created_at DESC'
    ).all();

    const providers = Object.entries(PROVIDER_REGISTRY).map(([id, config]) => {
      const integration = integrationsList.find((i: Record<string, unknown>) => i.provider_id === id);

      const envKeyStatus: Record<string, boolean> = {};
      for (const [credType, envKey] of Object.entries(config.envKeys)) {
        envKeyStatus[credType] = !!(envKey && c.env[envKey as keyof Env]);
      }
      const hasCredentials = Object.values(envKeyStatus).every(Boolean);

      return {
        id,
        name: config.name,
        hasApi: !!config.testEndpoint,
        envConfigured: hasCredentials,
        envKeyStatus,
        integration: integration ? {
          id: integration.id,
          accountName: integration.account_name,
          linkedStoreId: integration.linked_store_id,
          status: integration.status,
          errorMessage: integration.error_message,
          connectedAt: integration.connected_at,
          lastTestedAt: integration.last_tested_at,
          lastTestStatus: integration.last_test_status,
        } : null,
      };
    });

    return c.json(successResponse(providers));
  } catch (err) {
    return c.json(errorResponse(err instanceof Error ? err.message : 'Failed to load providers'), 500);
  }
});

// ─── POST /delivery-integrations/connect ──────────────────────
integrations.post('/delivery-integrations/connect', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  try {
    const body = await c.req.json();
    const { providerId, accountName, linkedStoreId } = body;

    if (!providerId) {
      return c.json(errorResponse('Provider ID is required'), 400);
    }

    const provider = PROVIDER_REGISTRY[providerId];
    if (!provider) {
      return c.json(errorResponse('Unknown provider'), 400);
    }

    const hasCredentials = Object.values(provider.envKeys).every(
      (envKey) => envKey && c.env[envKey as keyof Env]
    );

    if (!hasCredentials) {
      return c.json(errorResponse(
        `${provider.name} API credentials are not configured on the server. ` +
        `Please add the required environment variables to the Worker first.`
      ), 400);
    }

    if (provider.testEndpoint) {
      try {
        const headers = provider.testHeaders ? provider.testHeaders(c.env) : {};
        const res = await fetch(provider.testEndpoint, {
          method: provider.testMethod || 'GET',
          headers,
        });

        if (!res.ok) {
          const text = await res.text();
          return c.json(errorResponse(
            `Connection test failed (${res.status}): ${text.substring(0, 200)}`
          ), 400);
        }
      } catch (testErr) {
        return c.json(errorResponse(
          `Connection test failed: ${testErr instanceof Error ? testErr.message : 'Network error'}`
        ), 400);
      }
    }

    const existing = await c.env.DB.prepare(
      'SELECT id FROM delivery_integrations WHERE provider_id = ? AND account_name = ? AND linked_store_id = ?'
    ).bind(providerId, accountName || 'Default', linkedStoreId || null).first();

    const now = new Date().toISOString();
    const userId = authResult.auth?.user?.sub || 'unknown';

    if (existing) {
      await c.env.DB.prepare(
        `UPDATE delivery_integrations
         SET status = 'connected', error_message = NULL, connected_at = ?, last_tested_at = ?, last_test_status = 'ok', updated_at = ?
         WHERE id = ?`
      ).bind(now, now, now, existing.id).run();

      return c.json(successResponse({
        id: existing.id,
        providerId,
        status: 'connected',
        connectedAt: now,
      }));
    }

    const integrationId = `di_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    await c.env.DB.prepare(
      `INSERT INTO delivery_integrations (id, provider_id, account_name, linked_store_id, status, connected_at, last_tested_at, last_test_status, created_by)
       VALUES (?, ?, ?, ?, 'connected', ?, ?, 'ok', ?)`
    ).bind(integrationId, providerId, accountName || 'Default', linkedStoreId || null, now, now, userId).run();

    return c.json(successResponse({
      id: integrationId,
      providerId,
      status: 'connected',
      connectedAt: now,
    }));
  } catch (err) {
    return c.json(errorResponse(err instanceof Error ? err.message : 'Failed to connect'), 500);
  }
});

// ─── POST /delivery-integrations/test/:providerId ─────────────
integrations.post('/delivery-integrations/test/:providerId', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  try {
    const providerId = c.req.param('providerId');
    const provider = PROVIDER_REGISTRY[providerId];

    if (!provider) {
      return c.json(errorResponse('Unknown provider'), 400);
    }

    if (!provider.testEndpoint) {
      return c.json(errorResponse(`${provider.name} does not have a test endpoint configured`), 400);
    }

    const headers = provider.testHeaders ? provider.testHeaders(c.env) : {};
    const res = await fetch(provider.testEndpoint, {
      method: provider.testMethod || 'GET',
      headers,
    });

    const now = new Date().toISOString();

    if (!res.ok) {
      const text = await res.text();
      await c.env.DB.prepare(
        `UPDATE delivery_integrations SET status = 'error', error_message = ?, last_tested_at = ?, last_test_status = 'failed', updated_at = ? WHERE provider_id = ?`
      ).bind(`Test failed: ${text.substring(0, 200)}`, now, now, providerId).run();

      return c.json(errorResponse(`Connection test failed (${res.status}): ${text.substring(0, 200)}`), 400);
    }

    await c.env.DB.prepare(
      `UPDATE delivery_integrations SET status = 'connected', error_message = NULL, last_tested_at = ?, last_test_status = 'ok', updated_at = ? WHERE provider_id = ?`
    ).bind(now, now, providerId).run();

    return c.json(successResponse({ status: 'ok', testedAt: now }));
  } catch (err) {
    return c.json(errorResponse(err instanceof Error ? err.message : 'Test failed'), 500);
  }
});

// ─── PUT /delivery-integrations/:id ───────────────────────────
integrations.put('/delivery-integrations/:id', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { accountName, linkedStoreId } = body;

    const existing = await c.env.DB.prepare('SELECT id FROM delivery_integrations WHERE id = ?').bind(id).first();
    if (!existing) {
      return c.json(errorResponse('Integration not found'), 404);
    }

    const now = new Date().toISOString();
    await c.env.DB.prepare(
      `UPDATE delivery_integrations SET account_name = ?, linked_store_id = ?, updated_at = ? WHERE id = ?`
    ).bind(accountName || 'Default', linkedStoreId || null, now, id).run();

    return c.json(successResponse({ id, updated: true }));
  } catch (err) {
    return c.json(errorResponse(err instanceof Error ? err.message : 'Failed to update'), 500);
  }
});

// ─── DELETE /delivery-integrations/:providerId ────────────────
integrations.delete('/delivery-integrations/:providerId', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  try {
    const providerId = c.req.param('providerId');

    const existing = await c.env.DB.prepare(
      'SELECT id FROM delivery_integrations WHERE provider_id = ?'
    ).bind(providerId).first();

    if (!existing) {
      return c.json(errorResponse('Integration not found'), 404);
    }

    await c.env.DB.prepare('DELETE FROM delivery_integrations WHERE provider_id = ?').bind(providerId).run();

    return c.json(successResponse({ disconnected: true, providerId }));
  } catch (err) {
    return c.json(errorResponse(err instanceof Error ? err.message : 'Failed to disconnect'), 500);
  }
});

// ─── GET /delivery-integrations/:providerId/credentials-status ─
integrations.get('/delivery-integrations/:providerId/credentials-status', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  try {
    const providerId = c.req.param('providerId');
    const provider = PROVIDER_REGISTRY[providerId];

    if (!provider) {
      return c.json(errorResponse('Unknown provider'), 400);
    }

    const status: Record<string, { envKey: string; configured: boolean }> = {};
    for (const [credType, envKey] of Object.entries(provider.envKeys)) {
      status[credType] = {
        envKey,
        configured: !!(envKey && c.env[envKey as keyof Env]),
      };
    }

    return c.json(successResponse({ providerId, credentials: status }));
  } catch (err) {
    return c.json(errorResponse(err instanceof Error ? err.message : 'Failed to check credentials'), 500);
  }
});

export default integrations;
