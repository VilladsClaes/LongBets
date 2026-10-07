import type { BetDetail } from "../bets";
import type { NewsRow, Player } from "../db";
import { dato, krBelob, tidsiden, uddrag } from "../fmt";
import { SOURCES } from "../news";
import { Sticker } from "./layout";

export function sourceName(id: string): string {
  return SOURCES.find((s) => s.id === id)?.name ?? id;
}

export function sourceColor(id: string): string {
  return SOURCES.find((s) => s.id === id)?.color ?? "#2b2d42";
}

export function SidesBar({ ja, nej }: { ja: { stake: number; count: number }; nej: { stake: number; count: number } }) {
  const total = Math.max(1, ja.stake + nej.stake);
  const jp = Math.round((ja.stake / total) * 100);
  const np = 100 - jp;
  return (
    <div class="sides">
      <div class="side side-ja" style={`width:${jp}%`} title={`Ja: ${krBelob(ja.stake)}`}>
        <span class="side-label">Ja</span>
        <span class="side-amount">{krBelob(ja.stake)}</span>
      </div>
      <div class="side side-nej" style={`width:${np}%`} title={`Nej: ${krBelob(nej.stake)}`}>
        <span class="side-label">Nej</span>
        <span class="side-amount">{krBelob(nej.stake)}</span>
      </div>
    </div>
  );
}

function StatusSticker({ d }: { d: BetDetail }) {
  if (d.bet.status === "resolved") {
    if (d.ja.count === 0 || d.nej.count === 0) return <Sticker tone="white" text="🤸 Ingen modstander" />;
    const tone = d.bet.outcome === "ja" ? "mint" : "grape";
    return <Sticker tone={tone} text={`Udfald: ${d.bet.outcome === "ja" ? "JA ✅" : "NEJ ❌"}`} />;
  }
  const lukket = d.bet.closes_at && new Date(d.bet.closes_at).getTime() < Date.now();
  return <Sticker tone={lukket ? "white" : "sun"} text={lukket ? "⏳ Venter på afgørelse" : "🔥 Åbent"} />;
}

const KIND: Record<string, { label: string; tone: "coral" | "ocean" | "mint" }> = {
  news: { label: "📰 nyhed", tone: "coral" },
  link: { label: "🔗 link", tone: "ocean" },
  custom: { label: "✍️ skrevet selv", tone: "mint" },
};

export function BetCard({ d, compact = false }: { d: BetDetail; compact?: boolean }) {
  const kind = KIND[d.bet.kind] ?? KIND.custom;
  const players = d.picks.length;
  const pulje = d.picks.reduce((a, p) => a + p.stake, 0);
  const note = d.picks.find((p) => p.win_note)?.win_note;
  return (
    <article class={`card bet-card reveal${d.bet.status === "resolved" ? " is-resolved" : ""}`}>
      <div class="bet-stickers">
        <StatusSticker d={d} />
        <Sticker tone={kind.tone} text={kind.label} />
      </div>
      <h3 class="bet-title">
        <a href={`/vaeddemaal/${d.bet.id}`}>{d.bet.title}</a>
      </h3>
      {d.bet.source_url && (
        <p class="bet-source">
          <a href={d.bet.source_url} target="_blank" rel="noopener noreferrer">
            🔗 {d.bet.source_name ?? new URL(d.bet.source_url).hostname.replace("www.", "")} ↗
          </a>
        </p>
      )}
      {!compact && d.bet.detail && <p class="bet-detail">{d.bet.detail}</p>}
      <SidesBar ja={d.ja} nej={d.nej} />
      <p class="bet-meta">
        <span>👥 {players === 0 ? "ingen endnu" : `${players} spiller${players === 1 ? "" : "e"}`}</span>
        <span>💰 {krBelob(pulje)} i kassen</span>
        {d.bet.status === "open" && d.bet.closes_at && <span>⏰ lukker {dato(d.bet.closes_at)}</span>}
        {d.bet.status === "resolved" && <span>🏁 afgjort {dato(d.bet.resolved_at)}</span>}
      </p>
      {d.bet.resolution_note && <p class="resolution-note">🧑‍⚖️ {d.bet.resolution_note}</p>}
      {note && (
        <blockquote class="win-note">
          “Jeg fik ret fordi …” <strong>{note}</strong>
        </blockquote>
      )}
      <div class="bet-actions">
        <a class="btn btn-sun btn-small" href={`/vaeddemaal/${d.bet.id}`}>
          {d.bet.status === "open" ? "Jeg tror på … 🎯" : "Se resultatet 👀"}
        </a>
        {d.bet.status === "resolved" && (
          <a class="btn btn-white btn-small" href={`/vaeddemaal/${d.bet.id}#notat`}>
            Skriv hvorfor du fik ret ✍️
          </a>
        )}
      </div>
    </article>
  );
}

export function NewsCard({ n, bets = 0 }: { n: NewsRow; bets?: number }) {
  return (
    <article class="card news-card reveal">
      <div class="news-top">
        <span class="source-badge" style={`background:${sourceColor(n.source)}`}>
          {sourceName(n.source)}
        </span>
        <span class="news-time">{tidsiden(n.published_at ?? n.fetched_at)}</span>
      </div>
      <h3 class="news-title">{n.title}</h3>
      {n.summary && <p class="news-summary">{uddrag(n.summary, 180)}</p>}
      <div class="news-actions">
        <a class="btn btn-coral btn-small" href={`/nyt?nyhed=${n.id}`}>
          Vædder på denne 🎲
        </a>
        <a class="btn btn-white btn-small" href={n.url} target="_blank" rel="noopener noreferrer">
          Læs historien ↗
        </a>
      </div>
      {bets > 0 && (
        <p class="news-bets">
          💬 {bets} væddemål allerede i gang om den her historie
        </p>
      )}
    </article>
  );
}

export function SignInCard({ returnTo, text }: { returnTo: string; text: string }) {
  return (
    <div class="card signin-card">
      <p class="signin-emoji" aria-hidden="true">
        🔐
      </p>
      <h3>Du skal lige logge ind</h3>
      <p>{text}</p>
      <a class="btn btn-coral" href={`/auth/freebuff/signin?returnTo=${encodeURIComponent(returnTo)}`}>
        Log ind med Freebuff
      </a>
    </div>
  );
}

export function Empty({ emoji, title, text, action }: { emoji: string; title: string; text: string; action?: { href: string; label: string } }) {
  return (
    <div class="card empty-state">
      <p class="empty-emoji" aria-hidden="true">
        {emoji}
      </p>
      <h3>{title}</h3>
      <p>{text}</p>
      {action && (
        <a class="btn btn-sun" href={action.href}>
          {action.label}
        </a>
      )}
    </div>
  );
}

export function PlayerRow({ p, i }: { p: { sub: string; name: string; balance: number; is_admin: number; wins?: number; losses?: number; open?: number }; i: number }) {
  const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
  return (
    <tr>
      <td class="rank">{medal}</td>
      <td>
        <a href={`/spiller/${encodeURIComponent(p.sub)}`} class="player-link">
          {p.name}
          {p.is_admin === 1 && <span class="admin-dot" title="Admin">🧑‍⚖️</span>}
        </a>
      </td>
      {p.wins !== undefined && (
        <td class="num">
          {p.wins} ✅ / {p.losses} ❌
        </td>
      )}
      <td class="num strong">{krBelob(p.balance)}</td>
    </tr>
  );
}

export function PickRow({ p, bet, user }: { p: { sub: string; name: string | null; side: string; statement: string | null; stake: number; status: string; win_note: string | null; created_at: string }; bet: BetDetail["bet"]; user: { sub: string } | null }) {
  const isWinner = bet.status === "resolved" && bet.outcome === p.side && p.status === "won";
  const isMe = user?.sub === p.sub;
  return (
    <li class={`pick-row${isWinner ? " is-winner" : ""}${isMe ? " is-me" : ""}`}>
      <span class={`pick-side pick-${p.side}`}>{p.side === "ja" ? "JA ✅" : "NEJ ❌"}</span>
      <div class="pick-body">
        <p class="pick-who">
          <a href={`/spiller/${encodeURIComponent(p.sub)}`}>{p.name ?? "ukendt"}</a>
          {isMe && <span class="you-badge">dig</span>}
          <span class="pick-stake">{krBelob(p.stake)}</span>
          {p.status === "won" && <span class="pick-status won">vandt 🎉</span>}
          {p.status === "lost" && <span class="pick-status lost">tabte</span>}
          {p.status === "refunded" && <span class="pick-status refunded">pengene retur 🔄</span>}
        </p>
        {p.statement && <p class="pick-statement">“{p.statement}”</p>}
        {p.win_note && (
          <blockquote class="win-note">
            Jeg fik ret fordi … <strong>{p.win_note}</strong>
          </blockquote>
        )}
      </div>
    </li>
  );
}
