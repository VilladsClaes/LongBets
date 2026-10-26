using LongBets.Data;
using LongBets.Models;
using LongBets.News;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LongBets.Controllers;

public class NewsController(AppDbContext db, NewsRefreshService refresher) : Controller
{
    public async Task<IActionResult> Index(string? source)
    {
        refresher.RequestRefreshIfStale();

        if (NewsSources.Find(source) is null) source = null;

        var query = db.NewsItems.AsNoTracking();
        if (source is not null) query = query.Where(n => n.Source == source);

        var items = (await query
            .OrderByDescending(n => n.PublishedAt ?? n.FetchedAt)
            .Take(150)
            .ToListAsync())
            .DistinctStories()
            .Take(80)
            .ToList();

        // Hvor mange bets der allerede er lavet på hver nyhed.
        var urls = items.Select(n => n.Url).ToList();
        var betCounts = await db.Bets.AsNoTracking()
            .Where(b => b.NewsUrl != null && urls.Contains(b.NewsUrl))
            .GroupBy(b => b.NewsUrl!)
            .Select(g => new { Url = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Url, x => x.Count);

        return View(new NewsListViewModel
        {
            Items = items,
            Source = source,
            BetCounts = betCounts,
            LastUpdate = await db.FeedStates.Select(s => (DateTime?)s.LastFetch).MaxAsync(),
        });
    }
}
