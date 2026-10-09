# LongBets

Danmarks mest tålmodige bookmaker. En satirisk betting-side, hvor man sætter fiktive **Pralkroner** på påstande om fremtiden, der tidligst afgøres om et år. Siden henter løbende danske nyheder, som man kan lave bets ud fra. Der er ingen rigtige penge involveret.

Bygget med ASP.NET Core MVC (.NET 10) og Entity Framework Core med SQLite.

## Funktioner

- Nyheder fra DR, Politiken, Berlingske, BT, Jyllands-Posten, Information, Altinget og Ekstra Bladet, hentet hvert 10. minut. Hver nyhed har en "Bet på den"-knap
- Forside med ticker over seneste indsatser, statistik og rangliste over "Største pralere"
- Oversigt over bets med filtrering på kategori og sortering
- Detaljeside med odds (totalisator), kupon og liste over indsatser
- Opret dit eget bet, evt. ud fra et link til en artikel (titel og billede hentes automatisk, kun fra offentlige adresser)
- Vinderne kan skrive "Jeg fik ret fordi …" på et afgjort bet. Genkendes via en anonym cookie, så det kræver ingen konto
- Kontaktformular, hvor beskeder gemmes i databasen
- Admin-side (`/Admin`): afgør (PÅ, IMOD eller annullér, med begrundelse) eller genåbn bets, slet bets, læs og slet kontaktbeskeder, se status for hvert nyhedsfeed og hent nyheder med det samme

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
