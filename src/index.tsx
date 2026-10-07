import { createFreebuffAuth, isSameOriginRequest } from "@freebuff/auth";
import type { FreebuffAuth } from "@freebuff/auth";
import { Hono } from "hono";
import type { Context } from "hono";

import { addWinNote, createBet, getBet, listBets, placePick, settleBet, stats, standings, type Side } from "./bets";
import {
  ensurePlayer,
  ensureSchema,
  getPlayer,
  grantDailyBonus,
  now,
  type Env,
  type Player,
} from "./db";
import { kr, krBelob } from "./fmt";
import { fetchLinkMeta } from "./meta";
import { getFeedState, getNews, newsAreStale, SOURCES, syncNews } from "./news";
import { toViewUser, type ViewUser } from "./views/layout";
import {
  AdminPage,
  CreatePage,
  ErrorPage,
  HowToPage,
  NotFoundPage,
  PlayerPage,
  PlayersPage,
} from "./views/pages2";
import { BetPage, BetsPage, HomePage, NewsPage } from "./views/pages";

type AppEnv = Env;
type AppBindings = { Bindings: AppEnv };
type AppCtx = Context<AppBindings>;
type MaybeResponse = Response | Promise<Response> | null;

let authInstance: FreebuffAuth | undefined;
function getAuth(env: Env): FreebuffAuth | null {
  if (!env.FREEBUFF_CLIENT_ID) return null;
  const baseUrl = env.APP_ORIGIN ?? "";
  // Kun loopback må bruge usikker http – aldrig i drift.
  const allowInsecureLocalhost = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(baseUrl);
  authInstance ??= createFreebuffAuth({
    clientId: env.FREEBUFF_CLIENT_ID,
    issuer: env.FREEBUFF_ISSUER,
    baseUrl,
    allowInsecureLocalhost,
  });
  return authInstance;
}

function isLoopback(request: Request): boolean {
  const host = request.headers.get("host") ?? "";
  return /^(localhost|127\.0\.0\.1|\[::1\])(:|$)/i.test(host);
}

interface Ident {
  sub: string;
  name: string;
}

/** Hvem er vi? Freebuff-session – og i lokal udvikling evt. x-dev-user. */
async function identify(env: Env, request: Request): Promise<Ident | null> {
  const a = getAuth(env);
  if (a) {
    const u = await a.getUser(request);
    if (u) return { sub: u.sub, name: (u.name ?? u.email ?? "Spiller").slice(0, 60) };
  }
  if (env.LB_DEV === "1" && isLoopback(request)) {
    const sub = request.headers.get("x-dev-user");
    if (sub) {
      const rawName = request.headers.get("x-dev-name");
      let name = sub;
      if (rawName) {
        try {
          name = decodeURIComponent(rawName);
        } catch {
          name = rawName;
        }
      }
      return { sub, name: name.slice(0, 60) };
    }
  }
  return null;
}

interface PageCtx {
  ident: Ident | null;
  player: Player | null;
  bonus: number;
  user: ViewUser | null;
}

async function loadPageCtx(env: Env, request: Request): Promise<PageCtx> {
  const ident = await identify(env, request);
  if (!ident) return { ident: null, player: null, bonus: 0, user: null };
  const player = await ensurePlayer(env.DB, ident.sub, ident.name);
  const { gained, player: fresh } = await grantDailyBonus(env.DB, player);
  return { ident, player: fresh, bonus: gained, user: toViewUser(fresh) };
}

/** Fremmede sider må ikke POSTe til os. Vi tjekker mod egen host + konfigureret ophav. */
function sameOrigin(c: AppCtx): boolean {
  const request = c.req.raw;
  const origins: string[] = [];
  const host = request.headers.get("host");
  // Vi tillader begge programmer for samme vært, så en proxy med andet skema ikke låser os ude.
  if (host) {
    origins.push(`http://${host}`, `https://${host}`);
    const fwd = request.headers.get("x-forwarded-proto");
    if (fwd) origins.push(`${fwd.split(",")[0].trim()}://${host}`);
  }
  if (c.env.APP_ORIGIN) origins.push(c.env.APP_ORIGIN);
  return origins.some((o) => {
    try {
      return isSameOriginRequest(request, o);
    } catch {
      return false;
    }
  });
}

function redirectWith(c: AppCtx, path: string, params: Record<string, string> = {}): Response {
  const qs = new URLSearchParams(params).toString();
  return c.redirect(qs ? `${path}?${qs}` : path, 303);
}

const app = new Hono<AppBindings>();

app.use("*", async (c, next) => {
  await ensureSchema(c.env.DB);
  await next();
  // JSX-rendrer uden doctype – vi lægger det på, så browseren ikke går i quirks mode.
  const res = c.res;
  const type = res.headers.get("content-type") ?? "";
  if (type.includes("text/html")) {
    const body = await res.text();
    if (!/^\s*<!doctype/i.test(body)) {
      c.res = new Response("<!DOCTYPE html>" + body, res);
    }
  }
});

/** Offentlige sider virker også logget ud; de personlige redirects til login. */
function requirePageUser(c: AppCtx, ctx: PageCtx, returnTo: string): MaybeResponse {
  if (ctx.user) return null;
  const a = getAuth(c.env);
  if (a) return c.redirect(`/auth/freebuff/signin?returnTo=${encodeURIComponent(returnTo)}`, 303);
  return c.html(<ErrorPage user={null} path={returnTo} message="Der er ingen login-konfiguration endnu." />, 500);
}

function requirePostUser(c: AppCtx, ctx: PageCtx, returnTo: string): MaybeResponse {
  if (!sameOrigin(c)) return c.text("Fremmed oprindelse", 403);
  if (ctx.user) return null;
  const a = getAuth(c.env);
  if (a) return c.redirect(`/auth/freebuff/signin?returnTo=${encodeURIComponent(returnTo)}`, 303);
  return c.json({ error: "Ikke logget ind" }, 401);
}

// ---------------------------------------------------------------- forside

app.get("/", async (c) => {
  const ctx = await loadPageCtx(c.env, c.req.raw);
  if (await newsAreStale(c.env.DB)) await syncNews(c.env);
  const [s, top, news, board] = await Promise.all([
    stats(c.env.DB),
    listBets(c.env.DB, { status: "open", limit: 6 }),
    getNews(c.env.DB, 6),
    standings(c.env.DB, 6),
  ]);
  return c.html(<HomePage {...ctx} path="/" stats={s} topBets={top.bets} news={news} standings={board} />);
});

// ---------------------------------------------------------------- nyheder

app.get("/nyheder", async (c) => {
  const ctx = await loadPageCtx(c.env, c.req.raw);
  const filter = c.req.query("medie") ?? "";
  const refreshing = await newsAreStale(c.env.DB);
  if (refreshing) await syncNews(c.env, filter || undefined);

  const news = await getNews(c.env.DB, 60, filter || undefined);
  const counts: Record<number, number> = {};
  if (news.length) {
    const ids = news.map((n) => n.id);
    const rows = await c.env.DB
      .prepare(`SELECT news_id, COUNT(*) AS n FROM bets WHERE news_id IN (${ids.map(() => "?").join(",")}) GROUP BY news_id`)
      .bind(...ids)
      .all<{ news_id: number; n: number }>();
    for (const r of rows.results) counts[r.news_id] = r.n;
  }
  const state = await getFeedState(c.env.DB);
  const sources = SOURCES.map((s) => {
    const st = state.find((x) => x.source === s.id);
    return { id: s.id, name: s.name, color: s.color, ok: st ? st.ok === 1 : true, count: st?.count ?? 0, error: st?.error ?? undefined };
  });
  const last = state.length ? state.map((s) => s.last_fetch).sort().slice(-1)[0] : null;
  return c.html(<NewsPage {...ctx} path="/nyheder" news={news} counts={counts} sources={sources} lastFetch={last} refreshing={false} filter={filter} />);
});

// ---------------------------------------------------------------- væddemål

app.get("/vaeddemaal", async (c) => {
  const ctx = await loadPageCtx(c.env, c.req.raw);
  const filter = c.req.query("filter") ?? "open";
  const mine = c.req.query("mine");
  const { bets } = await listBets(c.env.DB, {
    status: filter === "all" ? "all" : (filter as "open" | "resolved"),
    sub: mine && ctx.ident ? ctx.ident.sub : undefined,
    limit: 60,
  });
  return c.html(<BetsPage {...ctx} path="/vaeddemaal" bets={bets} filter={filter} />);
});

app.get("/vaeddemaal/:id", async (c) => {
  const ctx = await loadPageCtx(c.env, c.req.raw);
  const id = Number(c.req.param("id"));
  const d = Number.isFinite(id) ? await getBet(c.env.DB, id) : null;
  if (!d) return c.html(<NotFoundPage {...ctx} path={c.req.path} />, 404);
  return c.html(
    <BetPage
      {...ctx}
      path={`/vaeddemaal/${d.bet.id}`}
      d={d}
      error={c.req.query("fejl")}
      notice={c.req.query("besked")}
    />,
  );
});

app.post("/vaeddemaal/:id/pick", async (c) => {
  const ctx = await loadPageCtx(c.env, c.req.raw);
  const id = Number(c.req.param("id"));
  const back = `/vaeddemaal/${id}`;
  const denied = requirePostUser(c, ctx, back);
  if (denied) return denied;

  const body = await c.req.parseBody();
  const bet = await getBet(c.env.DB, id);
  if (!bet) return c.html(<NotFoundPage {...ctx} path={back} />, 404);

  const side = body.side === "nej" ? "nej" : "ja";
  const stake = Number(body.stake ?? 0);
  const statement = typeof body.statement === "string" ? body.statement.trim() : "";
  const res = await placePick(c.env.DB, bet.bet, ctx.player!, {
    side: side as Side,
    stake,
    statement: statement || null,
  });
  if (!res.ok) return redirectWith(c, back, { fejl: res.error ?? "Det gik ikke." });
  const total = bet.picks.reduce((a, p) => a + p.stake, 0) + stake;
  const duel = (side === "ja" ? bet.nej.count : bet.ja.count) > 0;
  return redirectWith(c, back, {
    besked: duel
      ? `Du udfordrer! Du står på ${side === "ja" ? "JA" : "NEJ"} med ${kr(stake)} – kassen er på ${kr(total)}.`
      : `Du står på ${side === "ja" ? "JA" : "NEJ"} med ${kr(stake)}. Nu venter vi på en modsat side.`,
  });
});

app.post("/vaeddemaal/:id/notat", async (c) => {
  const ctx = await loadPageCtx(c.env, c.req.raw);
  const id = Number(c.req.param("id"));
  const back = `/vaeddemaal/${id}#notat`;
  const denied = requirePostUser(c, ctx, `/vaeddemaal/${id}`);
  if (denied) return denied;

  const body = await c.req.parseBody();
  const note = typeof body.win_note === "string" ? body.win_note.trim() : "";
  const res = await addWinNote(c.env.DB, id, ctx.ident!.sub, note);
  if (!res.ok) return redirectWith(c, `/vaeddemaal/${id}`, { fejl: res.error ?? "Det gik ikke." });
  return redirectWith(c, `/vaeddemaal/${id}`, { besked: "Tak – dit bevis hænger nu på væddemålet." });
});

// ---------------------------------------------------------------- opret

function questionSuggestions(title: string): string[] {
  const d = new Date();
  const inden = new Date(d.getTime() + 14 * 864e5);
  const maaned = ["januar", "februar", "marts", "april", "maj", "juni", "juli", "august", "september", "oktober", "november", "december"][inden.getMonth()];
  void title;
  return [
    `Sker der mere i den her sag inden ${inden.getDate()}. ${maaned}?`,
    `Er historien glemt om en uge?`,
    `Får den her historie konsekvenser for nogen bestemt?`,
  ];
}

app.get("/nyt", async (c) => {
  const ctx = await loadPageCtx(c.env, c.req.raw);
  const newsId = Number(c.req.query("nyhed") ?? 0);
  const news = Number.isFinite(newsId) && newsId > 0 ? await c.env.DB.prepare("SELECT * FROM news WHERE id = ?").bind(newsId).first() : null;
  const url = c.req.query("link");
  const meta = url ? await fetchLinkMeta(url) : null;
  return c.html(
    <CreatePage
      {...ctx}
      path="/nyt"
      news={news as never}
      suggested={questionSuggestions((news as { title?: string } | null)?.title ?? "")}
      meta={meta}
      error={c.req.query("fejl")}
    />,
  );
});

app.post("/nyt", async (c) => {
  const ctx = await loadPageCtx(c.env, c.req.raw);
  const denied = requirePostUser(c, ctx, "/nyt");
  if (denied) return denied;

  const body = await c.req.parseBody();
  const title = (typeof body.title === "string" ? body.title : "").trim().slice(0, 300);
  if (title.length < 8) return redirectWith(c, "/nyt", { fejl: "Spørgsmålet skal være lidt længere – gerne som ja/nej." });

  const detail = typeof body.detail === "string" ? body.detail.trim().slice(0, 1000) : "";
  const statement = typeof body.statement === "string" ? body.statement.trim().slice(0, 500) : "";
  const side = body.side === "nej" ? "nej" : "ja";
  const stake = Math.max(0, Math.floor(Number(body.stake ?? 0) || 0));
  const sourceUrl = typeof body.source_url === "string" ? body.source_url.trim().slice(0, 1000) : "";
  const sourceName = typeof body.source_name === "string" ? body.source_name.trim().slice(0, 300) : "";
  const sourceImage = typeof body.source_image === "string" ? body.source_image.trim().slice(0, 1000) : "";
  const newsId = Number(body.news_id ?? 0);
  const kindRaw = body.kind;
  const kind = kindRaw === "news" && newsId > 0 ? "news" : sourceUrl ? "link" : "custom";

  let id: number;
  try {
    id = await createBet(c.env.DB, {
      created_by: ctx.ident!.sub,
      title,
      detail: detail || null,
      kind: kind as "news" | "link" | "custom",
      news_id: kind === "news" ? newsId : null,
      source_url: sourceUrl || null,
      source_name: sourceName || null,
      source_image: sourceImage || null,
      closes_at: new Date(Date.now() + 14 * 864e5).toISOString(),
      pick: { side: side as Side, stake, statement: statement || null },
    });
  } catch (err) {
    return redirectWith(c, "/nyt", { fejl: err instanceof Error ? err.message : "Det gik galt." });
  }
  return redirectWith(c, `/vaeddemaal/${id}`, {
    besked: stake > 0 ? `Væddemålet er oprettet med ${krBelob(stake)} i kassen. Find en der er uenig!` : "Væddemålet er oprettet – find en der er uenig!",
  });
});

// ---------------------------------------------------------------- spillere

app.get("/spillere", async (c) => {
  const ctx = await loadPageCtx(c.env, c.req.raw);
  const board = await standings(c.env.DB, 50);
  return c.html(<PlayersPage {...ctx} path="/spillere" standings={board} />);
});

app.get("/spiller/:sub", async (c) => {
  const ctx = await loadPageCtx(c.env, c.req.raw);
  const sub = c.req.param("sub");
  const player = await getPlayer(c.env.DB, sub);
  if (!player) return c.html(<NotFoundPage {...ctx} path={c.req.path} />, 404);
  const { bets } = await listBets(c.env.DB, { sub, limit: 60 });
  const board = await standings(c.env.DB, 500);
  const me = board.find((b) => b.sub === sub);
  return c.html(
    <PlayerPage {...ctx} path={`/spiller/${sub}`} player={player} wins={me?.wins ?? 0} losses={me?.losses ?? 0} bets={bets} />,
  );
});

app.get("/saadan", async (c) => {
  const ctx = await loadPageCtx(c.env, c.req.raw);
  return c.html(<HowToPage {...ctx} path="/saadan" />);
});

// ---------------------------------------------------------------- admin

app.get("/admin", async (c) => {
  const ctx = await loadPageCtx(c.env, c.req.raw);
  const [queue, feeds, s] = await Promise.all([
    listBets(c.env.DB, { status: "open", limit: 40 }),
    getFeedState(c.env.DB),
    stats(c.env.DB),
  ]);
  const withPicks = queue.bets.filter((b) => b.picks.length > 0);
  const isAdmin = ctx.player?.is_admin === 1;
  return c.html(
    <AdminPage
      {...ctx}
      path="/admin"
      isAdmin={isAdmin}
      queue={withPicks}
      feeds={feeds}
      stats={s}
      notice={c.req.query("besked")}
      error={c.req.query("fejl")}
    />,
  );
});

app.post("/admin/hent", async (c) => {
  const ctx = await loadPageCtx(c.env, c.req.raw);
  const denied = requirePostUser(c, ctx, "/admin");
  if (denied) return denied;
  if (ctx.player!.is_admin !== 1) return redirectWith(c, "/admin", { fejl: "Kun admin må hente nyheder." });
  const res = await syncNews(c.env);
  const ok = res.sources.filter((s) => s.ok).length;
  return redirectWith(c, "/admin", { besked: `Hentede ${res.fetched} artikler fra ${ok}/${res.sources.length} medier.` });
});

app.post("/admin/afgoer/:id", async (c) => {
  const ctx = await loadPageCtx(c.env, c.req.raw);
  const id = Number(c.req.param("id"));
  const denied = requirePostUser(c, ctx, "/admin");
  if (denied) return denied;
  if (ctx.player!.is_admin !== 1) return redirectWith(c, "/admin", { fejl: "Kun admin må afgøre væddemål." });

  const body = await c.req.parseBody();
  const outcome = body.outcome;
  if (outcome !== "ja" && outcome !== "nej" && outcome !== "void") {
    return redirectWith(c, "/admin", { fejl: "Du skal vælge et udfald." });
  }
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) : "";
  const res = await settleBet(c.env.DB, id, outcome as Side | "void", ctx.ident!.sub, note || null);
  if (!res.ok) return redirectWith(c, "/admin", { fejl: res.error ?? "Det gik ikke." });
  const msg = res.refunded
    ? outcome === "void"
      ? `Væddemål #${id} er annulleret – alle fik deres indsats retur.`
      : `Afgjort ${outcome.toUpperCase()} – men der var ingen modsat side, så alle fik pengene retur.`
    : `Afgjort: ${outcome.toUpperCase()} vandt ${res.winners} spiller(e) og delte ${krBelob(res.pot ?? 0)}.`;
  return redirectWith(c, "/admin", { besked: msg });
});

// ---------------------------------------------------------------- API

app.get("/api/link-meta", async (c) => {
  const ctx = await loadPageCtx(c.env, c.req.raw);
  if (!ctx.ident) return c.json({ error: "Log ind først" }, 401);
  if (!sameOrigin(c)) return c.json({ error: "Fremmed oprindelse" }, 403);
  const url = c.req.query("url") ?? "";
  const meta = await fetchLinkMeta(url);
  return c.json(meta, { headers: { "cache-control": "no-store" } });
});

app.get("/api/sundhed", (c) => c.json({ ok: true, tid: now() }));

// ---------------------------------------------------------------- 404

app.notFound(async (c) => {
  const ctx = await loadPageCtx(c.env, c.req.raw);
  if (c.req.method === "GET") {
    const asset = await c.env.ASSETS.fetch(c.req.raw);
    if (asset.status !== 404) return asset;
    return c.html(<NotFoundPage {...ctx} path={c.req.path} />, 404);
  }
  return c.html(<NotFoundPage {...ctx} path={c.req.path} />, 404);
});

app.onError((err, c) => {
  console.error("LongBets-fejl:", err.message);
  return c.html(
    <ErrorPage user={null} path={c.req.path} message="Noget gik galt på væddekontoret. Prøv igen om et øjeblik." />,
    500,
  );
});

// ---------------------------------------------------------------- wrap

type Fetcher = (request: Request, env: AppEnv) => Promise<Response>;
let handler: Fetcher | undefined;

function setup(env: AppEnv): Fetcher {
  if (handler) return handler;
  const base: Fetcher = async (request, e) => await app.fetch(request, e);
  const a = getAuth(env);
  handler = a ? a.wrap(base) : base;
  return handler;
}

export default {
  fetch(request: Request, env: AppEnv): Promise<Response> {
    return setup(env)(request, env);
  },
};
