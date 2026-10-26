using LongBets.Models;
using Microsoft.EntityFrameworkCore;

namespace LongBets.Data;

/// <summary>Afgør et bet og flytter Pralkronerne. Odds er de samme, som kuponen viste.</summary>
public static class Settlement
{
    /// <summary>
    /// Sætter udfaldet og udbetaler til spillerne. En tidligere afgørelse tilbageføres først,
    /// så admin kan genåbne og rette en fejl. Kaldes med bettets indsatser indlæst og i en transaktion.
    /// </summary>
    public static async Task ApplyAsync(AppDbContext db, Bet bet, BetOutcome outcome, string? note)
    {
        foreach (var stake in bet.Stakes.Where(s => s.UserId is not null && s.Payout is > 0))
            await AddToBalance(db, stake.UserId!, -stake.Payout!.Value);

        bet.Outcome = outcome;
        bet.ResolvedAt = outcome == BetOutcome.Open ? null : DateTime.UtcNow;
        bet.ResolutionNote = outcome != BetOutcome.Open && note?.Trim() is { Length: > 0 } text ? text[..Math.Min(text.Length, 1000)] : null;

        var (yesOdds, noOdds) = OddsCalculator.Odds(bet.Stakes);
        foreach (var stake in bet.Stakes)
        {
            stake.Payout = outcome switch
            {
                BetOutcome.Open => null,
                BetOutcome.Void => stake.Amount,
                BetOutcome.Yes => stake.OnYes ? Payout(stake.Amount, yesOdds) : 0,
                BetOutcome.No => stake.OnYes ? 0 : Payout(stake.Amount, noOdds),
                _ => null,
            };
            if (stake.UserId is not null && stake.Payout is > 0)
                await AddToBalance(db, stake.UserId, stake.Payout.Value);
        }
    }

    public static int Payout(int amount, decimal odds) => (int)Math.Round(amount * odds, MidpointRounding.AwayFromZero);

    private static Task<int> AddToBalance(AppDbContext db, string userId, int amount) =>
        db.Players.Where(p => p.UserId == userId)
            .ExecuteUpdateAsync(u => u.SetProperty(p => p.Balance, p => p.Balance + amount));
}
