namespace LongBets.Models;

public record BetCard(Bet Bet, decimal YesOdds, decimal NoOdds, int YesPercent, int TotalPool, int StakeCount)
{
    public static BetCard From(Bet bet)
    {
        var (yesOdds, noOdds) = OddsCalculator.Odds(bet.Stakes);
        var (yes, no) = OddsCalculator.Pools(bet.Stakes);
        return new BetCard(bet, yesOdds, noOdds, OddsCalculator.YesPercent(bet.Stakes), yes + no, bet.Stakes.Count);
    }
}

public record TickerItem(string PlayerName, int Amount, bool OnYes, string BetTitle, int BetId);

public record Braggart(string PlayerName, int TotalStaked, int BetCount);

public class HomeViewModel
{
    public required List<BetCard> Featured { get; init; }
    public required List<TickerItem> Ticker { get; init; }
    public required List<NewsItem> News { get; init; }
    public required List<Braggart> Braggarts { get; init; }
    public int TotalBets { get; init; }
    public int TotalPool { get; init; }
    public int TotalPlayers { get; init; }
}

public class BetListViewModel
{
    public required List<BetCard> Bets { get; init; }
    public BetCategory? Category { get; init; }
    public string Sort { get; init; } = "hot";
    public string? NewsUrl { get; init; }
}

public class AdminViewModel
{
    public required List<BetCard> Open { get; init; }
    public required List<BetCard> Resolved { get; init; }
    public required List<ContactMessage> Messages { get; init; }
    public required List<FeedState> Feeds { get; init; }
    public int NewsCount { get; init; }
}

public class NewsListViewModel
{
    public required List<NewsItem> Items { get; init; }
    public string? Source { get; init; }
    public required Dictionary<string, int> BetCounts { get; init; }
    public DateTime? LastUpdate { get; init; }
}
public class BetDetailsViewModel
{
    public required BetCard Card { get; init; }
    public required Stake NewStake { get; init; }

    /// <summary>Den besøgendes egen vindende indsats, så de kan skrive »Jeg fik ret fordi …«.</summary>
    public Stake? OwnWinningStake { get; init; }
}

/// <summary>En af spillerens egne indsatser med bettets aktuelle odds.</summary>
public record MyStake(Stake Stake, BetCard Card)
{
    /// <summary>Gevinst minus indsats, når bettet er afgjort.</summary>
    public int? Net => Stake.Payout is int payout ? payout - Stake.Amount : null;

    /// <summary>Hvad indsatsen giver, hvis den vinder med de odds, der gælder nu.</summary>
    public int PotentialPayout => Data.Settlement.Payout(Stake.Amount, Stake.OnYes ? Card.YesOdds : Card.NoOdds);
}

public class MyBetsViewModel
{
    public required Player Player { get; init; }
    public required List<MyStake> Stakes { get; init; }
    public required List<BetCard> Created { get; init; }

    public IEnumerable<MyStake> Open => Stakes.Where(s => s.Stake.Bet!.Outcome == BetOutcome.Open);
    public IEnumerable<MyStake> Resolved => Stakes.Where(s => s.Stake.Bet!.Outcome != BetOutcome.Open);
    public int AtStake => Open.Sum(s => s.Stake.Amount);
    public int NetResult => Resolved.Sum(s => s.Net ?? 0);
}
