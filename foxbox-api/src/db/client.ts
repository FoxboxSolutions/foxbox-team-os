import type { Env } from '../types/env';

export async function query<T = Record<string, unknown>>(
  env: Env,
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const stmt = env.DB.prepare(sql);
  const result = params
    ? await stmt.bind(...params).all<T>()
    : await stmt.all<T>();
  return result.results || [];
}

export async function queryOne<T = Record<string, unknown>>(
  env: Env,
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  const results = await query<T>(env, sql, params);
  return results[0] || null;
}

export async function execute(
  env: Env,
  sql: string,
  params?: unknown[]
): Promise<D1Result> {
  const stmt = env.DB.prepare(sql);
  return params ? stmt.bind(...params).run() : stmt.run();
}

export async function batchExecute(
  env: Env,
  statements: { sql: string; params?: unknown[] }[]
): Promise<D1Result[]> {
  const stmts = statements.map(({ sql, params }) => {
    const stmt = env.DB.prepare(sql);
    return params ? stmt.bind(...params) : stmt;
  });
  return env.DB.batch(stmts);
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

export function nowISO(): string {
  return new Date().toISOString();
}
