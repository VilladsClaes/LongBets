# LongBets

Danmarks mest tålmodige bookmaker. En satirisk betting-side, hvor man sætter fiktive **Pralkroner** på påstande om fremtiden, der tidligst afgøres om et år. Der er ingen rigtige penge involveret.

Bygget med ASP.NET Core MVC (.NET 10) og Entity Framework Core med SQLite.

## Funktioner

- Forside med ticker over seneste indsatser, statistik og rangliste over "Største pralere"
- Oversigt over bets med filtrering på kategori og sortering
- Detaljeside med odds (totalisator), kupon og liste over indsatser
- Opret dit eget bet
- Kontaktformular, hvor beskeder gemmes i databasen
- Admin-side (`/Admin`): afgør eller genåbn bets, slet bets, læs og slet kontaktbeskeder

## Admin-adgangskode

Admin er beskyttet af én adgangskode, som læses fra konfigurationen `Admin:Password`. Er den ikke sat, er admin slået fra. Adgangskoden skal aldrig ligge i git.

Lokalt (gemmes uden for repoet med user-secrets):

```bash
dotnet user-secrets set "Admin:Password" "din-adgangskode"
```

På serveren: sæt miljøvariablen `Admin__Password`, eller læg en `appsettings.Production.json` med `{ "Admin": { "Password": "..." } }` direkte på webhotellet. Loginforsøg er begrænset til 5 pr. minut pr. IP.

## Struktur

| Mappe | Indhold |
| --- | --- |
| `Controllers/` | `HomeController` (forside, kontakt, ansvarligt spil, fejl) og `BetsController` |
| `Models/` | Entiteter (`Bet`, `Stake`, `ContactMessage`), odds-beregning og view-modeller |
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

```bash
dotnet publish -c Release -o publish
```

Upload indholdet af `publish/` til webhotellet. Kravene er:

- Hosting, der kører ASP.NET Core / .NET 10 (typisk Windows/IIS-webhoteller eller en VPS). Almindelige PHP-webhoteller kan ikke køre .NET.
- Mappen `App_Data/` skal være skrivbar for web-processen, fordi SQLite-databasen ligger der.
