import type { Env, NewsRow } from "./db";
import { now } from "./db";

export interface NewsSource {
  id: string;
  name: string;
  color: string;
  kind: "rss" | "sitemap" | "html";
  url: string;
}

/** De danske medier vi henter nyheder fra. Alt kan udvides her. */
export const SOURCES: NewsSource[] = [
  { id: "dr", name: "DR", color: "#e01e2f", kind: "html", url: "https://www.dr.dk/nyheder" },
  { id: "politiken", name: "Politiken", color: "#c8102e", kind: "sitemap", url: "https://politiken.dk/sitemaps/latest.xml" },
  { id: "berlingske", name: "Berlingske", color: "#0a2f5a", kind: "sitemap", url: "https://www.berlingske.dk/news-sitemap.xml" },
  { id: "bt", name: "BT", color: "#0055a5", kind: "sitemap", url: "https://bt.dk/news-sitemap.xml" },
  { id: "jp", name: "Jyllands-Posten", color: "#1a1a1a", kind: "rss", url: "https://feeds.jp.dk/jp/topnyheder" },
  { id: "information", name: "Information", color: "#e67e22", kind: "rss", url: "https://www.information.dk/feed" },
  { id: "altinget", name: "Altinget", color: "#6b3fa0", kind: "rss", url: "https://www.altinget.dk/rss" },
];

const UA = "Mozilla/5.0 (compatible; LongBets/1.0; +https://longbets)";
const FETCH_MS = 12000;

export interface RawNews {
  title: string;
  url: string;
  summary?: string;
  published?: string;
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'");
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function cdata(s: string): string {
  const m = s.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  return m ? m[1] : s;
}

function asText(s: string): string {
  return stripTags(cdata(s));
}

function firstTag(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? m[1].trim() : null;
}

function toIso(raw: string | null): string | undefined {
  if (!raw) return undefined;
  const cleaned = cdata(raw).trim();
  const d = new Date(cleaned);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

/** Klassisk RSS 2.0 / Atom. */
export function parseRss(xml: string): RawNews[] {
  const out: RawNews[] = [];
  const items = xml.match(/<(item|entry)[\s\S]*?<\/\1>/gi) ?? [];
  for (const item of items) {
    const title = firstTag(item, "title");
    const linkTag = firstTag(item, "link");
    let link = linkTag ? asText(linkTag) : "";
    if (!link) {
      const href = item.match(/<link[^>]*href="([^"]+)"/i);
      link = href ? decodeEntities(href[1]) : "";
    }
    if (!title || !link) continue;
    const desc = firstTag(item, "description") ?? firstTag(item, "summary") ?? firstTag(item, "content");
    const published =
      toIso(firstTag(item, "pubDate")) ??
      toIso(firstTag(item, "published")) ??
      toIso(firstTag(item, "updated")) ??
      toIso(firstTag(item, "dc:date"));
    out.push({ title: asText(title), url: link, summary: desc ? uddragFra(desc) : undefined, published });
    if (out.length >= 40) break;
  }
  return out;
}

function uddragFra(html: string, max = 220): string | undefined {
  const text = stripTags(cdata(html));
  if (!text) return undefined;
  return text.length > max ? text.slice(0, max).replace(/\s+\S*$/, "") + " …" : text;
}

/** Google-news-sitemap: <url><loc>…</loc><news:news><news:title>. */
export function parseNewsSitemap(xml: string): RawNews[] {
  const out: RawNews[] = [];
  const urls = xml.match(/<url>[\s\S]*?<\/url>/gi) ?? [];
  for (const block of urls) {
    const loc = firstTag(block, "loc");
    const title = firstTag(block, "news:title");
    if (!loc || !title) continue;
    out.push({
      title: asText(title),
      url: decodeEntities(loc.trim()),
      published: toIso(firstTag(block, "news:publication_date")),
    });
    if (out.length >= 40) break;
  }
  return out;
}

/** DR har ikke RSS – vi læser overskrifterne direkte af deres forside. */
export function parseDrHtml(html: string): RawNews[] {
  const out: RawNews[] = [];
  const re = /<a\b[^>]*href="(\/nyheder\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((m = re.exec(html)) !== null) {
    const href = m[1];
    if (seen.has(href)) continue;
    const text = stripTags(m[2]);
    if (text.length < 15 || text.length > 220) continue;
    if (/^(læs|se|læs mere|del|send)/i.test(text)) continue;
    seen.add(href);
    out.push({ title: text, url: "https://www.dr.dk" + href });
    if (out.length >= 30) break;
  }
  return out;
}

async function get(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
    signal: AbortSignal.timeout(FETCH_MS),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

export async function fetchSource(src: NewsSource): Promise<RawNews[]> {
  const body = await get(src.url);
  if (src.kind === "rss") return parseRss(body);
  if (src.kind === "sitemap") return parseNewsSitemap(body);
  return parseDrHtml(body);
}

export interface SyncResult {
  fetched: number;
  stored: number;
  sources: { id: string; name: string; ok: boolean; count: number; error?: string }[];
}

const STALE_MS = 10 * 60 * 1000;

export async function newsAreStale(db: D1Database): Promise<boolean> {
  const row = await db.prepare('SELECT MAX(last_fetch) AS last FROM feed_state').first<{ last: string | null }>();
  if (!row?.last) return true;
  return Date.now() - new Date(row.last).getTime() > STALE_MS;
}

/** Hent alle feeds og læg de nye historier i databasen. */
export async function syncNews(env: Env, only?: string): Promise<SyncResult> {
  const sources = only ? SOURCES.filter((s) => s.id === only) : SOURCES;
  const results = await Promise.all(
    sources.map(async (src) => {
      try {
        const items = await fetchSource(src);
        const stmts = items.map((it) =>
          env.DB.prepare(
            `INSERT INTO news (source, title, url, summary, image, published_at, fetched_at)
             VALUES (?, ?, ?, ?, NULL, ?, ?)
             ON CONFLICT(url) DO UPDATE SET title = excluded.title, summary = COALESCE(excluded.summary, news.summary),
               published_at = COALESCE(excluded.published_at, news.published_at), fetched_at = excluded.fetched_at`,
          ).bind(src.id, it.title.slice(0, 300), it.url, it.summary ?? null, it.published ?? null, now()),
        );
        if (stmts.length) await env.DB.batch(stmts);
        await env.DB.prepare(
          `INSERT INTO feed_state (source, last_fetch, ok, count, error) VALUES (?, ?, 1, ?, NULL)
           ON CONFLICT(source) DO UPDATE SET last_fetch = excluded.last_fetch, ok = 1, count = excluded.count, error = NULL`,
        ).bind(src.id, now(), items.length).run();
        return { id: src.id, name: src.name, ok: true, count: items.length };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await env.DB.prepare(
          `INSERT INTO feed_state (source, last_fetch, ok, count, error) VALUES (?, ?, 0, 0, ?)
           ON CONFLICT(source) DO UPDATE SET last_fetch = excluded.last_fetch, ok = 0, error = excluded.error`,
        ).bind(src.id, now(), msg.slice(0, 200)).run();
        return { id: src.id, name: src.name, ok: false, count: 0, error: msg };
      }
    }),
  );
  await env.DB.prepare('DELETE FROM news WHERE fetched_at < ?').bind(new Date(Date.now() - 7 * 864e5).toISOString()).run();
  return { fetched: results.reduce((a, r) => a + r.count, 0), stored: results.length, sources: results };
}

export async function getNews(db: D1Database, limit = 30, source?: string): Promise<NewsRow[]> {
  const q = source
    ? db.prepare('SELECT * FROM news WHERE source = ? ORDER BY COALESCE(published_at, fetched_at) DESC LIMIT ?').bind(source, limit)
    : db.prepare('SELECT * FROM news ORDER BY COALESCE(published_at, fetched_at) DESC LIMIT ?').bind(limit);
  const res = await q.all<NewsRow>();
  return res.results;
}

export async function getFeedState(db: D1Database) {
  const res = await db.prepare('SELECT * FROM feed_state').all<{ source: string; last_fetch: string; ok: number; count: number; error: string | null }>();
  return res.results;
}
