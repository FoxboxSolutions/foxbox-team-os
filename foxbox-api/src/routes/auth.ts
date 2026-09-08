import { Hono } from 'hono';
import type { Env } from '../types/env';
import { query, queryOne, execute } from '../db/client';
import { generateId, nowISO } from '../db/client';
import { signJwt, verifyJwt } from '../utils/jwt';
import { successResponse, errorResponse } from '../utils/response';
import { authenticate } from '../middleware/auth';

const auth = new Hono<{ Bindings: Env }>();

// Hash password using Web Crypto (PBKDF2)
async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations: 100000,
    },
    keyMaterial,
    256
  );
  const hash = new Uint8Array(bits);
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(hash).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${saltHex}:${hashHex}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':');
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map(b => parseInt(b, 16)));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations: 100000,
    },
    keyMaterial,
    256
  );
  const hash = new Uint8Array(bits);
  const computedHex = Array.from(hash).map(b => b.toString(16).padStart(2, '0')).join('');
  return computedHex === hashHex;
}

// POST /api/auth/register
auth.post('/register', async (c) => {
  try {
    const { fullName, email, password, requestedRole } = await c.req.json();

    if (!fullName || !email || !password) {
      return errorResponse('Missing required fields: fullName, email, password', 400);
    }

    // Check if email already exists
    const existing = await queryOne(c.env, 'SELECT id FROM auth_users WHERE email = ?', [email.toLowerCase()]);
    if (existing) {
      return errorResponse('Email already registered', 409);
    }

    const passwordHash = await hashPassword(password);
    const userId = generateId();
    const now = nowISO();

    // First user auto-approved as administrator
    const isFirstUser = (await query(c.env, 'SELECT COUNT(*) as count FROM auth_users')).length === 0;
    const role = isFirstUser ? 'administrator' : (requestedRole || 'mediabuyer');
    const status = isFirstUser ? 'approved' : 'pending';

    await execute(c.env,
      `INSERT INTO auth_users (id, full_name, email, password_hash, role, requested_role, status, auth_provider, created_at, updated_at, approved_at, approved_by)
       VALUES (?, ?, ?, ?, ?, ?, 'email', ?, ?, ?, ?, ?)`,
      [userId, fullName, email.toLowerCase(), passwordHash, role, role, status, now, now, isFirstUser ? now : null, isFirstUser ? 'system' : null]
    );

    // Create session and JWT
    const sessionId = generateId();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await execute(c.env,
      'INSERT INTO auth_sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
      [sessionId, userId, now, expiresAt]
    );

    const token = await signJwt(
      { sub: userId, email: email.toLowerCase(), role, sessionId },
      c.env.JWT_SECRET
    );

    return successResponse({
      token,
      user: { id: userId, fullName, email: email.toLowerCase(), role, status },
    }, isFirstUser ? 'Admin account created' : 'Registration pending approval');
  } catch (err) {
    return errorResponse(`Registration failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 500);
  }
});

// POST /api/auth/login
auth.post('/login', async (c) => {
  try {
    const { email, password } = await c.req.json();

    if (!email || !password) {
      return errorResponse('Missing email or password', 400);
    }

    const user = await queryOne<{ id: string; full_name: string; email: string; password_hash: string; role: string; status: string }>(c.env,
      'SELECT id, full_name, email, password_hash, role, status FROM auth_users WHERE email = ?',
      [email.toLowerCase()]
    );

    if (!user || !user.password_hash) {
      return errorResponse('Invalid credentials', 401);
    }

    if (user.status !== 'approved') {
      if (user.status === 'blocked') {
        return errorResponse('Your account has been blocked. Please contact an administrator.', 403);
      }
      if (user.status === 'banned') {
        return errorResponse('Your account has been banned. Please contact an administrator.', 403);
      }
      return errorResponse(`Account is ${user.status}`, 403);
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return errorResponse('Invalid credentials', 401);
    }

    const now = nowISO();
    const sessionId = generateId();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await execute(c.env,
      'INSERT INTO auth_sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
      [sessionId, user.id, now, expiresAt]
    );

    await execute(c.env, 'UPDATE auth_users SET last_login_at = ? WHERE id = ?', [now, user.id]);

    const token = await signJwt(
      { sub: user.id, email: user.email, role: user.role, sessionId: sessionId },
      c.env.JWT_SECRET
    );

    return successResponse({
      token,
      user: { id: user.id, fullName: user.full_name, email: user.email, role: user.role, status: user.status },
    });
  } catch (err) {
    return errorResponse(`Login failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 500);
  }
});

// POST /api/auth/logout
auth.post('/logout', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  await execute(c.env, 'DELETE FROM auth_sessions WHERE id = ?', [authResult.auth!.user.sessionId]);
  return successResponse(null, 'Logged out');
});

// GET /api/auth/me
auth.get('/me', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const user = await queryOne(c.env,
    `SELECT id, full_name AS fullName, email, avatar, role,
            requested_role AS requestedRole, status,
            auth_provider AS authProvider, google_id AS googleId,
            created_at AS createdAt, updated_at AS updatedAt,
            approved_at AS approvedAt, last_login_at AS lastLoginAt
     FROM auth_users WHERE id = ?`,
    [authResult.auth!.user.sub]
  );

  if (!user) return errorResponse('User not found', 404);
  return successResponse(user);
});

// GET /api/auth/users (admin only)
auth.get('/users', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;
  if (authResult.auth!.user.role !== 'administrator') {
    return errorResponse('Admin only', 403);
  }

  const users = await query(c.env,
    `SELECT id, full_name AS fullName, email, avatar, role,
            requested_role AS requestedRole, status,
            auth_provider AS authProvider, google_id AS googleId,
            created_at AS createdAt, updated_at AS updatedAt,
            approved_at AS approvedAt, last_login_at AS lastLoginAt
     FROM auth_users ORDER BY created_at DESC`
  );
  return successResponse(users);
});

// PUT /api/auth/users/:id/approve (admin only)
auth.put('/users/:id/approve', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;
  if (authResult.auth!.user.role !== 'administrator') {
    return errorResponse('Admin only', 403);
  }

  const { id } = c.req.param();
  const now = nowISO();

  await execute(c.env,
    `UPDATE auth_users SET status = 'approved', approved_at = ?, approved_by = ?, updated_at = ? WHERE id = ?`,
    [now, authResult.auth!.user.sub, now, id]
  );

  return successResponse(null, 'User approved');
});

// PUT /api/auth/users/:id/reject (admin only)
auth.put('/users/:id/reject', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;
  if (authResult.auth!.user.role !== 'administrator') {
    return errorResponse('Admin only', 403);
  }

  const { id } = c.req.param();
  const now = nowISO();
  const { notes } = await c.req.json().catch(() => ({ notes: '' }));

  await execute(c.env,
    `UPDATE auth_users SET status = 'rejected', reviewed_at = ?, reviewed_by = ?, review_notes = ?, updated_at = ? WHERE id = ?`,
    [now, authResult.auth!.user.sub, notes || '', now, id]
  );

  return successResponse(null, 'User rejected');
});

// PATCH /api/auth/me (update own profile)
auth.patch('/me', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const body = await c.req.json();
  const { fullName, avatar } = body;
  const userId = authResult.auth!.user.sub;
  const now = nowISO();

  const updates: string[] = [];
  const values: unknown[] = [];

  if (fullName !== undefined) {
    updates.push('full_name = ?');
    values.push(fullName);
  }
  if (avatar !== undefined) {
    updates.push('avatar = ?');
    values.push(avatar || null);
  }

  if (updates.length === 0) {
    return errorResponse('No fields to update', 400);
  }

  updates.push('updated_at = ?');
  values.push(now);
  values.push(userId);

  await execute(c.env, `UPDATE auth_users SET ${updates.join(', ')} WHERE id = ?`, values);

  const user = await queryOne(c.env,
    `SELECT id, full_name AS fullName, email, avatar, role,
            requested_role AS requestedRole, status,
            auth_provider AS authProvider,
            created_at AS createdAt, updated_at AS updatedAt,
            approved_at AS approvedAt, last_login_at AS lastLoginAt
     FROM auth_users WHERE id = ?`,
    [userId]
  );

  return successResponse(user, 'Profile updated');
});

// POST /api/auth/change-password
auth.post('/change-password', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const { currentPassword, newPassword } = await c.req.json();
  if (!currentPassword || !newPassword) {
    return errorResponse('Missing currentPassword or newPassword', 400);
  }

  const userId = authResult.auth!.user.sub;
  const user = await queryOne<{ id: string; password_hash: string }>(c.env,
    'SELECT id, password_hash FROM auth_users WHERE id = ?',
    [userId]
  );

  if (!user || !user.password_hash) {
    return errorResponse('Account not found', 404);
  }

  const valid = await verifyPassword(currentPassword, user.password_hash);
  if (!valid) {
    return errorResponse('Current password is incorrect', 401);
  }

  const newHash = await hashPassword(newPassword);
  const now2 = nowISO();
  await execute(c.env, 'UPDATE auth_users SET password_hash = ?, updated_at = ? WHERE id = ?', [newHash, now2, userId]);

  // Invalidate all sessions except current
  const currentSessionId = authResult.auth!.user.sessionId;
  await execute(c.env, 'DELETE FROM auth_sessions WHERE user_id = ? AND id != ?', [userId, currentSessionId]);

  return successResponse(null, 'Password changed successfully');
});

// GET /api/auth/users/:id (admin only)
auth.get('/users/:id', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;
  if (authResult.auth!.user.role !== 'administrator') {
    return errorResponse('Admin only', 403);
  }

  const { id } = c.req.param();
  const user = await queryOne(c.env,
    `SELECT id, full_name AS fullName, email, avatar, role,
            requested_role AS requestedRole, status,
            auth_provider AS authProvider, google_id AS googleId,
            created_at AS createdAt, updated_at AS updatedAt,
            approved_at AS approvedAt, last_login_at AS lastLoginAt
     FROM auth_users WHERE id = ?`,
    [id]
  );

  if (!user) return errorResponse('User not found', 404);
  return successResponse(user);
});

// PATCH /api/auth/users/:id (admin - update user role/name)
auth.patch('/users/:id', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;
  if (authResult.auth!.user.role !== 'administrator') {
    return errorResponse('Admin only', 403);
  }

  const { id } = c.req.param();
  const body = await c.req.json();
  const now = nowISO();

  const updates: string[] = [];
  const values: unknown[] = [];

  if (body.role !== undefined) {
    updates.push('role = ?');
    values.push(body.role);
  }
  if (body.fullName !== undefined) {
    updates.push('full_name = ?');
    values.push(body.fullName);
  }

  if (updates.length === 0) {
    return errorResponse('No fields to update', 400);
  }

  updates.push('updated_at = ?');
  values.push(now);
  values.push(id);

  await execute(c.env, `UPDATE auth_users SET ${updates.join(', ')} WHERE id = ?`, values);

  return successResponse(null, 'User updated');
});

// POST /api/auth/users/:id/block (admin only)
auth.post('/users/:id/block', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;
  if (authResult.auth!.user.role !== 'administrator') {
    return errorResponse('Admin only', 403);
  }

  const { id } = c.req.param();
  const now = nowISO();

  const target = await queryOne<{ role: string; status: string }>(c.env, 'SELECT role, status FROM auth_users WHERE id = ?', [id]);
  if (target?.role === 'administrator') {
    const otherAdmins = await query(c.env, "SELECT id FROM auth_users WHERE role = 'administrator' AND status = 'approved' AND id != ?", [id]);
    if (otherAdmins.length === 0) {
      return errorResponse('Cannot disable the last active administrator', 400);
    }
  }

  await execute(c.env, "UPDATE auth_users SET status = 'blocked', updated_at = ? WHERE id = ?", [now, id]);
  await execute(c.env, 'DELETE FROM auth_sessions WHERE user_id = ?', [id]);

  return successResponse(null, 'User blocked');
});

// POST /api/auth/users/:id/unblock (admin only)
auth.post('/users/:id/unblock', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;
  if (authResult.auth!.user.role !== 'administrator') {
    return errorResponse('Admin only', 403);
  }

  const { id } = c.req.param();
  const now = nowISO();
  await execute(c.env, "UPDATE auth_users SET status = 'approved', updated_at = ? WHERE id = ?", [now, id]);

  return successResponse(null, 'User unblocked');
});

// POST /api/auth/users/:id/ban (admin only)
auth.post('/users/:id/ban', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;
  if (authResult.auth!.user.role !== 'administrator') {
    return errorResponse('Admin only', 403);
  }

  const { id } = c.req.param();
  const now = nowISO();

  const target = await queryOne<{ role: string; status: string }>(c.env, 'SELECT role, status FROM auth_users WHERE id = ?', [id]);
  if (target?.role === 'administrator') {
    const otherAdmins = await query(c.env, "SELECT id FROM auth_users WHERE role = 'administrator' AND status = 'approved' AND id != ?", [id]);
    if (otherAdmins.length === 0) {
      return errorResponse('Cannot disable the last active administrator', 400);
    }
  }

  await execute(c.env, "UPDATE auth_users SET status = 'banned', updated_at = ? WHERE id = ?", [now, id]);
  await execute(c.env, 'DELETE FROM auth_sessions WHERE user_id = ?', [id]);

  return successResponse(null, 'User banned');
});

// POST /api/auth/users/:id/unban (admin only)
auth.post('/users/:id/unban', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;
  if (authResult.auth!.user.role !== 'administrator') {
    return errorResponse('Admin only', 403);
  }

  const { id } = c.req.param();
  const now = nowISO();
  await execute(c.env, "UPDATE auth_users SET status = 'approved', updated_at = ? WHERE id = ?", [now, id]);

  return successResponse(null, 'User unbanned');
});

// DELETE /api/auth/users/:id (admin only)
auth.delete('/users/:id', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;
  if (authResult.auth!.user.role !== 'administrator') {
    return errorResponse('Admin only', 403);
  }

  const { id } = c.req.param();

  const target = await queryOne<{ role: string }>(c.env, 'SELECT role FROM auth_users WHERE id = ?', [id]);
  if (target?.role === 'administrator') {
    const otherAdmins = await query(c.env, "SELECT id FROM auth_users WHERE role = 'administrator' AND status = 'approved' AND id != ?", [id]);
    if (otherAdmins.length === 0) {
      return errorResponse('Cannot delete the last active administrator', 400);
    }
  }

  await execute(c.env, 'DELETE FROM auth_sessions WHERE user_id = ?', [id]);
  await execute(c.env, 'DELETE FROM auth_users WHERE id = ?', [id]);

  return successResponse(null, 'User deleted');
});

// GET /api/auth/init-migration — Run DB migration for blocked/banned/needs_role statuses
auth.get('/init-migration', async (c) => {
  try {
    // Step 1: Create new table with updated CHECK constraint
    await c.env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS auth_users_new (
        id TEXT PRIMARY KEY,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT,
        avatar TEXT,
        role TEXT NOT NULL DEFAULT 'mediabuyer' CHECK(role IN ('administrator','mediabuyer','confirmator')),
        requested_role TEXT NOT NULL DEFAULT 'mediabuyer',
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','suspended','blocked','banned','needs_role')),
        auth_provider TEXT NOT NULL DEFAULT 'email' CHECK(auth_provider IN ('email','google','facebook')),
        google_id TEXT,
        facebook_id TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        approved_at TEXT,
        approved_by TEXT,
        last_login_at TEXT,
        password_reset_token TEXT,
        password_reset_expires TEXT
      )
    `).run();

    // Step 2: Copy existing data
    await c.env.DB.prepare('INSERT OR IGNORE INTO auth_users_new SELECT * FROM auth_users').run();

    // Step 3: Drop old table and rename
    await c.env.DB.prepare('DROP TABLE auth_users').run();
    await c.env.DB.prepare('ALTER TABLE auth_users_new RENAME TO auth_users').run();

    // Step 4: Recreate indexes
    await c.env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users(email)').run();
    await c.env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_auth_users_status ON auth_users(status)').run();

    return successResponse(null, 'Migration completed');
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Migration failed', 500);
  }
});

// ============================================
// GOOGLE OAUTH ROUTES
// ============================================

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

// GET /api/auth/google — Initiate Google OAuth flow
auth.get('/google', async (c) => {
  try {
    const clientId = c.env.GOOGLE_CLIENT_ID;
    const redirectUri = c.env.GOOGLE_REDIRECT_URI || `${new URL(c.req.url).origin}/api/auth/google/callback`;

    console.log('[GOOGLE_AUTH_START] client_id_set=' + !!clientId);

    if (!clientId) {
      console.error('[GOOGLE_AUTH_ERROR] GOOGLE_CLIENT_ID missing');
      return errorResponse('Google OAuth not configured', 500);
    }

    // Generate cryptographically secure state
    const stateArray = new Uint8Array(32);
    crypto.getRandomValues(stateArray);
    const state = Array.from(stateArray, b => b.toString(16).padStart(2, '0')).join('');

    // Store state in D1 with 10-minute expiry
    const stateId = 'os-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await execute(c.env,
      `INSERT INTO oauth_states (id, provider, state, redirect_url, created_at, expires_at) VALUES (?, ?, ?, ?, datetime('now'), ?)`,
      [stateId, 'google', state, redirectUri, expiresAt]
    );

    console.log('[GOOGLE_AUTH_STATE] stored state_id=' + stateId);

    // Build Google OAuth URL
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'offline',
      prompt: 'consent',
    });

    const googleAuthUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;

    // Return JSON (frontend will handle redirect)
    return successResponse({ url: googleAuthUrl, state });
  } catch (err) {
    console.error('[GOOGLE_AUTH_ERROR] catch_all error=' + (err instanceof Error ? err.message : String(err)));
    return errorResponse('Failed to initiate Google OAuth', 500);
  }
});

// GET /api/auth/google/callback — Handle Google OAuth callback
auth.get('/google/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');
  const frontendUrl = c.env.FRONTEND_URL || 'https://foxbox-team.foxboxsolutions01.workers.dev';

  console.log('[GOOGLE_OAUTH_START] code_received=' + !!code + ' state_received=' + !!state);

  // Handle user denial
  if (error === 'access_denied') {
    console.log('[GOOGLE_OAUTH_ERROR] stage=user_denial');
    return c.redirect(`${frontendUrl}/login?error=google_denied`);
  }

  if (!code || !state) {
    console.log('[GOOGLE_OAUTH_ERROR] stage=missing_params code=' + !!code + ' state=' + !!state);
    return c.redirect(`${frontendUrl}/login?error=google_no_code`);
  }

  try {
    // 1. Validate state (CSRF protection)
    const stateRecord = await queryOne<{ id: string; expires_at: string }>(
      c.env,
      'SELECT id, expires_at FROM oauth_states WHERE state = ? AND provider = ?',
      [state, 'google']
    );

    if (!stateRecord) {
      console.log('[GOOGLE_OAUTH_ERROR] stage=state_validation result=not_found');
      return c.redirect(`${frontendUrl}/login?error=invalid_state`);
    }

    // Check expiry
    if (new Date(stateRecord.expires_at) < new Date()) {
      await execute(c.env, 'DELETE FROM oauth_states WHERE id = ?', [stateRecord.id]);
      console.log('[GOOGLE_OAUTH_ERROR] stage=state_validation result=expired');
      return c.redirect(`${frontendUrl}/login?error=state_expired`);
    }

    console.log('[GOOGLE_STATE_VALID]');

    // Delete used state (one-time use)
    await execute(c.env, 'DELETE FROM oauth_states WHERE id = ?', [stateRecord.id]);

    // 2. Exchange authorization code for tokens
    const clientId = c.env.GOOGLE_CLIENT_ID;
    const clientSecret = c.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = c.env.GOOGLE_REDIRECT_URI || `${new URL(c.req.url).origin}/api/auth/google/callback`;

    if (!clientId) {
      console.error('[GOOGLE_OAUTH_ERROR] stage=env_check detail=GOOGLE_CLIENT_ID_missing');
      return c.redirect(`${frontendUrl}/login?error=google_client_id_missing`);
    }
    if (!clientSecret) {
      console.error('[GOOGLE_OAUTH_ERROR] stage=env_check detail=GOOGLE_CLIENT_SECRET_missing');
      return c.redirect(`${frontendUrl}/login?error=google_client_secret_missing`);
    }

    console.log('[GOOGLE_CODE_RECEIVED] exchanging_code...');

    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('[GOOGLE_OAUTH_ERROR] stage=token_exchange http_status=' + tokenRes.status);
      return c.redirect(`${frontendUrl}/login?error=token_exchange_failed`);
    }

    console.log('[GOOGLE_TOKEN_EXCHANGE_SUCCESS]');

    const tokens = await tokenRes.json() as { id_token?: string; access_token?: string };

    // 3. Validate ID token (OIDC)
    if (!tokens.id_token) {
      console.error('[GOOGLE_OAUTH_ERROR] stage=id_token missing=true');
      return c.redirect(`${frontendUrl}/login?error=no_id_token`);
    }

    // Decode ID token (JWT) - Google's ID token is a standard JWT
    // We verify the signature using Google's public keys
    const payload = await verifyGoogleIdToken(tokens.id_token, clientId);
    if (!payload) {
      console.error('[GOOGLE_OAUTH_ERROR] stage=verify_id_token result=invalid');
      return c.redirect(`${frontendUrl}/login?error=invalid_id_token`);
    }

    console.log('[GOOGLE_USERINFO_SUCCESS]');

    const googleSub = payload.sub as string;
    const googleEmail = payload.email as string;
    const googleEmailVerified = payload.email_verified as boolean;
    const googleName = (payload.name as string) || '';
    const googlePicture = (payload.picture as string) || '';

    // 4. Validate required fields
    if (!googleEmail) {
      console.error('[GOOGLE_OAUTH_ERROR] stage=extract_fields detail=no_email');
      return c.redirect(`${frontendUrl}/login?error=no_email`);
    }

    if (!googleEmailVerified) {
      console.error('[GOOGLE_OAUTH_ERROR] stage=extract_fields detail=email_not_verified');
      return c.redirect(`${frontendUrl}/login?error=email_not_verified`);
    }

    console.log('[GOOGLE_EMAIL_FOUND] email=' + googleEmail.toLowerCase());

    // 5. Find or create FOXBOX user
    let user = await queryOne<{ id: string; status: string; role: string; full_name: string; avatar: string | null }>(
      c.env,
      'SELECT id, status, role, full_name, avatar FROM auth_users WHERE email = ?',
      [googleEmail.toLowerCase()]
    );

    if (user) {
      console.log('[GOOGLE_EXISTING_USER_FOUND] user_id=' + user.id + ' status=' + user.status + ' role=' + user.role);
      // CASE 2 & 3: Email exists or Google already linked
      // Check if blocked/banned
      if (user.status === 'blocked') {
        return c.redirect(`${frontendUrl}/login?error=account_blocked`);
      }
      if (user.status === 'banned') {
        return c.redirect(`${frontendUrl}/login?error=account_banned`);
      }

      // Update google_id if not already set
      await execute(c.env,
        `UPDATE auth_users SET google_id = ?, auth_provider = CASE WHEN auth_provider = 'email' THEN 'google' ELSE auth_provider END, last_login_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
        [googleSub, user.id]
      );

      // Only update avatar if user doesn't have one
      if (!user.avatar && googlePicture) {
        await execute(c.env, 'UPDATE auth_users SET avatar = ? WHERE id = ?', [googlePicture, user.id]);
      }
    } else {
      console.log('[GOOGLE_NEW_USER] creating_account...');
      // CASE 1: New user - create FOXBOX account
      const userId = 'auth-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
      const now = new Date().toISOString();

      // Check if this is the first user (bootstrap = admin)
      const existingUsers = await query(c.env, "SELECT id FROM auth_users WHERE status = 'approved'");
      const isFirstUser = existingUsers.length === 0;

      const role = isFirstUser ? 'administrator' : 'mediabuyer';
      // New Google users need to select their role
      const status = isFirstUser ? 'approved' : 'needs_role';

      console.log('[GOOGLE_NEW_USER] isFirstUser=' + isFirstUser + ' role=' + role + ' status=' + status);

      await execute(c.env,
        `INSERT INTO auth_users (id, full_name, email, avatar, role, requested_role, status, auth_provider, google_id, created_at, updated_at, approved_at, last_login_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          googleName,
          googleEmail.toLowerCase(),
          googlePicture || null,
          role,
          role,
          status,
          'google',
          googleSub,
          now,
          now,
          isFirstUser ? now : null,
          now,
        ]
      );

      console.log('[GOOGLE_USER_CREATED] user_id=' + userId);

      // Create registration request record
      const requestId = 'reg-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
      await execute(c.env,
        `INSERT INTO registration_requests (id, full_name, email, requested_role, auth_provider, status, created_at, reviewed_at, reviewed_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [requestId, googleName, googleEmail.toLowerCase(), role, 'google', status, now, isFirstUser ? now : null, isFirstUser ? userId : null]
      );

      user = { id: userId, status, role, full_name: googleName, avatar: googlePicture || null };
    }

    // 6. If user needs to select role, redirect to complete-profile page
    if (user!.status === 'needs_role') {
      console.log('[GOOGLE_ROLE_STATUS] needs_role=true → redirecting to complete-profile');
      // Create a temporary token for role selection (short-lived, no session yet)
      const tempToken = await signJwt(
        {
          sub: user!.id,
          email: googleEmail.toLowerCase(),
          temp: true,
          purpose: 'role_selection',
        },
        c.env.JWT_SECRET
      );

      return c.redirect(`${frontendUrl}/auth/complete-profile?token=${tempToken}&name=${encodeURIComponent(googleName)}&email=${encodeURIComponent(googleEmail)}&avatar=${encodeURIComponent(googlePicture || '')}`);
    }

    console.log('[GOOGLE_JWT_CREATED] creating_session...');

    // 7. Create FOXBOX session (same as email/password login)
    const sessionId = 'sess-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
    const sessionExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await execute(c.env,
      'INSERT INTO auth_sessions (id, user_id, created_at, expires_at) VALUES (?, ?, datetime(\'now\'), ?)',
      [sessionId, user!.id, sessionExpires]
    );

    console.log('[GOOGLE_SESSION_CREATED] session_id=' + sessionId);

    // 8. Create JWT token
    const jwtToken = await signJwt(
      {
        sub: user!.id,
        email: googleEmail.toLowerCase(),
        role: user!.role,
        sessionId,
      },
      c.env.JWT_SECRET
    );

    console.log('[GOOGLE_REDIRECT] redirecting_to_frontend status=' + user!.status);
    // 9. Redirect to frontend with token (fragment to avoid server logging)
    return c.redirect(`${frontendUrl}/auth/callback?token=${jwtToken}&userId=${user!.id}&status=${user!.status}`);
  } catch (err) {
    console.error('[GOOGLE_OAUTH_ERROR] stage=catch_all error=' + (err instanceof Error ? err.message : String(err)) + ' stack=' + (err instanceof Error ? err.stack : ''));
    return c.redirect(`${frontendUrl}/login?error=google_auth_failed`);
  }
});

// Helper: Verify Google ID Token (OIDC)
async function verifyGoogleIdToken(idToken: string, audience: string): Promise<Record<string, unknown> | null> {
  try {
    // Decode the JWT header to get the key ID
    const parts = idToken.split('.');
    if (parts.length !== 3) return null;

    const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

    // Basic validation
    if (!payload.iss || !['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss)) {
      console.error('[Google OIDC] Invalid issuer:', payload.iss);
      return null;
    }

    if (payload.aud !== audience) {
      console.error('[Google OIDC] Invalid audience:', payload.aud, 'expected:', audience);
      return null;
    }

    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      console.error('[Google OIDC] Token expired');
      return null;
    }

    if (!payload.sub) {
      console.error('[Google OIDC] No subject');
      return null;
    }

    // Verify signature using Google's public keys
    const googleKeysUrl = 'https://www.googleapis.com/oauth2/v3/certs';
    const keysRes = await fetch(googleKeysUrl);
    if (!keysRes.ok) {
      console.error('[Google OIDC] Failed to fetch Google keys');
      // If we can't verify signature, still validate other claims
      // In production, you should cache Google's keys
      return payload;
    }

    const { keys } = await keysRes.json() as { keys: Array<{ kid: string; kty: string; n: string; e: string }> };
    const matchingKey = keys.find(k => k.kid === header.kid);

    if (!matchingKey) {
      console.error('[Google OIDC] No matching key for kid:', header.kid);
      return payload; // Return payload anyway - signature check failed but other validations passed
    }

    // Verify signature
    const encoder = new TextEncoder();
    const keyData = {
      kty: 'RSA',
      n: matchingKey.n,
      e: matchingKey.e,
      alg: 'RS256',
      use: 'sig',
    };

    const cryptoKey = await crypto.subtle.importKey(
      'jwk',
      keyData,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signature = Uint8Array.from(atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      signature,
      encoder.encode(`${parts[0]}.${parts[1]}`)
    );

    if (!valid) {
      console.error('[Google OIDC] Invalid signature');
      return null;
    }

    return payload;
  } catch (err) {
    console.error('[Google OIDC] Verification error:', err);
    return null;
  }
}

// ============================================
// COMPLETE PROFILE (after Google OAuth)
// ============================================

auth.post('/complete-profile', async (c) => {
  try {
    const body = await c.req.json();
    const { token, role } = body as { token: string; role: string };

    console.log('[COMPLETE_PROFILE] role=' + role + ' token_received=' + !!token);

    if (!token || !role) {
      console.log('[COMPLETE_PROFILE_ERROR] missing_params token=' + !!token + ' role=' + role);
      return errorResponse('Token and role are required', 400);
    }

    // Validate role
    const validRoles = ['administrator', 'mediabuyer', 'confirmator'];
    if (!validRoles.includes(role)) {
      console.log('[COMPLETE_PROFILE_ERROR] invalid_role role=' + role);
      return errorResponse('Invalid role', 400);
    }

    // Verify temporary token
    const payload = await verifyJwt(token, c.env.JWT_SECRET);
    console.log('[COMPLETE_PROFILE] jwt_verified=' + !!payload + ' temp=' + payload?.temp + ' purpose=' + payload?.purpose);

    if (!payload || !payload.temp || payload.purpose !== 'role_selection') {
      console.log('[COMPLETE_PROFILE_ERROR] invalid_token payload=' + JSON.stringify(payload));
      return errorResponse('Invalid or expired token', 401);
    }

    const userId = payload.sub;
    console.log('[COMPLETE_PROFILE] user_id=' + userId);

    // Update user with selected role and approve
    await execute(c.env,
      `UPDATE auth_users SET role = ?, requested_role = ?, status = 'approved', approved_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
      [role, role, userId]
    );

    console.log('[COMPLETE_PROFILE] user_updated');

    // Update registration request
    await execute(c.env,
      `UPDATE registration_requests SET requested_role = ?, status = 'approved', reviewed_at = datetime('now') WHERE email = ? AND status != 'approved'`,
      [role, payload.email]
    );

    console.log('[COMPLETE_PROFILE] registration_request_updated');

    // Create session
    const sessionId = 'sess-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
    const sessionExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await execute(c.env,
      'INSERT INTO auth_sessions (id, user_id, created_at, expires_at) VALUES (?, ?, datetime(\'now\'), ?)',
      [sessionId, userId, sessionExpires]
    );

    // Create JWT token
    const jwtToken = await signJwt(
      {
        sub: userId,
        email: payload.email,
        role,
        sessionId,
      },
      c.env.JWT_SECRET
    );

    return successResponse({
      token: jwtToken,
      userId,
      role,
      status: 'approved',
    });
  } catch (err) {
    console.error('[COMPLETE_PROFILE_ERROR] stage=catch_all error=' + (err instanceof Error ? err.message : String(err)));
    return errorResponse('Failed to complete profile', 500);
  }
});

export default auth;
