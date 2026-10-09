using System.Security.Cryptography;
using LongBets.Data;
using LongBets.Models;
using LongBets.News;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace LongBets.Controllers;

public class BetsController(AppDbContext db, LinkPreview linkPreview) : Controller
{
    // Anonym spiller-id i en cookie. Kun en hash gemmes på indsatsen, så vinderen kan genkendes senere.
    private const string PlayerCookie = "LongBets.Player";

    public async Task<IActionResult> Index(BetCategory? category, string? news, string sort = "hot")
    {
        var query = db.Bets.AsNoTracking().Include(b => b.Stakes).AsQueryable();
        if (category is not null) query = query.Where(b => b.Category == category);
        if (!string.IsNullOrEmpty(news)) query = query.Where(b => b.NewsUrl == news);

        var cards = (await query.ToListAsync()).Select(BetCard.From);
        cards = sort switch
        {
            "new" => cards.OrderByDescending(c => c.Bet.CreatedAt),
            "soon" => cards.OrderBy(c => c.Bet.ResolvesOn),
            "longshot" => cards.OrderByDescending(c => Math.Max(c.YesOdds, c.NoOdds)),
            _ => cards.OrderByDescending(c => c.TotalPool),
        };

        return View(new BetListViewModel { Bets = cards.ToList(), Category = category, Sort = sort, NewsUrl = string.IsNullOrEmpty(news) ? null : news });
    }

    public async Task<IActionResult> Details(int id)
    {
        var bet = await LoadBet(id);
        if (bet is null) return NotFound();

        return View(DetailsModel(bet, new Stake { BetId = id, Amount = 100, OnYes = true }));
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
            return View(nameof(Details), DetailsModel(bet, stake));

        db.Stakes.Add(new Stake
        {
            BetId = id,
            PlayerName = stake.PlayerName.Trim(),
            OnYes = stake.OnYes,
            Amount = stake.Amount,
            Reasoning = string.IsNullOrWhiteSpace(stake.Reasoning) ? null : stake.Reasoning.Trim(),
            OwnerKey = PlayerKey(createIfMissing: true),
        });
        await db.SaveChangesAsync();

        TempData["Toast"] = $"{stake.Amount:N0} Pralkroner sat {(stake.OnYes ? "PÅ" : "IMOD")}. Held og lykke. Du får brug for det.";
        return RedirectToAction(nameof(Details), new { id });
    }

    /// <summary>Vinderen skriver »Jeg fik ret fordi …« på sin egen indsats.</summary>
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> WinNote(int id, string? note)
    {
        var bet = await LoadBet(id);
        if (bet is null) return NotFound();

        var winning = OwnWinningStake(bet);
        var text = note?.Trim() ?? "";
        if (winning is null)
            TempData["Toast"] = "Det er kun vinderne, der får lov at prale her.";
        else if (text.Length < 3)
            TempData["Toast"] = "Skriv lige, hvorfor du fik ret.";
        else
        {
            await db.Stakes.Where(s => s.Id == winning.Id)
                .ExecuteUpdateAsync(u => u.SetProperty(s => s.WinNote, text[..Math.Min(text.Length, 600)]));
            TempData["Toast"] = "Noteret. Det bliver hængende her, til nogen beviser det modsatte.";
        }
        return RedirectToAction(nameof(Details), new { id });
    }

    /// <summary>Titel, beskrivelse og billede fra et indsat link (bruges af opret-formularen).</summary>
    [HttpGet]
    [EnableRateLimiting("link")]
    public async Task<IActionResult> LinkMeta(string? url, CancellationToken ct)
    {
        var (meta, error) = await linkPreview.FetchAsync(url, ct);
        return Json(new { meta?.Url, meta?.Site, meta?.Title, meta?.Description, meta?.Image, error });
    }

    [HttpGet]
    public async Task<IActionResult> Create(int? newsId)
    {
        var news = newsId is null ? null : await db.NewsItems.AsNoTracking().FirstOrDefaultAsync(n => n.Id == newsId);
        ViewBag.News = news;
        return View(new Bet
        {
            ResolvesOn = DateOnly.FromDateTime(DateTime.Today.AddYears(news is null ? 10 : 1)),
            Category = BetCategory.Samfund,
        });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(int? newsId, string? link, [Bind(nameof(Bet.Title), nameof(Bet.Description), nameof(Bet.Category), nameof(Bet.ResolvesOn), nameof(Bet.CreatedBy))] Bet bet)
    {
        // Nyheden slås op i databasen i stedet for at stole på et link fra formularen.
        var news = newsId is null ? null : await db.NewsItems.AsNoTracking().FirstOrDefaultAsync(n => n.Id == newsId);

        if (bet.ResolvesOn < DateOnly.FromDateTime(DateTime.Today.AddYears(1)))
            ModelState.AddModelError(nameof(Bet.ResolvesOn), "Det her er LongBets. Mindst ét år ude i fremtiden, tak. Kortsigtet tænkning hører hjemme på børsen.");

        // Et indsat link hentes på serveren, så titlen og kilden ikke kan forfalskes fra formularen.
        LinkMeta? linked = null;
        if (news is null && !string.IsNullOrWhiteSpace(link))
        {
            (linked, var linkError) = await linkPreview.FetchAsync(link, HttpContext.RequestAborted);
            if (linkError is not null) ModelState.AddModelError("link", linkError);
        }

        if (!ModelState.IsValid)
        {
            ViewBag.News = news;
            ViewBag.Link = link;
            return View(bet);
        }

        bet.CreatedAt = DateTime.UtcNow;
        bet.Outcome = BetOutcome.Open;
        if (news is not null)
        {
            bet.NewsUrl = news.Url;
            bet.NewsTitle = news.Title;
            bet.NewsSource = news.Source;
        }
        else if (linked is not null)
        {
            bet.NewsUrl = linked.Url;
            bet.NewsTitle = linked.Title ?? linked.Site;
            bet.NewsSource = linked.Site;
        }
        db.Bets.Add(bet);
        await db.SaveChangesAsync();

        TempData["Toast"] = "Dit bet er live. Fremtiden er hermed varslet.";
        return RedirectToAction(nameof(Details), new { id = bet.Id });
    }

    private BetDetailsViewModel DetailsModel(Bet bet, Stake newStake) =>
        new() { Card = BetCard.From(bet), NewStake = newStake, OwnWinningStake = OwnWinningStake(bet) };

    /// <summary>Den besøgendes vindende indsats på et afgjort bet, hvis der er en.</summary>
    private Stake? OwnWinningStake(Bet bet)
    {
        if (bet.Outcome is not (BetOutcome.Yes or BetOutcome.No)) return null;
        var key = PlayerKey(createIfMissing: false);
        if (key is null) return null;
        var yesWon = bet.Outcome == BetOutcome.Yes;
        return bet.Stakes.Where(s => s.OwnerKey == key && s.OnYes == yesWon).OrderByDescending(s => s.Amount).FirstOrDefault();
    }

    private string? PlayerKey(bool createIfMissing)
    {
        var id = Request.Cookies[PlayerCookie];
        if (string.IsNullOrEmpty(id) || id.Length > 100)
        {
            if (!createIfMissing) return null;
            id = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
            Response.Cookies.Append(PlayerCookie, id, new CookieOptions
            {
                HttpOnly = true,
                IsEssential = true,
                SameSite = SameSiteMode.Lax,
                Secure = Request.IsHttps,
                Expires = DateTimeOffset.UtcNow.AddYears(5),
            });
        }
        return Convert.ToHexStringLower(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(id)));
    }

    private Task<Bet?> LoadBet(int id) => db.Bets.AsNoTracking()
        .Include(b => b.Stakes.OrderByDescending(s => s.PlacedAt))
        .FirstOrDefaultAsync(b => b.Id == id);
}
