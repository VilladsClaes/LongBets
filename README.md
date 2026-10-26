# LongBets

Danmarks mest tålmodige bookmaker. En satirisk betting-side, hvor man sætter fiktive **Pralkroner** på påstande om fremtiden, der tidligst afgøres om et år. Siden henter løbende danske nyheder, som man kan lave bets ud fra. Der er ingen rigtige penge involveret.

Bygget med ASP.NET Core MVC (.NET 10) og Entity Framework Core med SQLite.

## Funktioner

- Nyheder fra DR, Politiken, Berlingske, BT, Jyllands-Posten, Information, Altinget og Ekstra Bladet, hentet hvert 10. minut. Hver nyhed har en "Bet på den"-knap
- Forside med ticker over seneste indsatser, statistik og rangliste over "Største pralere"
- Oversigt over bets med filtrering på kategori og sortering
- Detaljeside med odds (totalisator), kupon og liste over indsatser
- Opret dit eget bet, evt. ud fra et link til en artikel (titel og billede hentes automatisk, kun fra offentlige adresser)
- Spillerkonti med Google-login: 1.000 Pralkroner i startkapital, 100 i daglig bonus, indsatsen trækkes fra saldoen og gevinsten udbetales, når bettet afgøres
- "Mine væddemål" (`/Account/Mine`): saldo, åbne og afgjorte indsatser, gevinst og egne bets
- Vinderne kan skrive "Jeg fik ret fordi …" på et afgjort bet
- Kontaktformular, hvor beskeder gemmes i databasen
- Admin-side (`/Admin`): afgør (PÅ, IMOD eller annullér, med begrundelse) eller genåbn bets, slet bets, læs og slet kontaktbeskeder, se status for hvert nyhedsfeed og hent nyheder med det samme

## Spillerlogin

Spillerne logger ind med Google via ASP.NET Identity. Login-tabellerne er Identitys standardtabeller (`AspNetUsers`, `AspNetUserLogins` osv.), og spillets data ligger i `Players` (saldo, kaldenavn) og `Stakes.UserId`. `Players.UserId` er bevidst ikke en fremmednøgle til `AspNetUsers`, så login senere kan flyttes til en fælles brugerdatabase for alle villadsclaes.dk-projekter. E-mail/adgangskode-login kan tilføjes på de samme tabeller.

Google-login er slået til, når `Authentication:Google:ClientId` og `Authentication:Google:ClientSecret` er sat. Opret en OAuth-klient (type "Web application") i Google Cloud Console med disse redirect-adresser:

- `https://longbets.villadsclaes.dk/signin-google`
- `https://localhost:7180/signin-google` (lokalt; brug `dotnet run --launch-profile https`)

Lokalt:

```bash
dotnet user-secrets set "Authentication:Google:ClientId" "..."
dotnet user-secrets set "Authentication:Google:ClientSecret" "..."
```

På serveren skrives de af GitHub Actions fra secrets `GOOGLE_CLIENT_ID` og `GOOGLE_CLIENT_SECRET`. Under udvikling (`ASPNETCORE_ENVIRONMENT=Development`) har login-siden også et testlogin uden Google.

Login-nøglerne (Data Protection) gemmes i `App_Data/keys`, så spillerne ikke logges ud, når IIS genstarter appen.

## Admin-adgangskode

Admin er beskyttet af én adgangskode, som læses fra konfigurationen `Admin:Password`. Er den ikke sat, er admin slået fra. Adgangskoden skal aldrig ligge i git.

Lokalt (gemmes uden for repoet med user-secrets):

```bash
dotnet user-secrets set "Admin:Password" "din-adgangskode"
```

På serveren: sæt miljøvariablen `Admin__Password`, eller læg en `appsettings.Production.json` med `{ "Admin": { "Password": "..." } }` direkte på webhotellet. Loginforsøg er begrænset til 5 pr. minut pr. IP.

## Nyhedsimport

Kilderne står i `News/NewsSources.cs`. Hver kilde er enten RSS/Atom eller et Google News-sitemap og kan have flere feed-adresser (DR er fx flere sektionsfeeds flettet sammen).

`NewsRefreshService` henter alle kilder ved opstart og derefter hvert 10. minut. IIS lukker appen ned, når ingen besøger den. Derfor beder forsiden og nyhedssiden også om en hentning, når nyhederne er ældre end intervallet. Nyheder slettes efter 7 dage. Bets gemmer selv nyhedens titel og link, så de overlever.

Indstillinger i `appsettings.json`: `News:Enabled` (standard `true`) og `News:IntervalMinutes` (standard `10`).

## Struktur

| Mappe | Indhold |
| --- | --- |
| `Controllers/` | `HomeController` (forside, kontakt, ansvarligt spil, fejl), `BetsController`, `NewsController` og `AdminController` |
| `Models/` | Entiteter (`Bet`, `Stake`, `ContactMessage`, `NewsItem`, `FeedState`), odds-beregning og view-modeller |
| `News/` | Nyhedskilder, feed-parser, import og baggrundstjeneste |
| `Data/` | `AppDbContext` og eksempeldata (`SeedData`) |
| `Migrations/` | EF Core-migrationer |
| `Views/` | Razor-views |
| `wwwroot/` | CSS, JS og favicon |

## Kør lokalt

```bash
dotnet run --launch-profile http
```

Siden kører på http://localhost:5180. Databasen oprettes automatisk i `App_Data/longbets.db` ved første start og fyldes med eksempel-bets.

## Ændringer i datamodellen

```bash
dotnet tool restore
dotnet ef migrations add NavnPåÆndring
```

Migrationer køres automatisk, når siden starter.

## Udgivelse

Siden udgives automatisk til simply.com (longbets.villadsclaes.dk) via GitHub Actions ved push til `aspnetcore-migration`, se `.github/workflows/deploy.yml`. Workflowet kræver FTP-secrets i repoet.

Manuelt:

```bash
dotnet publish -c Release -o publish
```

Upload indholdet af `publish/` til webhotellet. Kravene er:

- Hosting, der kører ASP.NET Core / .NET 10 (typisk Windows/IIS-webhoteller eller en VPS). Almindelige PHP-webhoteller kan ikke køre .NET.
- Mappen `App_Data/` skal være skrivbar for web-processen, fordi SQLite-databasen ligger der.
