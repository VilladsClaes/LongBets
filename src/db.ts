export interface Env {
  DB: D1Database;
  ASSETS: { fetch(request: Request): Promise<Response> };
  FREEBUFF_CLIENT_ID?: string;
  FREEBUFF_ISSUER?: string;
  APP_ORIGIN?: string;
  LB_DEV?: string;
}

export interface Player {
  sub: string;
  name: string;
  balance: number;
  is_admin: number;
  last_bonus: string | null;
  created_at: string;
}

export interface NewsRow {
  id: number;
  source: string;
  title: string;
  url: string;
  summary: string | null;
  image: string | null;
  published_at: string | null;
  fetched_at: string;
}

export interface BetRow {
  id: number;
  title: string;
  detail: string | null;
  kind: string;
  news_id: number | null;
  source_url: string | null;
  source_name: string | null;
  source_image: string | null;
  created_by: string;
  status: string;
  outcome: string | null;
  resolution_note: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  closes_at: string | null;
  created_at: string;
}

export interface PickRow {
  id: number;
  bet_id: number;
  sub: string;
  side: string;
  statement: string | null;
  stake: number;
  status: string;
  win_note: string | null;
  created_at: string;
  name?: string | null;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS players (
  sub TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  balance INTEGER NOT NULL DEFAULT 1000,
  is_admin INTEGER NOT NULL DEFAULT 0,
  last_bonus TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  summary TEXT,
  image TEXT,
  published_at TEXT,
  fetched_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_news_published ON news(published_at DESC);
CREATE TABLE IF NOT EXISTS feed_state (
  source TEXT PRIMARY KEY,
  last_fetch TEXT NOT NULL,
  ok INTEGER NOT NULL DEFAULT 1,
  count INTEGER NOT NULL DEFAULT 0,
  error TEXT
);
CREATE TABLE IF NOT EXISTS bets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  detail TEXT,
  kind TEXT NOT NULL DEFAULT 'custom',
  news_id INTEGER,
  source_url TEXT,
  source_name TEXT,
  source_image TEXT,
  created_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  outcome TEXT,
  resolution_note TEXT,
  resolved_by TEXT,
  resolved_at TEXT,
  closes_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bets_status ON bets(status, created_at DESC);
CREATE TABLE IF NOT EXISTS picks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bet_id INTEGER NOT NULL,
  sub TEXT NOT NULL,
  side TEXT NOT NULL,
  statement TEXT,
  stake INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'held',
  win_note TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (bet_id, sub)
);
CREATE INDEX IF NOT EXISTS idx_picks_bet ON picks(bet_id);
CREATE INDEX IF NOT EXISTS idx_picks_sub ON picks(sub);
`;

const STATEMENTS = SCHEMA.split(";")
  .map((s) => s.trim())
  .filter(Boolean);

let schemaReady: Promise<void> | null = null;

export function ensureSchema(db: D1Database): Promise<void> {
  schemaReady ??= db
    .batch(STATEMENTS.map((sql) => db.prepare(sql)))
    .then(() => undefined);
  return schemaReady;
}

export function now(): string {
  return new Date().toISOString();
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export const START_BALANCE = 1000;
export const DAILY_BONUS = 100;

/** Hent eller opret spilleren bag et Freebuff-sub. */
export async function ensurePlayer(db: D1Database, sub: string, name: string): Promise<Player> {
  await db
    .prepare('INSERT INTO players (sub, name, balance, is_admin, created_at) VALUES (?, ?, ?, 0, ?) ON CONFLICT(sub) DO NOTHING')
    .bind(sub, name, START_BALANCE, now())
    .run();

  const row = await db.prepare('SELECT * FROM players WHERE sub = ?').bind(sub).first<Player>();
  if (!row) throw new Error('kunne ikke oprette spiller');
  if (name && row.name !== name) {
    await db.prepare('UPDATE players SET name = ? WHERE sub = ?').bind(name, sub).run();
    row.name = name;
  }
  // Først til mødet bliver admin, når ingen admin findes endnu.
  const adminExists = await db
    .prepare('SELECT 1 AS x FROM players WHERE is_admin = 1 LIMIT 1')
    .bind()
    .first<{ x: number }>();
  if (!adminExists) {
    await db.prepare('UPDATE players SET is_admin = 1 WHERE sub = ?').bind(sub).run();
    row.is_admin = 1;
  }
  return row;
}

/** Daglig bonus på 100 kr. – så der altid er mønter at spille for. */
export async function grantDailyBonus(db: D1Database, player: Player): Promise<{ gained: number; player: Player }> {
  const t = today();
  if (player.last_bonus === t) return { gained: 0, player };
  const res = await db
    .prepare('UPDATE players SET balance = balance + ?, last_bonus = ? WHERE sub = ? AND (last_bonus IS NULL OR last_bonus <> ?)')
    .bind(DAILY_BONUS, t, player.sub, t)
    .run();
  const gained = res.meta.changes > 0 ? DAILY_BONUS : 0;
  const fresh = (await db.prepare('SELECT * FROM players WHERE sub = ?').bind(player.sub).first<Player>()) ?? player;
  return { gained, player: fresh };
}

export async function getPlayer(db: D1Database, sub: string): Promise<Player | null> {
  return (await db.prepare('SELECT * FROM players WHERE sub = ?').bind(sub).first<Player>()) ?? null;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
