import type { BetRow, PickRow, Player } from "./db";
import { now } from "./db";

export type Side = "ja" | "nej";

export interface BetWithCreator extends BetRow {
  creator_name: string | null;
}

export interface PickWithPlayer extends PickRow {
  name: string | null;
}

export interface BetDetail {
  bet: BetWithCreator;
  picks: PickWithPlayer[];
  ja: { stake: number; count: number };
  nej: { stake: number; count: number };
}

export function sideTotals(picks: PickRow[]): { ja: { stake: number; count: number }; nej: { stake: number; count: number } } {
  const out = { ja: { stake: 0, count: 0 }, nej: { stake: 0, count: 0 } };
  for (const p of picks) {
    if (p.side !== "ja" && p.side !== "nej") continue;
    out[p.side].stake += p.stake;
    out[p.side].count += 1;
  }
  return out;
}

export function pot(picks: PickRow[]): number {
  return picks.reduce((a, p) => a + p.stake, 0);
}

export interface CreateBetInput {
  created_by: string;
  title: string;
  detail?: string | null;
  kind: "news" | "link" | "custom";
  news_id?: number | null;
  source_url?: string | null;
  source_name?: string | null;
  source_image?: string | null;
  closes_at?: string | null;
  pick?: { side: Side; stake: number; statement?: string | null };
}

/** Opret et væddemål – og evt. forfatterens egen indsats i samme hug. */
export async function createBet(db: D1Database, input: CreateBetInput): Promise<number> {
  const stake = input.pick?.stake ?? 0;
  if (stake > 0) {
    const res = await db.batch([
      db
        .prepare(
          `INSERT INTO bets (title, detail, kind, news_id, source_url, source_name, source_image, created_by, status, closes_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
        )
        .bind(
          input.title.slice(0, 300),
          input.detail?.slice(0, 1000) ?? null,
          input.kind,
          input.news_id ?? null,
          input.source_url ?? null,
          input.source_name?.slice(0, 300) ?? null,
          input.source_image ?? null,
          input.created_by,
          input.closes_at ?? null,
          now(),
        ),
      db.prepare('UPDATE players SET balance = balance - ? WHERE sub = ? AND balance >= ?').bind(stake, input.created_by, stake),
    ]);
    const betId = Number(res[0].meta.last_row_id);
    if (!res[1].meta.changes) throw new Error("Du har ikke penge nok til den indsats.");
    await db
      .prepare(
        `INSERT INTO picks (bet_id, sub, side, statement, stake, status, created_at) VALUES (?, ?, ?, ?, ?, 'held', ?)`,
      )
      .bind(betId, input.created_by, input.pick!.side, input.pick!.statement?.slice(0, 500) ?? null, stake, now())
      .run();
    return betId;
  }

  const res = await db
    .prepare(
      `INSERT INTO bets (title, detail, kind, news_id, source_url, source_name, source_image, created_by, status, closes_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
    )
    .bind(
      input.title.slice(0, 300),
      input.detail?.slice(0, 1000) ?? null,
      input.kind,
      input.news_id ?? null,
      input.source_url ?? null,
      input.source_name?.slice(0, 300) ?? null,
      input.source_image ?? null,
      input.created_by,
      input.closes_at ?? null,
      now(),
    )
    .run();
  return Number(res.meta.last_row_id);
}

export interface PickResult {
  ok: boolean;
  error?: string;
}

/** Sæt en indsats – eller udfordr den anden side. Pengerne låses i kassen. */
export async function placePick(
  db: D1Database,
  bet: BetRow,
  player: Player,
  input: { side: Side; stake: number; statement?: string | null },
): Promise<PickResult> {
  if (bet.status !== "open") return { ok: false, error: "Det væddemål er lukket." };
  if (bet.closes_at && new Date(bet.closes_at).getTime() < Date.now()) {
    return { ok: false, error: "Der er lukket for indsats på det væddemål." };
  }
  const stake = Math.floor(input.stake);
  if (!Number.isFinite(stake) || stake < 1) return { ok: false, error: "Din indsats skal være på mindst 1 kr." };
  if (stake > player.balance) return { ok: false, error: `Du har kun ${player.balance} kr. tilbage.` };

  const existing = await db.prepare('SELECT * FROM picks WHERE bet_id = ? AND sub = ?').bind(bet.id, player.sub).first<PickRow>();
  if (existing) return { ok: false, error: "Du har allerede taget stilling til det her væddemål." };

  const res = await db.batch([
    db.prepare('UPDATE players SET balance = balance - ? WHERE sub = ? AND balance >= ?').bind(stake, player.sub, stake),
    db
      .prepare(`INSERT INTO picks (bet_id, sub, side, statement, stake, status, created_at) VALUES (?, ?, ?, ?, ?, 'held', ?)`)
      .bind(bet.id, player.sub, input.side, input.statement?.slice(0, 500) ?? null, stake, now()),
  ]);
  if (!res[0].meta.changes) return { ok: false, error: "Du har ikke penge nok til den indsats." };
  return { ok: true };
}

export interface SettleResult {
  ok: boolean;
  error?: string;
  pot?: number;
  winners?: number;
  refunded?: boolean;
}

/**
 * Afgør et væddemål. Vinderne deler puljen; taberne går tomhændede.
 * Mangler der modsat side (ingen udfordrer), får alle deres penge retur.
 */
export async function settleBet(
  db: D1Database,
  betId: number,
  outcome: Side | "void",
  resolver: string,
  note: string | null,
): Promise<SettleResult> {
  const lock = await db
    .prepare(
      "UPDATE bets SET status = 'resolved', outcome = ?, resolution_note = ?, resolved_by = ?, resolved_at = ? WHERE id = ? AND status = 'open'",
    )
    .bind(outcome === "void" ? null : outcome, note?.slice(0, 1000) ?? null, resolver, now(), betId)
    .run();
  if (!lock.meta.changes) return { ok: false, error: "Det væddemål er allerede afgjort." };

  const picks = (await db.prepare('SELECT * FROM picks WHERE bet_id = ?').bind(betId).all<PickRow>()).results;
  const totals = sideTotals(picks);
  const sum = pot(picks);

  // Annulleret – eller uden modsat side: ingen vinder, ingen taber, pengene retur.
  const refund = outcome === "void" || totals.ja.count === 0 || totals.nej.count === 0;
  if (refund) {
    const stmts = picks.map((p) => db.prepare('UPDATE players SET balance = balance + ? WHERE sub = ?').bind(p.stake, p.sub));
    stmts.push(...picks.map((p) => db.prepare("UPDATE picks SET status = 'refunded' WHERE id = ?").bind(p.id)));
    if (stmts.length) await db.batch(stmts);
    return { ok: true, pot: sum, winners: 0, refunded: true };
  }

  const winners = picks.filter((p) => p.side === outcome);
  const totalWin = winners.reduce((a, p) => a + p.stake, 0);
  const shares = new Map<number, number>();
  let given = 0;
  const ordered = [...winners].sort((a, b) => b.stake - a.stake);
  for (const p of ordered) {
    const share = Math.floor((sum * p.stake) / totalWin);
    shares.set(p.id, share);
    given += share;
  }
  // Rundetalsrester går til de største indsatser, så hele puljen bliver delt ud.
  let rest = sum - given;
  for (const p of ordered) {
    if (rest <= 0) break;
    shares.set(p.id, (shares.get(p.id) ?? 0) + 1);
    rest -= 1;
  }

  const stmts = [];
  for (const p of picks) {
    if (p.side === outcome) {
      const share = shares.get(p.id) ?? p.stake;
      stmts.push(db.prepare('UPDATE players SET balance = balance + ? WHERE sub = ?').bind(share, p.sub));
      stmts.push(db.prepare("UPDATE picks SET status = 'won' WHERE id = ?").bind(p.id));
    } else {
      stmts.push(db.prepare("UPDATE picks SET status = 'lost' WHERE id = ?").bind(p.id));
    }
  }
  await db.batch(stmts);
  return { ok: true, pot: sum, winners: winners.length, refunded: false };
}

/** Vinderen skriver "Jeg fik ret fordi …". */
export async function addWinNote(db: D1Database, betId: number, sub: string, note: string): Promise<PickResult> {
  const text = note.trim().slice(0, 600);
  if (text.length < 3) return { ok: false, error: "Skriv lige hvorfor du fik ret." };
  const res = await db
    .prepare("UPDATE picks SET win_note = ? WHERE bet_id = ? AND sub = ? AND status = 'won'")
    .bind(text, betId, sub)
    .run();
  if (!res.meta.changes) return { ok: false, error: "Det er kun vinderne, der kan skrive det." };
  return { ok: true };
}

export async function getBet(db: D1Database, id: number): Promise<BetDetail | null> {
  const bet = await db
    .prepare('SELECT b.*, p.name AS creator_name FROM bets b LEFT JOIN players p ON p.sub = b.created_by WHERE b.id = ?')
    .bind(id)
    .first<BetWithCreator>();
  if (!bet) return null;
  const picks = (
    await db
      .prepare('SELECT k.*, p.name FROM picks k LEFT JOIN players p ON p.sub = k.sub WHERE k.bet_id = ? ORDER BY k.stake DESC')
      .bind(id)
      .all<PickWithPlayer>()
  ).results;
  return { bet, picks, ...sideTotals(picks) };
}

export async function betsForNews(db: D1Database, newsId: number): Promise<BetWithCreator[]> {
  const res = await db
    .prepare('SELECT b.*, p.name AS creator_name FROM bets b LEFT JOIN players p ON p.sub = b.created_by WHERE b.news_id = ? ORDER BY b.created_at DESC')
    .bind(newsId)
    .all<BetWithCreator>();
  return res.results;
}

export interface ListOptions {
  status?: "open" | "resolved" | "all";
  sub?: string;
  kind?: string;
  limit?: number;
}

export async function listBets(db: D1Database, opts: ListOptions = {}): Promise<{ bets: BetDetail[] }> {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (opts.status && opts.status !== "all") {
    where.push("b.status = ?");
    params.push(opts.status);
  }
  if (opts.sub) {
    where.push("EXISTS (SELECT 1 FROM picks k WHERE k.bet_id = b.id AND k.sub = ?)");
    params.push(opts.sub);
  }
  if (opts.kind) {
    where.push("b.kind = ?");
    params.push(opts.kind);
  }
  const sql =
    `SELECT b.*, p.name AS creator_name FROM bets b LEFT JOIN players p ON p.sub = b.created_by` +
    (where.length ? ` WHERE ${where.join(" AND ")}` : "") +
    ` ORDER BY CASE b.status WHEN 'open' THEN 0 ELSE 1 END, b.created_at DESC LIMIT ?`;
  params.push(opts.limit ?? 60);
  const bets = (await db.prepare(sql).bind(...params).all<BetWithCreator>()).results;
  return { bets: await attachPicks(db, bets) };
}

export async function attachPicks(db: D1Database, bets: BetWithCreator[]): Promise<BetDetail[]> {
  if (!bets.length) return [];
  const ids = bets.map((b) => b.id);
  const placeholders = ids.map(() => "?").join(",");
  const picks = (
    await db
      .prepare(`SELECT k.*, p.name FROM picks k LEFT JOIN players p ON p.sub = k.sub WHERE k.bet_id IN (${placeholders}) ORDER BY k.stake DESC`)
      .bind(...ids)
      .all<PickWithPlayer>()
  ).results;
  return bets.map((bet) => {
    const mine = picks.filter((p) => p.bet_id === bet.id);
    return { bet, picks: mine, ...sideTotals(mine) };
  });
}

export interface Standing {
  sub: string;
  name: string;
  balance: number;
  is_admin: number;
  wins: number;
  losses: number;
  open: number;
}

export async function standings(db: D1Database, limit = 25): Promise<Standing[]> {
  const res = await db
    .prepare(
      `SELECT p.sub, p.name, p.balance, p.is_admin,
        (SELECT COUNT(*) FROM picks k WHERE k.sub = p.sub AND k.status = 'won') AS wins,
        (SELECT COUNT(*) FROM picks k WHERE k.sub = p.sub AND k.status = 'lost') AS losses,
        (SELECT COUNT(*) FROM picks k WHERE k.sub = p.sub AND k.status = 'held') AS open
       FROM players p ORDER BY p.balance DESC, p.created_at ASC LIMIT ?`,
    )
    .bind(limit)
    .all<Standing>();
  return res.results;
}

export async function stats(db: D1Database) {
  const row = await db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM bets) AS bets,
        (SELECT COUNT(*) FROM bets WHERE status = 'open') AS open,
        (SELECT COALESCE(SUM(stake),0) FROM picks WHERE status = 'held') AS inKassen,
        (SELECT COUNT(*) FROM players) AS players,
        (SELECT COUNT(*) FROM picks) AS picks,
        (SELECT COUNT(*) FROM news) AS news`,
    )
    .first<{ bets: number; open: number; inKassen: number; players: number; picks: number; news: number }>();
  return row ?? { bets: 0, open: 0, inKassen: 0, players: 0, picks: 0, news: 0 };
}
