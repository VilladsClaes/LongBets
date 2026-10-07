import type { Child } from "hono/jsx";
import type { Player } from "../db";

export interface ViewUser {
  sub: string;
  name: string;
  balance: number;
  is_admin: number;
}

const NAV = [
  { href: "/", label: "Forside", emoji: "🎲" },
  { href: "/nyheder", label: "Nyheder", emoji: "📰" },
  { href: "/vaeddemaal", label: "Væddemål", emoji: "💸" },
  { href: "/saadan", label: "Sådan virker det", emoji: "🤔" },
  { href: "/spillere", label: "Spillere", emoji: "🏆" },
];

export function toViewUser(p: Player | null): ViewUser | null {
  if (!p) return null;
  return { sub: p.sub, name: p.name, balance: p.balance, is_admin: p.is_admin };
}

function Header({ user, bonus, path }: { user: ViewUser | null; bonus: number; path: string }) {
  return (
    <header class="site-header">
      <div class="wrap header-inner">
        <a href="/" class="logo" aria-label="LongBets – forside">
          <span class="logo-emoji" aria-hidden="true">🎲</span>
          <span class="logo-text">
            Long<span class="logo-accent">Bets</span>
          </span>
        </a>

        <nav class="main-nav" aria-label="Hovedmenu">
          {NAV.map((n) => {
            const active = path === n.href || (n.href !== "/" && path.startsWith(n.href));
            return (
              <a href={n.href} class={`nav-pill${active ? " is-active" : ""}`}>
                <span aria-hidden="true">{n.emoji}</span> {n.label}
              </a>
            );
          })}
          {user && user.is_admin === 1 && (
            <a href="/admin" class="nav-pill nav-admin">
              <span aria-hidden="true">🧑‍⚖️</span> Admin
            </a>
          )}
        </nav>

        <div class="header-right">
          {user ? (
            <>
              <a href={`/spiller/${encodeURIComponent(user.sub)}`} class="balance-chip" title="Din pung">
                💰 <strong>{new Intl.NumberFormat("da-DK").format(user.balance)}</strong> kr.
              </a>
              <form method="post" action="/auth/freebuff/signout" class="inline-form">
                <button type="submit" class="btn btn-white btn-small">
                  Log ud
                </button>
              </form>
            </>
          ) : (
            <a href="/auth/freebuff/signin?returnTo=/" class="btn btn-white btn-small">
              Log ind med Freebuff
            </a>
          )}
          <button type="button" class="btn btn-white btn-small burger" id="burger" aria-expanded="false" aria-controls="mobilmenu">
            🍔 <span class="sr-only">Menu</span>
          </button>
        </div>
      </div>

      <nav id="mobilmenu" class="mobilmenu" aria-label="Mobilmenu" hidden>
        {[...NAV, { href: "/nyt", label: "Lav et væddemål", emoji: "✍️" }].map((n) => (
          <a href={n.href} class="card mobilmenu-link">
            <span aria-hidden="true">{n.emoji}</span> {n.label}
          </a>
        ))}
      </nav>

      {bonus > 0 && (
        <div class="bonus-toast" id="bonus-toast" role="status">
          🎉 Daglig bonus: <strong>+{bonus} kr.</strong> sat ind i din pung!
        </div>
      )}
    </header>
  );
}

const MARQUEE = [
  "Væddemål om alt det der sker i Danmark",
  "👉 Vædder du på nyhederne?",
  "Ingen rigtige penge – kun ære og gysser",
  "Admin afgør. Historien kan også afgøre det",
  "Kan du se fremtiden?",
  "Nye nyheder hvert kvarter",
];

function Marquee({ extra = [] as string[] }: { extra?: string[] }) {
  const items = [...MARQUEE, ...extra].slice(0, 10);
  const row = [...items, ...items];
  return (
    <div class="marquee" aria-hidden="true">
      <div class="marquee-track">
        {row.map((t, i) => (
          <span key={i} class="marquee-item">
            {t} <span class="marquee-dot">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer class="site-footer">
      <Marquee />
      <div class="footer-body">
        <svg class="cloud cloud-1" viewBox="0 0 200 90" aria-hidden="true">
          <path d="M40 70a28 28 0 0 1 4-55 34 34 0 0 1 64-6 26 26 0 0 1 34 25 24 24 0 0 1-14 22z" />
        </svg>
        <svg class="cloud cloud-2" viewBox="0 0 200 90" aria-hidden="true">
          <path d="M40 70a28 28 0 0 1 4-55 34 34 0 0 1 64-6 26 26 0 0 1 34 25 24 24 0 0 1-14 22z" />
        </svg>
        <div class="wrap footer-grid">
          <div>
            <p class="footer-title">🎲 LongBets</p>
            <p class="footer-text">
              Danmarks finurlige væddekontor for nyheder. Vi henter historierne fra de store danske medier,
              og så gælder det om at spå: hvad bliver udfaldet?
            </p>
          </div>
          <div>
            <p class="footer-heading">Kig rundt</p>
            <ul class="footer-links">
              <li><a href="/nyheder">Dagens nyheder</a></li>
              <li><a href="/vaeddemaal">Alle væddemål</a></li>
              <li><a href="/nyt">Lav dit eget væddemål</a></li>
              <li><a href="/spillere">Topspillerne</a></li>
            </ul>
          </div>
          <div>
            <p class="footer-heading">Det småt</p>
            <ul class="footer-links">
              <li><a href="/saadan">Sådan virker det</a></li>
              <li><a href="/admin">Afgør væddemål (admin)</a></li>
            </ul>
            <p class="footer-text small">
              Alt er sjov og leg: pengene i LongBets er fiktive. Ingen rigtige kroner skifter hænder.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function Layout(props: {
  title: string;
  description?: string;
  user: ViewUser | null;
  bonus?: number;
  path?: string;
  children: Child;
}) {
  const t = props.title ? `${props.title} – LongBets` : "LongBets – væddemål om danske nyheder";
  return (
    <html lang="da">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{t}</title>
        <meta name="description" content={props.description ?? "Væddemål om de store danske nyheder. Hvad bliver udfaldet?"} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@400;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="/styles.css" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <meta property="og:site_name" content="LongBets" />
        <meta property="og:title" content={t} />
        <meta property="og:type" content="website" />
      </head>
      <body data-path={props.path ?? "/"}>
        <Header user={props.user} bonus={props.bonus ?? 0} path={props.path ?? "/"} />
        <main class="wrap main">{props.children}</main>
        <Footer />
        <script src="/app.js" type="module"></script>
      </body>
    </html>
  );
}

export function Sticker({ text, tone = "sun" }: { text: string; tone?: "sun" | "coral" | "mint" | "grape" | "ocean" | "white" }) {
  return <span class={`sticker sticker-${tone}`}>{text}</span>;
}

export function Btn(props: {
  href?: string;
  onClick?: string;
  tone?: "sun" | "coral" | "mint" | "white" | "grape" | "ocean";
  small?: boolean;
  type?: "submit" | "button";
  name?: string;
  value?: string;
  children: Child;
  extra?: string;
}) {
  const cls = `btn btn-${props.tone ?? "sun"}${props.small ? " btn-small" : ""}${props.extra ? " " + props.extra : ""}`;
  if (props.href) {
    return (
      <a href={props.href} class={cls}>
        {props.children}
      </a>
    );
  }
  return (
    <button type={props.type ?? "button"} class={cls} name={props.name} value={props.value}>
      {props.children}
    </button>
  );
}
