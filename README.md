# 🎲 LongBets

Danmarks finurlige væddekontor for nyheder. LongBets henter de store historier fra danske
medier, gør dem til væddemål – og så er det om at spå: **ja** eller **nej**?

Bygget fra bunden i en Cloudflare Worker (Hono + TypeScript) med D1-database og statiske
assets. Samme glade udtryk som Venskabsbutikken: Fredoka/Nunito, creme, solgul, koral og
sticker-knapper med blæk-kanter.

## Hvad siden kan

| Side | Hvad den gør |
|---|---|
| `/` | Forside: hero, tal, seneste nyheder, hotteste væddemål, topspillere |
| `/nyheder` | Friske historier fra danske medier – hver enkelle kan væddes på |
| `/nyt` | Lav eget væddemål: indsæt link (metadata hentes automatisk) eller skriv det selv |
| `/vaeddemaal` | Alle væddemål, filteret på åbne/afgjorte |
| `/vaeddemaal/:id` | Detaljen: begge sider, indsats, udfordring, udfald og vinderens forklaring |
| `/spillere`, `/spiller/:sub` | Leaderboard og profiler |
| `/saadan` | Sådan virker det |
| `/admin` | Admin: hent nyheder, afgør væddemål |

## Spillets regler

1. **Startkapital** 1.000 kr. + **100 kr. i daglig bonus**, hver gang du kigger forbi.
   Alt er fiktive LongBets-kroner – ingen rigtige penge.
2. Du laver et væddemål formuleret som **ja/nej**, vælger side og smider en indsats i kassen.
   Pengene låses med det samme.
3. **Andre udfordrer** ved at tage den modsatte side med deres egne penge. Nu er der en pulje.
4. **Admin bestemmer udfaldet** – ja, nej eller annullér – med en begrundelse.
   Uden modsat side (eller ved annullering) får alle indsatsen retur.
5. **Vinderen deler puljen** proportionalt efter indsats og skriver bagefter
   *“Jeg fik ret fordi …”*, som hænger på væddemålet.

> **Admin:** den første der logger ind på en tom database bliver admin (`players.is_admin`).

## Nyhederne

`src/news.ts` indeholder kilde­listen. Lige nu hentes (7/7 i drift):

- **DR** – overskrifter læst af deres nyhedsside (DR har ikke RSS længere)
- **Politiken**, **Berlingske**, **BT** – via deres news-sitemaps
- **Jyllands-Posten**, **Information**, **Altinget** – klassiske RSS-feeds

Feeds hentes automatisk, når de er mere end 10 min. gamle, og gemmes i D1 (`news`).
Admin kan trykke “Hent nyheder nu”. TV 2 udgik, fordi de ikke længere tilbyder et feed.

## Kør den lokalt

```bash
npm install
npm run build        # esbuild → worker.js
npx wrangler dev --ip 0.0.0.0 --port 8787
```

`.dev.vars` (ikke i Git) skal indeholde `LB_DEV`, `FREEBUFF_CLIENT_ID`, `FREEBUFF_ISSUER`
og `APP_ORIGIN` – de to første auth-variabler kommer fra Freebuff-opsætningen.

- `npm run typecheck` – TypeScript uden emit
- `npm run build` – byg workeren
- D1 kører lokalt (Miniflare); skemaet oprettes idempotent ved første forespørgsel.

## Identitet og sikkerhed

- **Login:** Sign in with Freebuff (`@freebuff/auth`) – wrap af fetch-handlern, én gang pr. isolate.
  `getUser()` kaldes på hver side; beskyttede handles giver 401/redirect og **403 ved fremmed
  `Origin`** (`isSameOriginRequest`). Data ligger på `user.sub`.
- **Kun lokal test:** `LB_DEV=1` + loopback-vært + `x-dev-user`-header giver en testidentitet.
  Variabelen findes kun i `.dev.vars`, og headeren virker kun fra `localhost`/`127.0.0.1`.
- **Link-hentning** (`/api/link-meta`) afviser ikke-http(s), loopback og privat adresser.
- Pengene er **fiktive** – ingen betaling, ingen udbetaling.

## Struktur

```
src/
  index.tsx        ruter, identitet, CSRF, indpakning af auth
  db.ts            D1-skema (idempotent), spillere, daglig bonus
  news.ts          kilder, RSS/sitemap/HTML-parse, hentning til D1
  bets.ts          opret, indsats/escrow, afgørelse og uddeling af puljen
  meta.ts          titel/billede fra indsat link (Open Graph)
  fmt.ts           dato, beløb, danske formuleringer
  views/           layout, dele (kort) og siderne
public/            styles.css, app.js, favicon.svg
```

## Næste skridt

- Flere kilder (DR/TV2 hvis de får feed igen), emnefiltre og søgning
- Notifikationer når et væddemål bliver afgjort
- Deling af væddemål (Open Graph-kort pr. væddemål)
