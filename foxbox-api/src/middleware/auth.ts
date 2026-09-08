import type { Env } from '../types/env';
import type { JwtPayload } from '../utils/jwt';
import { verifyJwt } from '../utils/jwt';
import { queryOne } from '../db/client';
import { errorResponse } from '../utils/response';

export interface AuthContext {
  user: JwtPayload;
}

export async function authenticate(
  request: Request,
  env: Env
): Promise<{ auth: AuthContext | null; error?: Response }> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { auth: null, error: errorResponse('Missing or invalid Authorization header', 401) };
  }

  const token = authHeader.slice(7);
  const payload = await verifyJwt(token, env.JWT_SECRET);

  if (!payload) {
    return { auth: null, error: errorResponse('Invalid or expired token', 401) };
  }

  // Verify session still exists in D1
  const session = await queryOne(env, 'SELECT id FROM auth_sessions WHERE id = ? AND expires_at > datetime("now")', [payload.sessionId]);
  if (!session) {
    return { auth: null, error: errorResponse('Session expired', 401) };
  }

  // Check user status — block/banned users cannot access the platform
  const user = await queryOne<{ status: string }>(env, 'SELECT status FROM auth_users WHERE id = ?', [payload.sub]);
  if (!user) {
    return { auth: null, error: errorResponse('Account not found', 401) };
  }
  if (user.status === 'blocked') {
    return { auth: null, error: errorResponse('Your account has been blocked. Please contact an administrator.', 403) };
  }
  if (user.status === 'banned') {
    return { auth: null, error: errorResponse('Your account has been banned. Please contact an administrator.', 403) };
  }

  return { auth: { user: payload } };
}

export function requireRole(...roles: string[]) {
  return (auth: AuthContext): Response | null => {
    if (!roles.includes(auth.user.role)) {
      return errorResponse('Insufficient permissions', 403);
    }
    return null;
  };
}
