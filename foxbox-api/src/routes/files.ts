import { Hono } from 'hono';
import type { Env } from '../types/env';
import { query, queryOne, execute, generateId, nowISO } from '../db/client';
import { successResponse, errorResponse } from '../utils/response';
import { authenticate } from '../middleware/auth';

const files = new Hono<{ Bindings: Env }>();

// ─── Config ─────────────────────────────────────────────────

// Cloudflare Workers single-request body ceiling is 100 MB — keep default at the
// platform max so marketing videos are never blocked; tune via FILES_MAX_BYTES.
const DEFAULT_MAX_BYTES = 100 * 1024 * 1024;

const ALLOWED_TYPES: Record<string, { exts: string[]; category: 'image' | 'video' }> = {
  'image/jpeg': { exts: ['jpg', 'jpeg'], category: 'image' },
  'image/png': { exts: ['png'], category: 'image' },
  'image/webp': { exts: ['webp'], category: 'image' },
  'image/gif': { exts: ['gif'], category: 'image' },
  'video/mp4': { exts: ['mp4'], category: 'video' },
  'video/quicktime': { exts: ['mov'], category: 'video' },
  'video/webm': { exts: ['webm'], category: 'video' },
};

const VALID_FOLDERS = new Set([
  'PRODUCTS', 'CREATIVES', 'VIDEOS', 'IMAGES',
  'SUPPLIERS', 'DOCUMENTS', 'MARKETING', 'OPERATIONS',
]);

// ─── Helpers ────────────────────────────────────────────────

function getMaxBytes(env: Env): number {
  const raw = env.FILES_MAX_BYTES ? parseInt(env.FILES_MAX_BYTES, 10) : NaN;
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MAX_BYTES;
}

function sanitizeFileName(name: string): string {
  const base = String(name || '').split(/[\\/]/).pop() || 'file';
  const cleaned = base
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
  return (cleaned || 'file').slice(0, 80);
}

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

/** Validate actual file signature (magic bytes), not just the claimed MIME. */
function matchesSignature(mime: string, bytes: Uint8Array): boolean {
  const ascii = (o: number, n: number) =>
    String.fromCharCode(...bytes.slice(o, o + n));
  switch (mime) {
    case 'image/jpeg':
      return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case 'image/png':
      return (
        bytes.length >= 8 &&
        bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e &&
        bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a &&
        bytes[6] === 0x1a && bytes[7] === 0x0a
      );
    case 'image/gif':
      return bytes.length >= 6 && ascii(0, 4) === 'GIF8';
    case 'image/webp':
      return bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP';
    case 'video/mp4':
    case 'video/quicktime':
      return bytes.length >= 8 && ascii(4, 4) === 'ftyp';
    case 'video/webm':
      return (
        bytes.length >= 4 &&
        bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3
      );
    default:
      return false;
  }
}

function toApiFile(row: Record<string, unknown>, origin: string) {
  let tags: string[] = [];
  try {
    const parsed = JSON.parse((row.tags as string) || '[]');
    if (Array.isArray(parsed)) tags = parsed.filter(t => typeof t === 'string');
  } catch { tags = []; }
  return {
    id: row.id,
    name: row.name,
    originalName: row.original_name,
    mimeType: row.mime_type,
    size: row.size,
    url: `${origin}/api/files/${row.id}/content`,
    thumbnailUrl: row.thumbnail_url ?? null,
    folder: row.folder,
    tags,
    productId: row.product_id ?? null,
    uploadedBy: row.uploaded_by,
    category: row.category ?? 'other',
    source: row.source ?? 'upload',
    width: row.width ?? null,
    height: row.height ?? null,
    durationSeconds: row.duration_seconds ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? null,
  };
}

function parseTags(raw: unknown): string[] {
  if (!raw) return [];
  let list: unknown = raw;
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) return [];
    try {
      list = JSON.parse(s);
    } catch {
      list = s.split(',');
    }
  }
  if (!Array.isArray(list)) return [];
  return list
    .filter((t): t is string => typeof t === 'string')
    .map(t => t.trim().slice(0, 40))
    .filter(Boolean)
    .slice(0, 20);
}

/** Authenticate via Authorization header, or ?token= fallback (for copied URLs). */
async function authenticateFileRequest(c: { req: { header: (n: string) => string | undefined; query: (n: string) => string | undefined; url: string; raw: Request } }, env: Env) {
  if (c.req.header('Authorization')) return authenticate(c.req.raw, env);
  const token = c.req.query('token');
  if (!token) return authenticate(c.req.raw, env);
  const req = new Request(c.req.url, { headers: { Authorization: `Bearer ${token}` } });
  return authenticate(req, env);
}

// ─── POST /api/files — upload (administrator only) ──────────

files.post('/files', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;
  if (authResult.auth!.user.role !== 'administrator') {
    return errorResponse('Admin only', 403);
  }

  let body: Record<string, string | File | File[]>;
  try {
    body = await c.req.parseBody();
  } catch {
    return errorResponse('Invalid multipart body', 400);
  }

  const rawFiles: File[] = [];
  for (const key of ['file', 'files', 'files[]']) {
    const v = body[key];
    if (!v) continue;
    if (Array.isArray(v)) {
      for (const item of v) if (item instanceof File) rawFiles.push(item);
    } else if (v instanceof File) {
      rawFiles.push(v);
    }
  }
  if (rawFiles.length === 0) {
    return errorResponse('No file provided. Send multipart field "file" or "files".', 400);
  }
  if (rawFiles.length > 10) {
    return errorResponse('Too many files. Max 10 per request.', 400);
  }

  const folderRaw = typeof body.folder === 'string' ? body.folder.toUpperCase() : 'DOCUMENTS';
  const folder = VALID_FOLDERS.has(folderRaw) ? folderRaw : 'DOCUMENTS';
  const tags = parseTags(body.tags);
  const productId = typeof body.product_id === 'string' && body.product_id
    ? body.product_id
    : (typeof body.productId === 'string' && body.productId ? body.productId : null);

  const maxBytes = getMaxBytes(c.env);
  const origin = new URL(c.req.url).origin;
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const uploaderId = authResult.auth!.user.sub;

  const saved: Record<string, unknown>[] = [];
  try {
    for (const file of rawFiles) {
      const mime = file.type || '';
      const allowed = ALLOWED_TYPES[mime];
      if (!allowed) {
        throw { status: 415, message: `Unsupported file type: ${mime || 'unknown'}. Allowed: images (jpeg, png, webp, gif) and videos (mp4, mov, webm).` };
      }
      if (file.size <= 0) {
        throw { status: 400, message: `Empty file rejected: ${file.name}` };
      }
      if (file.size > maxBytes) {
        throw { status: 413, message: `File too large: ${file.name} (${file.size} bytes, max ${maxBytes}).` };
      }
      const safeName = sanitizeFileName(file.name);
      const ext = extOf(safeName);
      if (!ext || !allowed.exts.includes(ext)) {
        throw { status: 400, message: `File extension does not match MIME type for: ${file.name}` };
      }

      const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
      if (!matchesSignature(mime, head)) {
        throw { status: 400, message: `File content does not match its type: ${file.name}` };
      }

      const id = generateId();
      const storageKey = `files/${year}/${month}/${id}-${safeName}`;
      const createdAt = nowISO();

      await c.env.R2_BUCKET.put(storageKey, file, {
        httpMetadata: { contentType: mime },
      });

      try {
        await execute(c.env,
          `INSERT INTO files (id, name, original_name, mime_type, size, url, thumbnail_url, folder, tags, product_id, uploaded_by, storage_key, category, source, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'upload', ?, ?)`,
          [id, safeName, file.name, mime, file.size, `/api/files/${id}/content`, null, folder, JSON.stringify(tags), productId, uploaderId, storageKey, allowed.category, createdAt, createdAt]
        );
      } catch (dbErr) {
        // Atomicity: D1 failed after R2 upload -> clean up the orphan object
        await c.env.R2_BUCKET.delete(storageKey).catch(() => {});
        throw dbErr;
      }

      const row = await queryOne<Record<string, unknown>>(c.env, 'SELECT * FROM files WHERE id = ?', [id]);
      if (row) saved.push(row);
    }
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) {
      const e = err as { status: number; message: string };
      return errorResponse(e.message, e.status);
    }
    return errorResponse(err instanceof Error ? err.message : 'Upload failed', 500);
  }

  const apiOrigin = origin;
  return successResponse(saved.map(r => toApiFile(r, apiOrigin)));
});

// ─── GET /api/files — list metadata (any authenticated role) ─

files.get('/files', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const url = new URL(c.req.url);
  const search = (url.searchParams.get('search') || '').trim().toLowerCase();
  const category = (url.searchParams.get('category') || '').trim().toLowerCase();
  const folder = (url.searchParams.get('folder') || '').trim().toUpperCase();
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 1), 200);
  const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10) || 0, 0);

  const where: string[] = [];
  const params: unknown[] = [];
  if (search) {
    where.push('(LOWER(name) LIKE ? OR LOWER(original_name) LIKE ? OR LOWER(tags) LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (category === 'image' || category === 'video') {
    where.push('category = ?');
    params.push(category);
  }
  if (folder && VALID_FOLDERS.has(folder)) {
    where.push('folder = ?');
    params.push(folder);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const origin = new URL(c.req.url).origin;

  const totalRow = await queryOne<{ total: number }>(
    c.env, `SELECT COUNT(*) as total FROM files ${whereSql}`, params
  );
  const rows = await query<Record<string, unknown>>(
    c.env, `SELECT * FROM files ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return successResponse({ files: rows.map(r => toApiFile(r, origin)), total: totalRow?.total ?? rows.length });
});

// ─── GET /api/files/:id — metadata (any authenticated role) ─

files.get('/files/:id', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const row = await queryOne<Record<string, unknown>>(c.env, 'SELECT * FROM files WHERE id = ?', [c.req.param('id')]);
  if (!row) return errorResponse('File not found', 404);
  return successResponse(toApiFile(row, new URL(c.req.url).origin));
});

// ─── GET /api/files/:id/content — stream bytes (private R2) ─

files.get('/files/:id/content', async (c) => {
  const authResult = await authenticateFileRequest(c, c.env);
  if (authResult.error) return authResult.error;

  const row = await queryOne<{ storage_key: string; mime_type: string; size: number; name: string }>(
    c.env, 'SELECT storage_key, mime_type, size FROM files WHERE id = ?', [c.req.param('id')]
  );
  if (!row || !row.storage_key) return errorResponse('File not found', 404);

  const rangeHeader = c.req.header('Range');
  if (rangeHeader) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
    if (!m) {
      return new Response('Invalid range', {
        status: 416,
        headers: { 'Content-Range': `bytes */${row.size}`, 'Access-Control-Allow-Origin': '*' },
      });
    }
    const start = m[1] === '' ? Math.max(row.size - parseInt(m[2] || '0', 10), 0) : parseInt(m[1], 10);
    const end = m[2] === '' ? row.size - 1 : parseInt(m[2], 10);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end >= row.size || start > end) {
      return new Response('Range not satisfiable', {
        status: 416,
        headers: { 'Content-Range': `bytes */${row.size}`, 'Access-Control-Allow-Origin': '*' },
      });
    }
    const obj = await c.env.R2_BUCKET.get(row.storage_key, { range: { offset: start, length: end - start + 1 } });
    if (!obj) return errorResponse('File not found', 404);
    return new Response(obj.body, {
      status: 206,
      headers: {
        'Content-Type': row.mime_type,
        'Content-Length': String(end - start + 1),
        'Content-Range': `bytes ${start}-${end}/${row.size}`,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  const obj = await c.env.R2_BUCKET.get(row.storage_key);
  if (!obj) return errorResponse('File not found', 404);
  return new Response(obj.body, {
    status: 200,
    headers: {
      'Content-Type': row.mime_type,
      'Content-Length': String(obj.size),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  });
});

// ─── DELETE /api/files/:id — administrator only ──────────────

files.delete('/files/:id', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;
  if (authResult.auth!.user.role !== 'administrator') {
    return errorResponse('Admin only', 403);
  }

  const id = c.req.param('id');
  // Never trust a client-provided storage key: resolve it via D1 first
  const row = await queryOne<{ storage_key: string }>(c.env, 'SELECT storage_key FROM files WHERE id = ?', [id]);
  if (!row) return errorResponse('File not found', 404);

  // R2 delete is idempotent (missing keys succeed silently).
  // A real R2 failure throws -> abort with 500 BEFORE touching D1 (no orphans).
  if (row.storage_key) {
    await c.env.R2_BUCKET.delete(row.storage_key);
  }
  await execute(c.env, 'DELETE FROM files WHERE id = ?', [id]);
  return successResponse(null, 'File deleted');
});

export default files;
