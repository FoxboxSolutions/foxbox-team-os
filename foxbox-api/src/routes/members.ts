import { Hono } from 'hono';
import type { Env } from '../types/env';
import { query, queryOne, execute, generateId, nowISO } from '../db/client';
import { successResponse, errorResponse } from '../utils/response';
import { authenticate } from '../middleware/auth';
import { signJwt } from '../utils/jwt';
import { hashPassword } from './auth';

const members = new Hono<{ Bindings: Env }>();

// ─── Config ─────────────────────────────────────────────────

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const DEFAULT_COMMISSION = 150;
const DEFAULT_CURRENCY = 'DZD';

// Invite display role -> canonical AuthRole (no second role system)
const INVITE_ROLES: Record<string, { role: string; label: string; description: string }> = {
  agent: {
    role: 'confirmator',
    label: 'Agent',
    description: 'Team member — commission-based confirmation role, 150 DA per confirmed order.',
  },
  admin: {
    role: 'administrator',
    label: 'Admin',
    description: 'Full administrative role.',
  },
};

// ─── Helpers ────────────────────────────────────────────────

async function requireAdmin(c: { req: { raw: Request } }, env: Env) {
  const authResult = await authenticate(c.req.raw, env);
  if (authResult.error) return { error: authResult.error };
  if (authResult.auth!.user.role !== 'administrator') {
    return { error: errorResponse('Admin only', 403) };
  }
  return { auth: authResult.auth! };
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function newInviteToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function frontendUrl(env: Env): string {
  return env.FRONTEND_URL || 'https://foxbox-team.foxboxsolutions01.workers.dev';
}

function inviteUrlFor(env: Env, token: string): string {
  return `${frontendUrl(env)}/team/invite/${token}`;
}

function toApiInvitation(row: Record<string, unknown>) {
  const expired =
    row.status === 'pending' && new Date(row.expires_at as string).getTime() < Date.now();
  const mapped = INVITE_ROLES[row.role as string];
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    roleLabel: mapped ? mapped.label : row.role,
    invitedBy: row.invited_by,
    status: expired ? 'expired' : row.status,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at ?? null,
    revokedAt: row.revoked_at ?? null,
    createdAt: row.created_at,
  };
}

async function getCommissionConfig(env: Env): Promise<{ amountPerOrder: number; currency: string }> {
  const amountRow = await queryOne<{ value: string }>(env, 'SELECT value FROM settings WHERE key = ?', ['commission_per_order']);
  const currencyRow = await queryOne<{ value: string }>(env, 'SELECT value FROM settings WHERE key = ?', ['commission_currency']);
  const amount = parseInt(amountRow?.value ?? String(DEFAULT_COMMISSION), 10);
  return {
    amountPerOrder: Number.isFinite(amount) && amount >= 0 ? amount : DEFAULT_COMMISSION,
    currency: currencyRow?.value || DEFAULT_CURRENCY,
  };
}

/** Canonical commission award. Idempotent via UNIQUE(confirmation_id). */
export async function awardConfirmationCommission(
  env: Env,
  confirmationId: string,
  agentId: string,
): Promise<{ awarded: boolean; amount: number }> {
  if (!confirmationId || !agentId) return { awarded: false, amount: 0 };
  const config = await getCommissionConfig(env);
  if (config.amountPerOrder <= 0) return { awarded: false, amount: 0 };
  const now = nowISO();
  const result = await env.DB.prepare(
    `INSERT OR IGNORE INTO commissions (id, agent_id, confirmation_id, amount, currency, trigger, status, earned_at, created_at)
     VALUES (?, ?, ?, ?, ?, 'CONFIRMED', 'earned', ?, ?)`
  ).bind(generateId(), agentId, confirmationId, config.amountPerOrder, config.currency, now, now).run();
  return { awarded: (result.meta.changes ?? 0) > 0, amount: config.amountPerOrder };
}

async function trySendInviteEmail(
  env: Env,
  to: string,
  roleLabel: string,
  url: string,
  expiresAt: string,
): Promise<{ sent: boolean; error?: string }> {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    return { sent: false, error: 'No email provider configured (RESEND_API_KEY missing)' };
  }
  const from = env.EMAIL_FROM || 'FOXBOX TEAM <noreply@foxbox.dz>';
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [to],
        subject: "You're invited to join FOXBOX TEAM",
        html: [
          `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#111">`,
          `<h2 style="color:#6d28d9">FOXBOX TEAM</h2>`,
          `<p>You have been invited to join <strong>FOXBOX TEAM</strong> as <strong>${roleLabel}</strong>.</p>`,
          `<p><a href="${url}" style="display:inline-block;background:#6d28d9;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none">Join FOXBOX TEAM</a></p>`,
          `<p style="color:#555">This invitation expires on ${new Date(expiresAt).toUTCString()}.</p>`,
          `<p style="color:#888;font-size:12px">If you did not expect this invitation, you can ignore this email. Never share your invitation link.</p>`,
          `</div>`,
        ].join(''),
      }),
    });
    if (!res.ok) return { sent: false, error: `Email provider error: HTTP ${res.status}` };
    return { sent: true };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : 'Email send failed' };
  }
}

// ─── POST /api/team/invitations — invite member (admin) ─────

members.post('/team/invitations', async (c) => {
  const gate = await requireAdmin(c, c.env);
  if (gate.error) return gate.error;

  const body = await c.req.json().catch(() => ({}));
  const email = String(body.email || '').trim().toLowerCase();
  const requestedRole = String(body.role || 'agent').trim().toLowerCase();
  const mapped = INVITE_ROLES[requestedRole];

  if (!email || !isValidEmail(email)) {
    return errorResponse('A valid email is required', 400);
  }
  if (!mapped) {
    return errorResponse('Role must be agent or admin', 400);
  }

  const existingUser = await queryOne(c.env, 'SELECT id FROM auth_users WHERE email = ?', [email]);
  if (existingUser) {
    return errorResponse('An account with this email already exists', 409);
  }
  const existingInvite = await queryOne<{ id: string; expires_at: string }>(c.env,
    `SELECT id, expires_at FROM team_invitations WHERE email = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1`,
    [email]
  );
  if (existingInvite && new Date(existingInvite.expires_at).getTime() >= Date.now()) {
    return errorResponse('An active invitation already exists for this email. Resend or revoke it instead.', 409);
  }

  const token = newInviteToken();
  const id = generateId();
  const now = nowISO();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();
  await execute(c.env,
    `INSERT INTO team_invitations (id, email, role, token_hash, invited_by, status, expires_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
    [id, email, mapped.role, await sha256Hex(token), gate.auth.user.sub, expiresAt, now, now]
  );

  const url = inviteUrlFor(c.env, token);
  const emailResult = await trySendInviteEmail(c.env, email, mapped.label, url, expiresAt);
  const row = await queryOne<Record<string, unknown>>(c.env, 'SELECT * FROM team_invitations WHERE id = ?', [id]);

  return successResponse({
    invitation: { ...(row ? toApiInvitation(row) : { id, email }), inviteUrl: url },
    emailSent: emailResult.sent,
    ...(emailResult.sent ? {} : { emailError: emailResult.error }),
  });
});

// ─── GET /api/team/invitations — list (admin) ────────────────

members.get('/team/invitations', async (c) => {
  const gate = await requireAdmin(c, c.env);
  if (gate.error) return gate.error;

  const rows = await query<Record<string, unknown>>(c.env,
    'SELECT * FROM team_invitations ORDER BY created_at DESC'
  );
  return successResponse(rows.map(r => toApiInvitation(r)));
});

// ─── POST /api/team/invitations/:id/resend — rotate token (admin)

members.post('/team/invitations/:id/resend', async (c) => {
  const gate = await requireAdmin(c, c.env);
  if (gate.error) return gate.error;

  const invite = await queryOne<Record<string, unknown>>(c.env,
    'SELECT * FROM team_invitations WHERE id = ?', [c.req.param('id')]
  );
  if (!invite) return errorResponse('Invitation not found', 404);
  if (invite.status !== 'pending') {
    return errorResponse('Only pending invitations can be resent', 400);
  }

  const token = newInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();
  await execute(c.env,
    `UPDATE team_invitations SET token_hash = ?, expires_at = ?, updated_at = ? WHERE id = ?`,
    [await sha256Hex(token), expiresAt, nowISO(), invite.id]
  );

  const mapped = INVITE_ROLES[invite.role as string];
  const url = inviteUrlFor(c.env, token);
  const emailResult = await trySendInviteEmail(c.env, invite.email as string, mapped?.label ?? String(invite.role), url, expiresAt);
  const row = await queryOne<Record<string, unknown>>(c.env, 'SELECT * FROM team_invitations WHERE id = ?', [invite.id]);

  return successResponse({
    invitation: { ...(row ? toApiInvitation(row) : { id: invite.id }), inviteUrl: url },
    emailSent: emailResult.sent,
    ...(emailResult.sent ? {} : { emailError: emailResult.error }),
  });
});

// ─── POST /api/team/invitations/:id/revoke (admin) ──────────

members.post('/team/invitations/:id/revoke', async (c) => {
  const gate = await requireAdmin(c, c.env);
  if (gate.error) return gate.error;

  const invite = await queryOne<Record<string, unknown>>(c.env,
    'SELECT * FROM team_invitations WHERE id = ?', [c.req.param('id')]
  );
  if (!invite) return errorResponse('Invitation not found', 404);
  if (invite.status !== 'pending') {
    return errorResponse('Only pending invitations can be revoked', 400);
  }
  const now = nowISO();
  await execute(c.env,
    `UPDATE team_invitations SET status = 'revoked', revoked_at = ?, updated_at = ? WHERE id = ?`,
    [now, now, invite.id]
  );
  return successResponse(null, 'Invitation revoked');
});

// ─── GET /api/team/invitations/validate — public ─────────────

members.get('/team/invitations/validate', async (c) => {
  const token = (c.req.query('token') || '').trim();
  if (!token || token.length < 32) {
    return successResponse({ valid: false, reason: 'invalid' });
  }
  const invite = await queryOne<Record<string, unknown>>(c.env,
    'SELECT * FROM team_invitations WHERE token_hash = ?', [await sha256Hex(token)]
  );
  if (!invite) return successResponse({ valid: false, reason: 'invalid' });
  if (invite.status === 'revoked') return successResponse({ valid: false, reason: 'revoked' });
  if (invite.status === 'accepted') return successResponse({ valid: false, reason: 'accepted' });
  if (new Date(invite.expires_at as string).getTime() < Date.now()) {
    return successResponse({ valid: false, reason: 'expired' });
  }
  const mapped = INVITE_ROLES[invite.role as string];
  return successResponse({
    valid: true,
    email: invite.email,
    role: invite.role,
    roleLabel: mapped?.label ?? invite.role,
    expiresAt: invite.expires_at,
  });
});

// ─── POST /api/team/invitations/accept — public signup ───────

members.post('/team/invitations/accept', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const token = String(body.token || '').trim();
  const fullName = String(body.fullName || '').trim();
  const password = String(body.password || '');

  if (!token || token.length < 32) return errorResponse('Invalid invitation', 400);
  if (!fullName) return errorResponse('Full name is required', 400);
  if (!password || password.length < 8) {
    return errorResponse('Password must be at least 8 characters', 400);
  }

  const invite = await queryOne<Record<string, unknown>>(c.env,
    'SELECT * FROM team_invitations WHERE token_hash = ?', [await sha256Hex(token)]
  );
  if (!invite) return errorResponse('Invalid invitation', 400);
  if (invite.status === 'revoked') return errorResponse('This invitation was revoked', 400);
  if (invite.status === 'accepted') return errorResponse('This invitation was already accepted', 400);
  if (new Date(invite.expires_at as string).getTime() < Date.now()) {
    return errorResponse('This invitation has expired', 400);
  }

  // Role comes from the invitation only — never from client input
  const role = String(invite.role);
  if (role !== 'administrator' && role !== 'confirmator') {
    return errorResponse('Invalid invitation role', 400);
  }
  const email = String(invite.email).toLowerCase();

  const existingUser = await queryOne(c.env, 'SELECT id FROM auth_users WHERE email = ?', [email]);
  if (existingUser) {
    return errorResponse('An account with this email already exists. Please log in instead.', 409);
  }

  const userId = generateId();
  const now = nowISO();
  const sessionId = generateId();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await execute(c.env,
    `INSERT INTO auth_users (id, full_name, email, password_hash, role, requested_role, status, auth_provider, created_at, updated_at, approved_at, approved_by, last_login_at)
     VALUES (?, ?, ?, ?, ?, ?, 'approved', 'email', ?, ?, ?, ?, ?)`,
    [userId, fullName, email, await hashPassword(password), role, role, now, now, now, String(invite.invited_by), now]
  );
  await execute(c.env,
    'INSERT INTO auth_sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
    [sessionId, userId, now, expiresAt]
  );
  await execute(c.env,
    `UPDATE team_invitations SET status = 'accepted', accepted_at = ?, accepted_user_id = ?, updated_at = ? WHERE id = ?`,
    [now, userId, now, invite.id]
  );

  const jwt = await signJwt({ sub: userId, email, role, sessionId }, c.env.JWT_SECRET);
  return successResponse({
    token: jwt,
    user: { id: userId, fullName, email, role, status: 'approved' },
  });
});

// ─── GET /api/team/members — users + commission stats (admin)

members.get('/team/members', async (c) => {
  const gate = await requireAdmin(c, c.env);
  if (gate.error) return gate.error;

  const rows = await query<Record<string, unknown>>(c.env,
    `SELECT u.id, u.full_name AS fullName, u.email, u.avatar, u.role,
            u.requested_role AS requestedRole, u.status,
            u.auth_provider AS authProvider,
            u.created_at AS createdAt, u.last_login_at AS lastLoginAt,
            COUNT(cm.id) AS confirmedCount,
            COALESCE(SUM(cm.amount), 0) AS totalEarned
     FROM auth_users u
     LEFT JOIN commissions cm ON cm.agent_id = u.id
     GROUP BY u.id
     ORDER BY u.created_at DESC`
  );
  return successResponse(rows);
});

// ─── GET /api/team/commissions/summary — team performance (authed)

members.get('/team/commissions/summary', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const config = await getCommissionConfig(c.env);
  const rows = await query<Record<string, unknown>>(c.env,
    `SELECT u.id AS userId, u.full_name AS fullName, u.email, u.role,
            COUNT(cm.id) AS confirmedCount,
            COALESCE(SUM(cm.amount), 0) AS totalEarned
     FROM auth_users u
     LEFT JOIN commissions cm ON cm.agent_id = u.id
     WHERE u.status = 'approved'
     GROUP BY u.id
     ORDER BY totalEarned DESC, confirmedCount DESC`
  );
  return successResponse({ ...config, agents: rows });
});

// ─── GET /api/team/commissions — ledger (authed) ─────────────

members.get('/team/commissions', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const url = new URL(c.req.url);
  const agentId = (url.searchParams.get('agentId') || '').trim();
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 1), 200);
  const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10) || 0, 0);

  const where: string[] = [];
  const params: unknown[] = [];
  if (agentId) { where.push('c.agent_id = ?'); params.push(agentId); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const totalRow = await queryOne<{ total: number }>(
    c.env, `SELECT COUNT(*) as total FROM commissions c ${whereSql}`, params
  );
  const rows = await query<Record<string, unknown>>(c.env,
    `SELECT c.id, c.agent_id AS agentId, c.confirmation_id AS confirmationId,
            c.amount, c.currency, c.trigger, c.status,
            c.earned_at AS earnedAt, c.created_at AS createdAt,
            u.full_name AS agentName, u.email AS agentEmail
     FROM commissions c
     LEFT JOIN auth_users u ON u.id = c.agent_id
     ${whereSql} ORDER BY c.earned_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return successResponse({ commissions: rows, total: totalRow?.total ?? rows.length });
});

// ─── GET/PUT /api/team/commissions/config ────────────────────

members.get('/team/commissions/config', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;
  return successResponse(await getCommissionConfig(c.env));
});

members.put('/team/commissions/config', async (c) => {
  const gate = await requireAdmin(c, c.env);
  if (gate.error) return gate.error;

  const body = await c.req.json().catch(() => ({}));
  const amount = parseInt(String(body.amountPerOrder ?? ''), 10);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1000000) {
    return errorResponse('amountPerOrder must be a number between 0 and 1000000', 400);
  }
  await execute(c.env,
    `INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('commission_per_order', ?, datetime('now'))`,
    [String(amount)]
  );
  return successResponse(await getCommissionConfig(c.env));
});

export default members;
