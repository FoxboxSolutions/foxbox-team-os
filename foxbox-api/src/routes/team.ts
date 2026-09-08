import { Hono } from 'hono';
import type { Env } from '../types/env';
import { execute, generateId, nowISO } from '../db/client';
import { successResponse, errorResponse } from '../utils/response';
import { authenticate } from '../middleware/auth';

const team = new Hono<{ Bindings: Env }>();

// ─── TASKS ──────────────────────────────────────────────────

team.get('/tasks', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const url = new URL(c.req.url);
  const status = url.searchParams.get('status');
  const assignee = url.searchParams.get('assignee');

  let sql = 'SELECT * FROM tasks WHERE 1=1';
  const params: unknown[] = [];
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (assignee) { sql += ' AND assignee_id = ?'; params.push(assignee); }
  sql += ' ORDER BY created_at DESC';

  const results = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json(results.results.map((t: Record<string, unknown>) => ({
    ...t,
    tags: JSON.parse(t.tags as string || '[]'),
    attachments: JSON.parse(t.attachments as string || '[]'),
    comments: JSON.parse(t.comments as string || '[]'),
    activity: JSON.parse(t.activity as string || '[]'),
  })));
});

team.post('/tasks', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const data = await c.req.json();
  const id = generateId();
  const now = nowISO();

  await execute(c.env,
    `INSERT INTO tasks (id, title, description, assignee_id, creator_id, priority, status, due_date, tags, product_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.title, data.description || '', data.assigneeId, authResult.auth!.user.sub, data.priority || 'MEDIUM', data.status || 'TODO', data.dueDate || null, JSON.stringify(data.tags || []), data.productId || null, now, now]
  );

  return c.json(successResponse({ id }));
});

team.put('/tasks/:id', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const data = await c.req.json();
  const now = nowISO();
  const fields: string[] = ['updated_at = ?'];
  const values: unknown[] = [now];

  if (data.title) { fields.push('title = ?'); values.push(data.title); }
  if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
  if (data.status) { fields.push('status = ?'); values.push(data.status); }
  if (data.priority) { fields.push('priority = ?'); values.push(data.priority); }
  if (data.assigneeId) { fields.push('assignee_id = ?'); values.push(data.assigneeId); }
  if (data.dueDate !== undefined) { fields.push('due_date = ?'); values.push(data.dueDate); }
  if (data.tags) { fields.push('tags = ?'); values.push(JSON.stringify(data.tags)); }
  if (data.comments) { fields.push('comments = ?'); values.push(JSON.stringify(data.comments)); }

  values.push(c.req.param('id'));
  await execute(c.env, `UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`, values);
  return c.json(successResponse(null, 'Task updated'));
});

team.delete('/tasks/:id', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;
  await execute(c.env, 'DELETE FROM tasks WHERE id = ?', [c.req.param('id')]);
  return c.json(successResponse(null, 'Task deleted'));
});

// ─── POSTS ──────────────────────────────────────────────────

team.get('/posts', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const results = await c.env.DB.prepare('SELECT * FROM posts ORDER BY created_at DESC').all();
  return c.json(results.results.map((p: Record<string, unknown>) => ({
    ...p,
    images: JSON.parse(p.images as string || '[]'),
    links: JSON.parse(p.links as string || '[]'),
    reactions: JSON.parse(p.reactions as string || '[]'),
    post_comments: JSON.parse(p.post_comments as string || '[]'),
    bookmarks: JSON.parse(p.bookmarks as string || '[]'),
  })));
});

team.post('/posts', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const data = await c.req.json();
  const id = generateId();
  const now = nowISO();

  await execute(c.env,
    `INSERT INTO posts (id, user_id, type, title, content, images, links, product_id, task_id, reactions, post_comments, bookmarks, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, authResult.auth!.user.sub, data.type || 'GENERAL', data.title, data.content, JSON.stringify(data.images || []), JSON.stringify(data.links || []), data.productId || null, data.taskId || null, JSON.stringify(data.reactions || []), JSON.stringify(data.comments || []), JSON.stringify(data.bookmarks || []), now]
  );

  return c.json(successResponse({ id }));
});

// ─── CHANNELS ───────────────────────────────────────────────

team.get('/channels', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const results = await c.env.DB.prepare('SELECT * FROM channels ORDER BY name').all();
  return c.json(results.results);
});

team.post('/channels', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const data = await c.req.json();
  const id = generateId();

  await execute(c.env,
    `INSERT INTO channels (id, name, description, icon, is_product_linked, product_id) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, data.name, data.description || '', data.icon || 'Hash', data.isProductLinked ? 1 : 0, data.productId || null]
  );

  return c.json(successResponse({ id }));
});

// ─── MESSAGES ───────────────────────────────────────────────

team.get('/channels/:channelId/messages', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const results = await c.env.DB.prepare(
    'SELECT * FROM messages WHERE channel_id = ? ORDER BY created_at ASC'
  ).bind(c.req.param('channelId')).all();

  return c.json(results.results.map((m: Record<string, unknown>) => ({
    ...m,
    mentions: JSON.parse(m.mentions as string || '[]'),
  })));
});

team.post('/channels/:channelId/messages', async (c) => {
  const authResult = await authenticate(c.req.raw, c.env);
  if (authResult.error) return authResult.error;

  const data = await c.req.json();
  const id = generateId();
  const now = nowISO();

  await execute(c.env,
    `INSERT INTO messages (id, channel_id, user_id, content, mentions, replies_to, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, c.req.param('channelId'), authResult.auth!.user.sub, data.content, JSON.stringify(data.mentions || []), data.repliesTo || null, now]
  );

  return c.json(successResponse({ id }));
});

export default team;
