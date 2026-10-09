namespace LongBets.Models;

/// <summary>
/// Totalisator-odds: puljen deles mellem vinderne. Huset tager 0 %, fordi vi ikke har en bankkonto.
/// </summary>
public static class OddsCalculator
{
    // Fiktive startpenge på hver side, så odds ikke er uendelige, før nogen har satset.
    private const int HouseSeed = 100;

    public static (int Yes, int No) Pools(IEnumerable<Stake> stakes)
    {
        int yes = 0, no = 0;
        foreach (var s in stakes)
        {
            if (s.OnYes) yes += s.Amount; else no += s.Amount;
        }
        return (yes, no);
    }

    public static (decimal Yes, decimal No) Odds(IEnumerable<Stake> stakes)
    {
        var (yes, no) = Pools(stakes);
        decimal yesPool = yes + HouseSeed, noPool = no + HouseSeed, total = yesPool + noPool;
        return (Math.Round(total / yesPool, 2), Math.Round(total / noPool, 2));
    }

    /// <summary>Andel af puljen, der tror på påstanden, 0–100.</summary>
    public static int YesPercent(IEnumerable<Stake> stakes)
    {
        var (yes, no) = Pools(stakes);
        return yes + no == 0 ? 50 : (int)Math.Round(100m * yes / (yes + no));
    }
}
