using LongBets.Data;
using LongBets.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LongBets.Controllers;

public class BetsController(AppDbContext db) : Controller
{
    public async Task<IActionResult> Index(BetCategory? category, string sort = "hot")
    {
        var query = db.Bets.AsNoTracking().Include(b => b.Stakes).AsQueryable();
        if (category is not null) query = query.Where(b => b.Category == category);

        var cards = (await query.ToListAsync()).Select(BetCard.From);
        cards = sort switch
        {
            "new" => cards.OrderByDescending(c => c.Bet.CreatedAt),
            "soon" => cards.OrderBy(c => c.Bet.ResolvesOn),
            "longshot" => cards.OrderByDescending(c => Math.Max(c.YesOdds, c.NoOdds)),
            _ => cards.OrderByDescending(c => c.TotalPool),
        };

        return View(new BetListViewModel { Bets = cards.ToList(), Category = category, Sort = sort });
    }

    public async Task<IActionResult> Details(int id)
    {
        var bet = await LoadBet(id);
        if (bet is null) return NotFound();

        return View(new BetDetailsViewModel { Card = BetCard.From(bet), NewStake = new Stake { BetId = id, Amount = 100, OnYes = true } });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> PlaceStake(int id, [Bind(nameof(Stake.PlayerName), nameof(Stake.OnYes), nameof(Stake.Amount), nameof(Stake.Reasoning), Prefix = "NewStake")] Stake stake)
    {
        var bet = await LoadBet(id);
        if (bet is null) return NotFound();

        if (bet.Outcome != BetOutcome.Open)
            ModelState.AddModelError("", "Det her bet er afgjort. Man kan ikke satse på fortiden, det hedder bagklogskab.");

        if (!ModelState.IsValid)
            return View(nameof(Details), new BetDetailsViewModel { Card = BetCard.From(bet), NewStake = stake });

        db.Stakes.Add(new Stake
        {
            BetId = id,
            PlayerName = stake.PlayerName.Trim(),
            OnYes = stake.OnYes,
            Amount = stake.Amount,
            Reasoning = string.IsNullOrWhiteSpace(stake.Reasoning) ? null : stake.Reasoning.Trim(),
        });
        await db.SaveChangesAsync();

        TempData["Toast"] = $"{stake.Amount:N0} Pralkroner sat {(stake.OnYes ? "PÅ" : "IMOD")}. Held og lykke. Du får brug for det.";
        return RedirectToAction(nameof(Details), new { id });
    }

    [HttpGet]
    public IActionResult Create() => View(new Bet { ResolvesOn = DateOnly.FromDateTime(DateTime.Today.AddYears(10)) });

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create([Bind(nameof(Bet.Title), nameof(Bet.Description), nameof(Bet.Category), nameof(Bet.ResolvesOn), nameof(Bet.CreatedBy))] Bet bet)
    {
        if (bet.ResolvesOn < DateOnly.FromDateTime(DateTime.Today.AddYears(1)))
            ModelState.AddModelError(nameof(Bet.ResolvesOn), "Det her er LongBets. Mindst ét år ude i fremtiden, tak. Kortsigtet tænkning hører hjemme på børsen.");

        if (!ModelState.IsValid) return View(bet);

        bet.CreatedAt = DateTime.UtcNow;
        bet.Outcome = BetOutcome.Open;
        db.Bets.Add(bet);
        await db.SaveChangesAsync();

        TempData["Toast"] = "Dit bet er live. Fremtiden er hermed varslet.";
        return RedirectToAction(nameof(Details), new { id = bet.Id });
    }

    private Task<Bet?> LoadBet(int id) => db.Bets.AsNoTracking()
        .Include(b => b.Stakes.OrderByDescending(s => s.PlacedAt))
        .FirstOrDefaultAsync(b => b.Id == id);
}
