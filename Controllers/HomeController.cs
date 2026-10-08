using LongBets.Data;
using LongBets.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LongBets.Controllers;

public class HomeController(AppDbContext db) : Controller
{
    public async Task<IActionResult> Index()
    {
        var bets = await db.Bets.AsNoTracking()
            .Where(b => b.Outcome == BetOutcome.Open)
            .Include(b => b.Stakes)
            .ToListAsync();

        var ticker = await db.Stakes.AsNoTracking()
            .OrderByDescending(s => s.PlacedAt)
            .Take(12)
            .Select(s => new TickerItem(s.PlayerName, s.Amount, s.OnYes, s.Bet!.Title, s.BetId))
            .ToListAsync();

        var braggarts = await db.Stakes.AsNoTracking()
            .GroupBy(s => s.PlayerName)
            .Select(g => new { Name = g.Key, Total = g.Sum(s => s.Amount), Count = g.Count() })
            .OrderByDescending(g => g.Total)
            .Take(5)
            .Select(g => new Braggart(g.Name, g.Total, g.Count))
            .ToListAsync();

        var model = new HomeViewModel
        {
            Featured = bets.Select(BetCard.From).OrderByDescending(c => c.TotalPool).Take(6).ToList(),
            Ticker = ticker,
            Braggarts = braggarts,
            TotalBets = bets.Count,
            TotalPool = bets.Sum(b => b.Stakes.Sum(s => s.Amount)),
            TotalPlayers = await db.Stakes.Select(s => s.PlayerName).Distinct().CountAsync(),
        };
        return View(model);
    }

    [HttpGet]
    public IActionResult Contact() => View(new ContactMessage());

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Contact([Bind(nameof(ContactMessage.Name), nameof(ContactMessage.Email), nameof(ContactMessage.Message))] ContactMessage contact)
    {
        if (!ModelState.IsValid) return View(contact);

        contact.SentAt = DateTime.UtcNow;
        db.ContactMessages.Add(contact);
        await db.SaveChangesAsync();

        TempData["Toast"] = "Beskeden er modtaget og lagt i bunken med de andre.";
        return RedirectToAction(nameof(Contact));
    }

    public IActionResult Responsible() => View();

    public IActionResult Error(int? statusCode)
    {
        ViewBag.StatusCode = statusCode ?? 500;
        return View();
    }
}
