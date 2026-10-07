import type { BetDetail } from "../bets";
import type { NewsRow, Player } from "../db";
import { dato, krBelob, tal, tidsiden } from "../fmt";
import { BetCard, Empty, PickRow, PlayerRow, SignInCard } from "./bits";
import { Btn, Layout, Sticker, type ViewUser } from "./layout";

interface PageProps {
  user: ViewUser | null;
  bonus?: number;
  path: string;
}

export function CreatePage(props: PageProps & {
  news: NewsRow | null;
  error?: string;
  suggested: string[];
  meta?: { url: string; title: string | null; description: string | null; image: string | null; site: string | null; error?: string } | null;
}) {
  const n = props.news;
  return (
    <Layout title="Nyt væddemål" user={props.user} bonus={props.bonus} path={props.path}>
      <section class="page-head">
        <Sticker tone="mint" text="✍️ Dit eget væddemål" />
        <h1>Lav et væddemål</h1>
        <p class="lead">
          Indsæt et link til en historie – så henter vi titel og billede. Eller skriv det hele selv. Gør det til et
          <strong> ja/nej-spørgsmål</strong>, så folk kan tage den modsatte side.
        </p>
      </section>

      {props.error && <p class="form-error">⚠️ {props.error}</p>}

      {!props.user ? (
        <SignInCard returnTo="/nyt" text="Log ind for at lave væddemål og satse penge." />
      ) : (
        <div class="create-columns">
          <section class="card form-card">
            <h2>🔗 1. Hvad handler det om?</h2>

            <div class="link-loader">
              <label class="label" htmlFor="linkurl">Indsæt et link til historien</label>
              <div class="link-row">
                <input class="input" id="linkurl" name="linkurl" type="url" placeholder="https://…" value={props.meta?.url ?? n?.url ?? ""} />
                <button type="button" class="btn btn-ocean" id="fetch-meta">Hent oplysninger 🔍</button>
              </div>
              <p class="fineprint" id="meta-status">
                {props.meta?.error ? `⚠️ ${props.meta.error}` : props.meta?.title ? `✅ Hentet: ${props.meta.title}` : "Vi læser titlen og billedet fra siden."}
              </p>
            </div>

            <div id="meta-preview" class={`meta-preview${props.meta?.image || props.meta?.title ? "" : " is-empty"}`}>
              {props.meta?.image && <img src={props.meta.image} alt="" id="meta-img" />}
              <div>
                <p id="meta-title">{props.meta?.title ?? n?.title ?? "Din overskrift vises her"}</p>
                <p id="meta-desc" class="fineprint">{props.meta?.description ?? n?.summary ?? ""}</p>
                <p id="meta-site" class="fineprint">{props.meta?.site ?? (n ? "DR" : "")}</p>
              </div>
            </div>

            <form method="post" action="/nyt" id="create-form">
              <input type="hidden" name="source_url" id="f-source-url" value={props.meta?.url ?? n?.url ?? ""} />
              <input type="hidden" name="source_name" id="f-source-name" value={props.meta?.title ?? n?.title ?? ""} />
              <input type="hidden" name="source_image" id="f-source-image" value={props.meta?.image ?? n?.image ?? ""} />
              <input type="hidden" name="news_id" value={n ? String(n.id) : ""} />
              <input type="hidden" name="kind" value={n ? "news" : props.meta?.url ? "link" : "custom"} />

              <h2>🎲 2. Spørgsmålet</h2>
              <label class="label" htmlFor="f-title">Formulér det som ja/nej</label>
              <textarea class="input" id="f-title" name="title" rows={2} required maxLength="300" placeholder="Vil … ske inden året er omme?">
                {props.meta?.title ?? ""}
              </textarea>

              {props.suggested.length > 0 && (
                <div class="suggest-row">
                  <span class="fineprint">Eller vælg en hurtig formulering:</span>
                  {props.suggested.map((s) => (
                    <button type="button" class="chip chip-btn" data-suggest={s}>{s}</button>
                  ))}
                </div>
              )}

              <label class="label" htmlFor="f-detail">Din begrundelse (valgfrit)</label>
              <textarea class="input" id="f-detail" name="detail" rows={3} maxLength="1000" placeholder="Hvorfor tror du lige præcis det?" />

              <h2>💰 3. Din egen indsats</h2>
              <div class="side-choice">
                <label class="choice choice-ja">
                  <input type="radio" name="side" value="ja" checked />
                  <span>Jeg tror, det sker – JA ✅</span>
                </label>
                <label class="choice choice-nej">
                  <input type="radio" name="side" value="nej" />
                  <span>Jeg tror, det ikke sker – NEJ ❌</span>
                </label>
              </div>

              <label class="label" htmlFor="f-statement">Sig det med egne ord (valgfrit)</label>
              <input class="input" id="f-statement" name="statement" maxLength="500" placeholder="Jeg tror på at …" />

              <div class="stake-row">
                {[0, 25, 50, 100, 250].map((v) => (
                  <button type="button" class="btn btn-white btn-small stake-quick" data-stake={v} data-target="f-stake">
                    {v === 0 ? "ingen indsats" : v}
                  </button>
                ))}
                <input class="input input-stake" id="f-stake" name="stake" type="number" min="0" max={props.user.balance} value="50" />
              </div>
              <p class="fineprint">Sæt 0, hvis du bare vil lave væddemålet uden selv at satse. Du har {krBelob(props.user.balance)}.</p>

              <button type="submit" class="btn btn-coral btn-block">Opret væddemålet 🚀</button>
            </form>
          </section>

          <aside class="create-side">
            <div class="card side-card">
              <h3>Sådan vinder du venner</h3>
              <ul class="checklist">
                <li>✅ Spørgsmålet skal kunne besvares med ja eller nej</li>
                <li>✅ Jo skarpere, desto sjovere at vædde om</li>
                <li>✅ Andre tager den modsatte side – så er der pulje at spille om</li>
                <li>✅ Når historien udfolder sig, afgør admin hvem der fik ret</li>
              </ul>
            </div>
            <div class="card side-card">
              <h3>💡 Ikke noget link?</h3>
              <p class="fineprint">
                Bare skriv spørgsmålet alligevel. Eller find en historie på <a href="/nyheder">nyhedssiden</a> – der
                er de allerede hentet ind.
              </p>
            </div>
          </aside>
        </div>
      )}
    </Layout>
  );
}

export function PlayersPage(props: PageProps & {
  standings: { sub: string; name: string; balance: number; is_admin: number; wins: number; losses: number; open: number }[];
}) {
  return (
    <Layout title="Spillere" user={props.user} bonus={props.bonus} path={props.path}>
      <section class="page-head">
        <Sticker tone="sun" text="🏆 Hall of fame" />
        <h1>Spillerne</h1>
        <p class="lead">Pungen er alt – alle starter med 1.000 kr. og får 100 kr. hver dag, de kigger forbi.</p>
      </section>

      <div class="card table-card">
        <table class="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Spiller</th>
              <th class="num">Vundet / tabt</th>
              <th class="num">Pung</th>
            </tr>
          </thead>
          <tbody>
            {props.standings.map((p, i) => (
              <PlayerRow p={p} i={i} />
            ))}
          </tbody>
        </table>
      </div>
      {props.standings.length === 0 && (
        <Empty emoji="🪑" title="Ingen spillere endnu" text="Log ind, så bliver du den første." action={{ href: "/auth/freebuff/signin?returnTo=/spillere", label: "Log ind med Freebuff" }} />
      )}
    </Layout>
  );
}

export function PlayerPage(props: PageProps & {
  player: { sub: string; name: string; balance: number; is_admin: number; created_at: string };
  wins: number;
  losses: number;
  bets: BetDetail[];
}) {
  const p = props.player;
  return (
    <Layout title={p.name} user={props.user} bonus={props.bonus} path={props.path}>
      <section class="page-head">
        <Sticker tone={p.is_admin ? "grape" : "ocean"} text={p.is_admin ? "🧑‍⚖️ Admin" : "👤 Spiller"} />
        <h1>{p.name}</h1>
        <p class="lead">
          Kom til {dato(p.created_at)} · {props.wins} sejre · {props.losses} nederlag
        </p>
        <p class="hero-balance">💰 {krBelob(p.balance)}</p>
      </section>

      <h2>Deres væddemål</h2>
      {props.bets.length ? (
        <div class="grid grid-3">
          {props.bets.map((d) => (
            <BetCard d={d} />
          ))}
        </div>
      ) : (
        <Empty emoji="🌵" title="Ingen væddemål endnu" text="Denne spiller har ikke satset på noget." action={{ href: "/nyheder", label: "Find en nyhed 🎲" }} />
      )}
    </Layout>
  );
}

export function HowToPage(props: PageProps) {
  const steps = [
    { e: "1️⃣", t: "Hent din daglige bonus", d: "Når du logger ind, får du 100 kr. i sjove LongBets-kroner. De er gratis – men de taber, hvis du satser klogsløst." },
    { e: "2️⃣", t: "Find en historie", d: "Nyhedsiden opdateres automatisk fra DR, Politiken, Berlingske, BT, Jyllands-Posten, Information og Altinget. Du kan også indsætte dit eget link." },
    { e: "3️⃣", t: "Skriv dit væddemål", d: "“Vil ministeren gå af inden nytår?” – det skal kunne svares med ja eller nej. Vælg selv din side og smid en indsats i kassen." },
    { e: "4️⃣", t: "Bliv udfordret", d: "Nogen er uenig? De tager den modsatte side med deres egne penge. Nu er der en pulje at spille om." },
    { e: "5️⃣", t: "Historien afgør det", d: "Admin (eller nyhederne selv) fastslår udfaldet. Vinderne deler hele puljen – taberne går tomhændede." },
    { e: "6️⃣", t: "Forklar hvorfor", d: "Vinderen skriver “Jeg fik ret fordi …” – og det hænger på væddemålet for altid." },
  ];
  return (
    <Layout title="Sådan virker det" user={props.user} bonus={props.bonus} path={props.path}>
      <section class="page-head">
        <Sticker tone="coral" text="🤓 Vejledningen" />
        <h1>Sådan virker LongBets</h1>
        <p class="lead">Et væddekontor for danske nyheder. Ingen rigtige penge – kun ære, gysser og rettidig omhu.</p>
      </section>

      <div class="grid grid-3">
        {steps.map((s) => (
          <div class="card step-card reveal">
            <span class="step-emoji" aria-hidden="true">{s.e}</span>
            <h3>{s.t}</h3>
            <p>{s.d}</p>
          </div>
        ))}
      </div>

      <section class="section">
        <div class="card tip-card">
          <p class="tip-title">⚖️ Hvem bestemmer egentlig?</p>
          <p>
            <strong>Admin gør.</strong> Når en historie har fundet sit udfald – ministeren gik af, loven blev
            vedtaget, holdet røg ud – trykker admin på ja eller nej. Historien kan også afgøre den: står der
            sort på hvidt i morgenens aviser, er det jo ligegyldigt hvad nogen følte.
          </p>
          <p>
            Og hvis der slet ingen modsatte side var? Så får alle deres penge retur. Ingen modstander, ingen vinder.
          </p>
        </div>
      </section>

      <section class="section">
        <div class="card tip-card tip-alt">
          <p class="tip-title">💶 De penge er fiktive</p>
          <p>
            LongBets-kroner er stykkegodt computermynter. De kan ikke byttes til noget som helst – hverken
            sandwich eller aktier. Det er alene for at mærke hvor meget det gør at tage fejl.
          </p>
        </div>
      </section>

      <p class="center">
        <Btn href="/nyheder" tone="coral">Kom i gang: se nyhederne 📰</Btn>
      </p>
    </Layout>
  );
}

export function AdminPage(props: PageProps & {
  isAdmin: boolean;
  queue: BetDetail[];
  feeds: { source: string; last_fetch: string; ok: number; count: number; error: string | null }[];
  stats: { bets: number; open: number; inKassen: number; players: number; picks: number; news: number };
  notice?: string;
  error?: string;
}) {
  if (!props.user) {
    return (
      <Layout title="Admin" user={null} bonus={props.bonus} path={props.path}>
        <SignInCard returnTo="/admin" text="Admin-panelet kræver login." />
      </Layout>
    );
  }
  if (!props.isAdmin) {
    return (
      <Layout title="Admin" user={props.user} bonus={props.bonus} path={props.path}>
        <Empty emoji="🚫" title="Ikke din tur" text="Denne side er kun for admin. Du er logget ind som spiller." action={{ href: "/", label: "Til forsiden" }} />
      </Layout>
    );
  }
  return (
    <Layout title="Admin" user={props.user} bonus={props.bonus} path={props.path}>
      <section class="page-head">
        <Sticker tone="grape" text="🧑‍⚖️ Baglokalet" />
        <h1>Admin</h1>
        <p class="lead">Du bestemmer hvem der får ret – og kan tvinge nye nyheder ind.</p>
      </section>

      {props.notice && <p class="form-ok">✅ {props.notice}</p>}
      {props.error && <p class="form-error">⚠️ {props.error}</p>}

      <div class="stat-grid stat-grid-admin">
        {[
          { n: tal(props.stats.open), l: "åbne væddemål", e: "🔥" },
          { n: krBelob(props.stats.inKassen), l: "i kassen", e: "💰" },
          { n: tal(props.stats.news), l: "nyheder", e: "📰" },
          { n: tal(props.stats.players), l: "spillere", e: "🧑‍🤝‍🧑" },
        ].map((s) => (
          <div class="card stat-card">
            <dt class="stat-emoji" aria-hidden="true">{s.e}</dt>
            <dd class="stat-num">{s.n}</dd>
            <dd class="stat-label">{s.l}</dd>
          </div>
        ))}
      </div>

      <section class="section">
        <div class="section-head">
          <h2>📰 Nyhedshentning</h2>
          <form method="post" action="/admin/hent" class="inline-form">
            <button type="submit" class="btn btn-ocean btn-small">Hent nyheder nu 🔄</button>
          </form>
        </div>
        <div class="card table-card">
          <table class="table">
            <thead>
              <tr>
                <th>Medie</th>
                <th>Senest hentet</th>
                <th class="num">Artikler</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {props.feeds.map((f) => (
                <tr>
                  <td>{f.source}</td>
                  <td>{tidsiden(f.last_fetch)}</td>
                  <td class="num">{f.count}</td>
                  <td>{f.ok ? "✅" : `⚠️ ${f.error ?? "fejl"}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section class="section">
        <h2>⚖️ Afgør væddemål</h2>
        {props.queue.length ? (
          <div class="queue">
            {props.queue.map((d) => (
              <div class="card queue-card">
                <h3>
                  <a href={`/vaeddemaal/${d.bet.id}`}>{d.bet.title}</a>
                </h3>
                <p class="bet-meta">
                  <span>👥 {d.picks.length} deltagere</span>
                  <span>💰 {krBelob(d.picks.reduce((a, p) => a + p.stake, 0))} i kassen</span>
                  <span>📅 oprettet {dato(d.bet.created_at)}</span>
                </p>
                <p class="split-caption">
                  Ja {krBelob(d.ja.stake)} ({d.ja.count}) · Nej {krBelob(d.nej.stake)} ({d.nej.count})
                </p>
                <ul class="pick-list pick-list-mini">
                  {d.picks.map((p) => (
                    <PickRow p={p} bet={d.bet} user={null} />
                  ))}
                </ul>
                <form method="post" action={`/admin/afgoer/${d.bet.id}`} class="resolve-form">
                  <label class="label" htmlFor={`note-${d.bet.id}`}>Begrundelse (valgfrit)</label>
                  <input class="input" id={`note-${d.bet.id}`} name="note" maxLength="1000" placeholder="Fx: “Loven blev vedtaget 3. oktober”" />
                  <div class="resolve-actions">
                    <button type="submit" name="outcome" value="ja" class="btn btn-mint">JA fik ret ✅</button>
                    <button type="submit" name="outcome" value="nej" class="btn btn-grape">NEJ fik ret ❌</button>
                    <button type="submit" name="outcome" value="void" class="btn btn-white">Annullér 🤹</button>
                  </div>
                </form>
              </div>
            ))}
          </div>
        ) : (
          <Empty emoji="🌴" title="Intet at afgøre lige nu" text="Når væddemålene har fået en modsat side, lander de her." action={{ href: "/vaeddemaal", label: "Se alle væddemål" }} />
        )}
      </section>
    </Layout>
  );
}

export function NotFoundPage(props: PageProps) {
  return (
    <Layout title="Ikke fundet" user={props.user} bonus={props.bonus} path={props.path}>
      <Empty emoji="🕳️" title="404 – den historie findes ikke" text="Måske er den allerede glemt?" action={{ href: "/", label: "Til forsiden" }} />
    </Layout>
  );
}

export function ErrorPage(props: PageProps & { message: string }) {
  return (
    <Layout title="Noget gik galt" user={props.user} bonus={props.bonus} path={props.path}>
      <Empty emoji="😵" title="Noget gik galt" text={props.message} action={{ href: "/", label: "Til forsiden" }} />
    </Layout>
  );
}
