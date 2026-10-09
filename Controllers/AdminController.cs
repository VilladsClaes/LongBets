using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using LongBets.Data;
using LongBets.Models;
using LongBets.News;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace LongBets.Controllers;

[Authorize(AuthenticationSchemes = Scheme)]
public class AdminController(AppDbContext db, IConfiguration config, NewsRefreshService refresher) : Controller
{
    /// <summary>Admin har sin egen cookie med én fælles adgangskode, adskilt fra spillernes Google-login.</summary>
    public const string Scheme = "Admin";
    public async Task<IActionResult> Index()
    {
        var bets = await db.Bets.AsNoTracking().Include(b => b.Stakes).ToListAsync();
        var messages = await db.ContactMessages.AsNoTracking().OrderByDescending(m => m.SentAt).ToListAsync();

        return View(new AdminViewModel
        {
            Open = bets.Where(b => b.Outcome == BetOutcome.Open).OrderBy(b => b.ResolvesOn).Select(BetCard.From).ToList(),
            Resolved = bets.Where(b => b.Outcome != BetOutcome.Open).OrderByDescending(b => b.ResolvedAt).Select(BetCard.From).ToList(),
            Messages = messages,
            Feeds = await db.FeedStates.AsNoTracking().ToListAsync(),
            NewsCount = await db.NewsItems.CountAsync(),
        });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Resolve(int id, BetOutcome outcome, string? note)
    {
        var bet = await db.Bets.Include(b => b.Stakes).FirstOrDefaultAsync(b => b.Id == id);
        if (bet is null) return NotFound();

        await using (var tx = await db.Database.BeginTransactionAsync())
        {
            await Settlement.ApplyAsync(db, bet, outcome, note);
            await db.SaveChangesAsync();
            await tx.CommitAsync();
        }

        TempData["Toast"] = outcome switch
        {
            BetOutcome.Yes => $"Afgjort: PÅ vandt »{bet.Title}«.",
            BetOutcome.No => $"Afgjort: IMOD vandt »{bet.Title}«.",
            BetOutcome.Void => $"»{bet.Title}« er annulleret. Alle får indsatsen retur.",
            _ => $"»{bet.Title}« er genåbnet.",
        };
        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public IActionResult RefreshNews()
    {
        refresher.Wake();
        TempData["Toast"] = "Nyhederne hentes nu. Genindlæs siden om lidt.";
        return RedirectToAction(nameof(Index), null, "nyheder");
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> DeleteBet(int id)
    {
        var bet = await db.Bets.Include(b => b.Stakes).FirstOrDefaultAsync(b => b.Id == id);
        if (bet is null) return NotFound();

        await using (var tx = await db.Database.BeginTransactionAsync())
        {
            // Et åbent bet slettes som en annullering: spillerne får deres indsats retur.
            if (bet.Outcome == BetOutcome.Open) await Settlement.ApplyAsync(db, bet, BetOutcome.Void, null);
            db.Bets.Remove(bet);
            await db.SaveChangesAsync();
            await tx.CommitAsync();
        }

        TempData["Toast"] = $"»{bet.Title}« er slettet sammen med alle indsatser.";
        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ToggleRead(int id)
    {
        var message = await db.ContactMessages.FindAsync(id);
        if (message is null) return NotFound();

        message.IsRead = !message.IsRead;
        await db.SaveChangesAsync();
        return RedirectToAction(nameof(Index), null, "beskeder");
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> DeleteMessage(int id)
    {
        var message = await db.ContactMessages.FindAsync(id);
        if (message is null) return NotFound();

        db.ContactMessages.Remove(message);
        await db.SaveChangesAsync();

        TempData["Toast"] = "Beskeden er slettet.";
        return RedirectToAction(nameof(Index), null, "beskeder");
    }

    [AllowAnonymous]
    [HttpGet]
    public IActionResult Login(string? returnUrl)
    {
        ViewBag.ReturnUrl = returnUrl;
        ViewBag.Disabled = string.IsNullOrEmpty(config["Admin:Password"]);
        return View();
    }

    [AllowAnonymous]
    [HttpPost]
    [ValidateAntiForgeryToken]
    [EnableRateLimiting("login")]
    public async Task<IActionResult> Login(string password, string? returnUrl)
    {
        var expected = config["Admin:Password"];
        ViewBag.ReturnUrl = returnUrl;
        ViewBag.Disabled = string.IsNullOrEmpty(expected);

        if (string.IsNullOrEmpty(expected) || !PasswordMatches(password ?? "", expected))
        {
            ModelState.AddModelError("", "Forkert adgangskode. Sneglen har noteret forsøget.");
            return View();
        }

        var identity = new ClaimsIdentity([new Claim(ClaimTypes.Name, "admin")], Scheme);
        await HttpContext.SignInAsync(Scheme, new ClaimsPrincipal(identity));

        return Url.IsLocalUrl(returnUrl) ? Redirect(returnUrl) : RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(Scheme);
        return RedirectToAction("Index", "Home");
    }

    // Sammenligner hashes i konstant tid, så svartiden ikke afslører noget om adgangskoden.
    private static bool PasswordMatches(string given, string expected) =>
        CryptographicOperations.FixedTimeEquals(
            SHA256.HashData(Encoding.UTF8.GetBytes(given)),
            SHA256.HashData(Encoding.UTF8.GetBytes(expected)));
}
