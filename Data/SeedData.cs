using LongBets.Models;

namespace LongBets.Data;

public static class SeedData
{
    public static void Initialize(AppDbContext db)
    {
        if (db.Bets.Any()) return;

        var now = DateTime.UtcNow;

        Bet NewBet(string title, string description, BetCategory category, int year, string createdBy, params (string Name, bool Yes, int Amount, string? Why)[] stakes) => new()
        {
            Title = title,
            Description = description,
            Category = category,
            ResolvesOn = new DateOnly(year, 12, 31),
            CreatedBy = createdBy,
            CreatedAt = now.AddDays(-Random.Shared.Next(5, 400)),
            Stakes = stakes.Select(s => new Stake
            {
                PlayerName = s.Name,
                OnYes = s.Yes,
                Amount = s.Amount,
                Reasoning = s.Why,
                PlacedAt = now.AddDays(-Random.Shared.Next(0, 60)),
            }).ToList(),
        };

        db.Bets.AddRange(
            NewBet("Et dansk tog ankommer til tiden en hel uge i træk",
                "Alle afgange, hele landet, mandag til søndag. Sporarbejde tæller ikke som undskyldning.",
                BetCategory.Samfund, 2040, "PerronPeter",
                ("PerronPeter", true, 250, "Jeg er optimist. Og jeg har ingen bil."),
                ("Skinne-Søs", false, 900, "Jeg har en månedskort-erfaring på 14 år."),
                ("AnonymPendler", false, 400, null)),

            NewBet("Mindst én person læser et sæt vilkår og betingelser til ende",
                "Skal bevises med eyetracking og et notariseret vidne.",
                BetCategory.Hverdag, 2035, "JuristJens",
                ("JuristJens", true, 50, "Det var mig. Jeg er ved side 412."),
                ("ScrollSkipper", false, 1200, "Jeg har klikket 'Accepter' 30.000 gange uden at blinke.")),

            NewBet("Mennesker sætter fod på Mars, før printeren på kontoret virker første gang",
                "Printeren i 3. sal, gangen ved kaffemaskinen. I ved godt hvilken.",
                BetCategory.Kosmos, 2045, "RaketRikke",
                ("RaketRikke", true, 700, "Raketter er nemmere end printerdrivere."),
                ("IT-Ib", false, 300, "Jeg har bestilt en tekniker. Han kommer i næste uge."),
                ("Toner-Tove", true, 450, null)),

            NewBet("Danmark vinder Eurovision igen inden 2035",
                "Vi har prøvet med ballader, med sømænd og med en mand i en kæmpe hat. Næste gang virker det.",
                BetCategory.Samfund, 2035, "SchlagerSanne",
                ("SchlagerSanne", true, 600, "Fly on the Wings of Love 2.0 er klar."),
                ("Douze-Dennis", false, 650, null)),

            NewBet("En AI skriver en roman, som min onkel faktisk læser færdig",
                "Onklen har ikke læst en bog siden 1998. Han har dog læst mange kædebreve.",
                BetCategory.Teknologi, 2030, "NevøNiklas",
                ("NevøNiklas", true, 150, "Hvis den handler om fiskeri, er han solgt."),
                ("Onkel Ole", false, 2000, "Jeg ved, hvem der har lavet det her bet.")),

            NewBet("Et dansk herrelandshold i fodbold vinder en EM-finale igen",
                "1992 tæller ikke længere, og vi skal ikke have flere sommerferier aflyst i sidste øjeblik.",
                BetCategory.Sport, 2036, "Roligan-Rasmus",
                ("Roligan-Rasmus", true, 1000, "Jeg har allerede købt flaget."),
                ("RealistRie", false, 800, null),
                ("Sofatræner", true, 200, "Hvis bare de havde lyttet til mig.")),

            NewBet("Nogen finder ud af, hvad der står i fællesskabets kagekalender",
                "Kalenderen hænger på køleskabet, men ingen har nogensinde set den opdateret.",
                BetCategory.Hverdag, 2028, "KageKarl",
                ("KageKarl", true, 80, null),
                ("Kantine-Kirsten", false, 120, "Det står der intet. Det har aldrig stået noget.")),

            NewBet("Det bliver hvid jul i København mindst tre år i træk",
                "Slud tæller ikke. Sne på en bil i Hellerup tæller heller ikke.",
                BetCategory.Kosmos, 2040, "Vejr-Vibeke",
                ("Vejr-Vibeke", false, 500, "Jeg har set prognoserne. Og vinduet."),
                ("Nisse-Nis", true, 350, "Troen kan flytte lavtryk."))
        );

        db.SaveChanges();
    }
}
