import type { BetDetail } from "../bets";
import type { NewsRow, Player } from "../db";
import { dato, kr, krBelob, tal, tidsiden } from "../fmt";
import { BetCard, Empty, NewsCard, PickRow, PlayerRow, SignInCard, SidesBar, sourceColor } from "./bits";
import { Btn, Layout, Sticker, type ViewUser } from "./layout";

interface PageProps {
  user: ViewUser | null;
  bonus?: number;
  path: string;
}

export function HomePage(props: PageProps & {
  stats: { bets: number; open: number; inKassen: number; players: number; picks: number; news: number };
  topBets: BetDetail[];
  news: NewsRow[];
  standings: { sub: string; name: string; balance: number; is_admin: number; wins?: number; losses?: number }[];
}) {
  const { stats } = props;
  return (
    <Layout title="" description="Væddemål om de store danske nyheder. Tror du på at – så satser du." user={props.user} bonus={props.bonus} path={props.path}>
      <section class="hero">
        <div class="hero-sun" aria-hidden="true">☀️</div>
        <div class="hero-rainbow" aria-hidden="true"></div>
        <p class="pill pop">✨ Nu med {tal(stats.news)} nyheder fra danske medier</p>
        <h1 class="hero-title pop delay-1">
          Vædd om hvad der <span class="highlight">sker i Danmark!</span>
        </h1>
        <p class="hero-lead pop delay-2">
          Vi henter dagens store historier fra DR, Politiken, Berlingske, BT, Jyllands-Posten, Information og
          Altinget – og så gælder det om at spå. Satser du på <strong>ja</strong> eller <strong>nej</strong>?
        </p>
        <div class="hero-actions pop delay-3">
          <Btn href="/nyheder" tone="coral">Se dagens nyheder 📰</Btn>
          <Btn href="/nyt" tone="white">Lav dit eget væddemål ✍️</Btn>
        </div>

        <dl class="stat-grid">
          {[
            { n: tal(stats.news), l: "nyheder i kassen", e: "📰" },
            { n: tal(stats.open), l: "åbne væddemål", e: "🔥" },
            { n: krBelob(stats.inKassen), l: "i kassen lige nu", e: "💰" },
            { n: tal(stats.players), l: "spillere", e: "🧑‍🤝‍🧑" },
          ].map((s, i) => (
            <div class="card stat-card pop" style={`animation-delay:${480 + i * 90}ms`}>
              <dt class="stat-emoji" aria-hidden="true">{s.e}</dt>
              <dd class="stat-num">{s.n}</dd>
              <dd class="stat-label">{s.l}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section class="section">
        <div class="section-head">
          <h2>Seneste nyheder <span class="wavy">du kan vædde på</span></h2>
          <a class="btn btn-white btn-small" href="/nyheder">Alle nyheder →</a>
        </div>
        <div class="grid grid-3">
          {props.news.slice(0, 3).map((n) => (
            <NewsCard n={n} />
          ))}
        </div>
      </section>

      <section class="section">
        <div class="section-head">
          <h2>🔥 Hotteste væddemål lige nu</h2>
          <a class="btn btn-white btn-small" href="/vaeddemaal">Alle væddemål →</a>
        </div>
        {props.topBets.length ? (
          <div class="grid grid-3">
            {props.topBets.map((d) => (
              <BetCard d={d} />
            ))}
          </div>
        ) : (
          <Empty
            emoji="🏜️"
            title="Der er ikke satset endnu"
            text="Vær den første: find en nyhed og sig, hvad du tror der sker."
            action={{ href: "/nyheder", label: "Find en nyhed 🎲" }}
          />
        )}
      </section>

      <section class="section how" id="saadan">
        <h2>Sådan foregår det</h2>
        <div class="grid grid-3">
          {[
            { e: "📰", t: "1. Find en historie", d: "Vi henter nyhederne fra de store danske medier – friske hele dagen.", tone: "sky" },
            { e: "🎯", t: "2. Sig hvad du tror", d: "“Jeg tror på at …” – vælg ja eller nej, skriv hvorfor, og smid en indsats i kassen.", tone: "sun" },
            { e: "🥊", t: "3. Bliv udfordret", d: "Andre tager den modsatte side. Når historien udfolder sig, afgør admin (eller historien selv) hvem der fik ret.", tone: "mint" },
          ].map((s) => (
            <div class={`card step-card step-${s.tone} reveal`}>
              <span class="step-emoji" aria-hidden="true">{s.e}</span>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </div>
          ))}
        </div>
        <p class="center">
          <a class="btn btn-grape" href="/saadan">Læs den lange forklaring 🤓</a>
        </p>
      </section>

      <section class="section">
        <div class="section-head">
          <h2>🏆 Topspillerne</h2>
          <a class="btn btn-white btn-small" href="/spillere">Hele listen →</a>
        </div>
        <div class="card table-card">
          <table class="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Spiller</th>
                <th class="num">Pung</th>
              </tr>
            </thead>
            <tbody>
              {props.standings.slice(0, 6).map((p, i) => (
                <PlayerRow p={p} i={i} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section class="cta-banner reveal">
        <div>
          <h2>Kan du se fremtiden?</h2>
          <p>Log ind, hent din daglige bonus på 100 kr. og sæt din første indsats.</p>
        </div>
        <div class="cta-actions">
          {props.user ? (
            <Btn href="/nyt" tone="sun">Lav et væddemål 🎲</Btn>
          ) : (
            <Btn href="/auth/freebuff/signin?returnTo=/" tone="sun">Log ind med Freebuff ✨</Btn>
          )}
        </div>
      </section>
    </Layout>
  );
}

export function NewsPage(props: PageProps & {
  news: NewsRow[];
  counts: Record<number, number>;
  sources: { id: string; name: string; color: string; ok: boolean; count: number; error?: string }[];
  lastFetch: string | null;
  refreshing: boolean;
  filter: string;
}) {
  return (
    <Layout title="Nyheder" description="Dagens store danske nyheder – alle er til at vædde på." user={props.user} bonus={props.bonus} path={props.path}>
      <section class="page-head">
        <Sticker tone="coral" text="📰 Friske fra pressen" />
        <h1>Dagens nyheder</h1>
        <p class="lead">
          Historier fra de store danske medier. Klik på <strong>“Vædder på denne”</strong>, og lav et væddemål om
          hvad udfaldet bliver.
        </p>
        <div class="source-row">
          <a href="/nyheder" class={`chip ${props.filter === "" ? "chip-on" : ""}`}>Alle</a>
          {props.sources.map((s) => (
            <a href={`/nyheder?medie=${s.id}`} class={`chip ${props.filter === s.id ? "chip-on" : ""}`} title={s.ok ? `${s.count} artikler` : s.error ?? "kunne ikke hentes"}>
              <span class="chip-dot" style={`background:${s.color}`}></span>
              {s.name}
              {!s.ok && <span aria-hidden="true">⚠️</span>}
            </a>
          ))}
        </div>
        <p class="fineprint">
          Hentet automatisk{props.lastFetch ? ` – senest ${tidsiden(props.lastFetch)}` : ""}
          {props.refreshing && " …opdaterer lige nu"}
        </p>
      </section>

      {props.news.length ? (
        <div class="grid grid-3">
          {props.news.map((n) => (
            <NewsCard n={n} bets={props.counts[n.id] ?? 0} />
          ))}
        </div>
      ) : (
        <Empty
          emoji="🕵️"
          title="Ingen nyheder endnu"
          text="Vi er ved at hente dagens historier ind. Kig forbi om et øjeblik."
          action={{ href: "/nyheder", label: "Prøv igen 🔄" }}
        />
      )}

      <section class="section">
        <div class="card tip-card">
          <p class="tip-title">💡 Ikke enig i listen?</p>
          <p>
            Du kan altid indsætte dit eget link – så henter LongBets titel og billede og laver et væddemål om
            præcis den historie.
          </p>
          <a class="btn btn-ocean btn-small" href="/nyt">Indsæt et link 🔗</a>
        </div>
      </section>
    </Layout>
  );
}

export function BetsPage(props: PageProps & { bets: BetDetail[]; filter: string }) {
  const tabs = [
    { id: "open", label: "Åbne", emoji: "🔥" },
    { id: "resolved", label: "Afgjorte", emoji: "🏁" },
    { id: "all", label: "Alle", emoji: "📚" },
  ];
  return (
    <Layout title="Væddemål" user={props.user} bonus={props.bonus} path={props.path}>
      <section class="page-head">
        <Sticker tone="grape" text="💸 Væddekontoret" />
        <h1>Alle væddemål</h1>
        <p class="lead">Tag den modsatte side, udfordr en ven, eller følg med i hvad de andre tror.</p>
        <div class="tabs">
          {tabs.map((t) => (
            <a href={`/vaeddemaal?filter=${t.id}`} class={`chip ${props.filter === t.id || (props.filter === "" && t.id === "open") ? "chip-on" : ""}`}>
              {t.emoji} {t.label}
            </a>
          ))}
          <a href="/nyt" class="btn btn-coral btn-small">+ Nyt væddemål</a>
        </div>
      </section>

      {props.bets.length ? (
        <div class="grid grid-3">
          {props.bets.map((d) => (
            <BetCard d={d} />
          ))}
        </div>
      ) : (
        <Empty emoji="🕳️" title="Ingen væddemål her" text="Der er ikke noget på den hylde endnu." action={{ href: "/nyt", label: "Lav det første ✍️" }} />
      )}
    </Layout>
  );
}

export function BetPage(props: PageProps & { d: BetDetail; error?: string; notice?: string }) {
  const d = props.d;
  const bet = d.bet;
  const lukket = bet.status !== "open" || (bet.closes_at !== null && new Date(bet.closes_at).getTime() < Date.now());
  const myPick = props.user ? d.picks.find((p) => p.sub === props.user!.sub) : undefined;
  const iWon = myPick?.status === "won";
  const canNote = bet.status === "resolved" && iWon && !myPick?.win_note;

  return (
    <Layout title={bet.title} description={bet.title} user={props.user} bonus={props.bonus} path={props.path}>
      <section class="bet-hero">
        <div class="bet-stickers">
          <Sticker tone={bet.status === "open" ? "sun" : "mint"} text={bet.status === "open" ? "🔥 Åbent for indsats" : "🏁 Afgjort"} />
          <Sticker tone={bet.kind === "news" ? "coral" : bet.kind === "link" ? "ocean" : "white"} text={bet.kind === "news" ? "📰 fra nyheder" : bet.kind === "link" ? "🔗 link" : "✍️ skrevet selv"} />
        </div>
        <h1>{bet.title}</h1>
        {bet.detail && <p class="lead">{bet.detail}</p>}

        <dl class="bet-facts">
          <div><dt>Oprettet af</dt><dd><a href={`/spiller/${encodeURIComponent(bet.created_by)}`}>{bet.creator_name ?? "ukendt"}</a></dd></div>
          <div><dt>Oprettet</dt><dd>{dato(bet.created_at)}</dd></div>
          {bet.closes_at && <div><dt>Indsats lukker</dt><dd>{dato(bet.closes_at)}</dd></div>}
          <div><dt>I kassen</dt><dd>{krBelob(d.picks.reduce((a, p) => a + p.stake, 0))}</dd></div>
        </dl>

        {bet.source_url && (
          <p class="bet-source-big">
            <a class="btn btn-white btn-small" href={bet.source_url} target="_blank" rel="noopener noreferrer">
              🔗 Læs historien hos {bet.source_name ?? "kilden"} ↗
            </a>
          </p>
        )}

        <SidesBar ja={d.ja} nej={d.nej} />
        <p class="split-caption">
          Ja-siden {krBelob(d.ja.stake)} ({d.ja.count}) · Nej-siden {krBelob(d.nej.stake)} ({d.nej.count})
        </p>

        {bet.status === "resolved" && (
          <div class="card resolution-card">
            <p class="resolution-title">
              Udfaldet: {bet.outcome === "ja" ? "JA ✅" : bet.outcome === "nej" ? "NEJ ❌" : "annulleret 🤹"}
            </p>
            {bet.resolution_note && <p>🧑‍⚖️ {bet.resolution_note}</p>}
            <p class="fineprint">Afgjort af {bet.resolved_by ? "admin" : "system"} den {dato(bet.resolved_at)}</p>
          </div>
        )}
      </section>

      {props.error && <p class="form-error">⚠️ {props.error}</p>}
      {props.notice && <p class="form-ok">✅ {props.notice}</p>}

      <div class="bet-columns">
        <section class="col-main">
          <h2>🎯 Hvem tror hvad</h2>
          {d.picks.length ? (
            <ul class="pick-list">
              {d.picks.map((p) => (
                <PickRow p={p} bet={bet} user={props.user} />
              ))}
            </ul>
          ) : (
            <p class="muted">Ingen har taget stilling endnu. Vær den første!</p>
          )}

          {canNote && (
            <section class="card win-form" id="notat">
              <h3>🎉 Du fik ret!</h3>
              <p>Skriv hvorfor – det bliver hængende på væddemålet som dit bevis.</p>
              <form method="post" action={`/vaeddemaal/${bet.id}/notat`}>
                <label class="label" htmlFor="win_note">Jeg fik ret fordi …</label>
                <textarea class="input" id="win_note" name="win_note" rows={3} required placeholder="… fordi ministeren gik af allerede dagen efter." />
                <button type="submit" class="btn btn-mint">Skriv det 🖊️</button>
              </form>
            </section>
          )}
        </section>

        <aside class="col-side">
          {lukket ? (
            bet.status === "open" ? (
              <div class="card side-card">
                <h3>⏳ Indsatsen er lukket</h3>
                <p className="muted">Der er lukket for nye indsatser – nu venter vi på at historien udfolder sig.</p>
              </div>
            ) : null
          ) : !props.user ? (
            <SignInCard returnTo={`/vaeddemaal/${bet.id}`} text="Log ind for at tage den modsatte side og satse penge." />
          ) : myPick ? (
            <div class="card side-card">
              <h3>Din position</h3>
              <p>
                Du står på <strong>{myPick.side === "ja" ? "JA ✅" : "NEJ ❌"}</strong> med {kr(myPick.stake)}.
              </p>
              {myPick.statement && <p class="pick-statement">“{myPick.statement}”</p>}
              <p class="fineprint">Én person – én side. Du kan ikke bytte side.</p>
            </div>
          ) : (
            <div class="card side-card">
              <h3>🎯 Tag stilling</h3>
              <p class="fineprint">Pengene låses, indtil væddemålet er afgjort. Du starter med 1.000 kr. + 100 kr. i daglig bonus.</p>
              <form method="post" action={`/vaeddemaal/${bet.id}/pick`} class="pick-form">
                <fieldset>
                  <legend>Hvad tror du?</legend>
                  <div class="side-choice">
                    <label class="choice choice-ja">
                      <input type="radio" name="side" value="ja" checked />
                      <span>JA – det sker ✅</span>
                    </label>
                    <label class="choice choice-nej">
                      <input type="radio" name="side" value="nej" checked />
                      <span>NEJ – det sker ikke ❌</span>
                    </label>
                  </div>
                </fieldset>

                <label class="label" htmlFor="statement">Sig det med egne ord (valgfrit)</label>
                <input class="input" id="statement" name="statement" maxLength="500" placeholder="Jeg tror på at …" />

                <label class="label" htmlFor="stake">Din indsats i kr.</label>
                <div class="stake-row">
                  {[25, 50, 100, 250].map((v) => (
                    <button type="button" class="btn btn-white btn-small stake-quick" data-stake={v}>
                      {v}
                    </button>
                  ))}
                  <input class="input input-stake" id="stake" name="stake" type="number" min="1" max={props.user ? props.user.balance : 1000} value="50" required />
                </div>
                <p class="fineprint">Du har {props.user ? krBelob(props.user.balance) : "–"} i pungen.</p>
                <button type="submit" class="btn btn-coral btn-block">Satser du? 🎲</button>
              </form>
            </div>
          )}

          <div class="card side-card">
            <h3>🧑‍⚖️ Hvem afgør?</h3>
            <p class="fineprint">
              Admin bestemmer udfaldet – ellers afgør historien det. Vinderne skriver bagefter
              “Jeg fik ret fordi …”.
            </p>
            <a class="link" href="/saadan">Læs hvordan det virker →</a>
          </div>
        </aside>
      </div>
    </Layout>
  );
}
