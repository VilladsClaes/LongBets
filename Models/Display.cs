namespace LongBets.Models;

/// <summary>Små formateringshjælpere til views.</summary>
public static class Display
{
    public static string Icon(this BetCategory category) => category switch
    {
        BetCategory.Samfund => "🏛️",
        BetCategory.Teknologi => "🤖",
        BetCategory.Sport => "⚽",
        BetCategory.Hverdag => "☕",
        BetCategory.Kosmos => "🚀",
        _ => "🎲",
    };

    public static string Odds(this decimal odds) => odds.ToString("0.00");

    public static string Countdown(this DateOnly resolvesOn)
    {
        var days = resolvesOn.DayNumber - DateOnly.FromDateTime(DateTime.Today).DayNumber;
        if (days <= 0) return "Afgøres nu (formentlig)";
        if (days < 60) return $"{days} dage tilbage";
        var years = days / 365.25;
        return years < 1 ? $"{days / 30} måneder tilbage" : $"{years:0.#} år tilbage";
    }

    public static string TimeAgo(this DateTime utc)
    {
        var ago = DateTime.UtcNow - utc;
        if (ago < TimeSpan.FromMinutes(1)) return "lige nu";
        if (ago < TimeSpan.FromHours(1)) return $"for {(int)ago.TotalMinutes} min. siden";
        if (ago < TimeSpan.FromHours(24)) return $"for {(int)ago.TotalHours} t. siden";
        var days = (int)ago.TotalDays;
        return days == 1 ? "i går" : $"for {days} dage siden";
    }

    /// <summary>Satirisk mærkat til kortene, alt efter hvor vildt odds ser ud.</summary>
    public static string? Badge(this BetCard card) => card switch
    {
        { TotalPool: >= 2000 } => "🔥 Hot",
        _ when Math.Max(card.YesOdds, card.NoOdds) >= 3.5m => "🎯 Langskud",
        { StakeCount: <= 2 } => "🦗 Fårekyllinger",
        _ => null,
    };
}
