using LongBets.Data;
using LongBets.Models;
using Microsoft.EntityFrameworkCore;

namespace LongBets.News;

public record SourceResult(string Source, bool Ok, int Count, string? Error);

/// <summary>Henter alle nyhedskilder og gemmer nye historier i databasen.</summary>
public class NewsImporter(IHttpClientFactory httpFactory, AppDbContext db, ILogger<NewsImporter> logger)
{
    public const string HttpClientName = "news";

    /// <summary>Nyheder ældre end dette fjernes igen. Bets gemmer selv titel og link, så de overlever.</summary>
    private static readonly TimeSpan KeepFor = TimeSpan.FromDays(7);

    public async Task<List<SourceResult>> ImportAllAsync(CancellationToken ct)
    {
        // Hent parallelt, men gem bagefter i én tråd: DbContext må ikke deles mellem tråde.
        var fetched = await Task.WhenAll(NewsSources.All.Select(s => FetchAsync(s, ct)));

        var now = DateTime.UtcNow;
        var results = new List<SourceResult>();
        foreach (var (source, items, error) in fetched)
        {
            var count = error is null ? await StoreAsync(source, items!, now, ct) : 0;
            results.Add(new SourceResult(source.Id, error is null, items?.Count ?? 0, error));
            await SaveStateAsync(source.Id, now, error, items?.Count ?? 0, ct);
            if (error is null)
                logger.LogInformation("Nyheder fra {Source}: {Count} i feedet, {New} nye", source.Name, items!.Count, count);
            else
                logger.LogWarning("Nyheder fra {Source} fejlede: {Error}", source.Name, error);
        }

        await db.NewsItems.Where(n => n.FetchedAt < now - KeepFor).ExecuteDeleteAsync(ct);
        return results;
    }

    private async Task<(NewsSource Source, List<ParsedNews>? Items, string? Error)> FetchAsync(NewsSource source, CancellationToken ct)
    {
        try
        {
            using var http = httpFactory.CreateClient(HttpClientName);
            var feeds = await Task.WhenAll(source.Urls.Select(url => http.GetStringAsync(url, ct)));
            var items = feeds
                .SelectMany(body => FeedParser.Parse(source.Kind, body))
                .DistinctBy(n => n.Url)
                .OrderByDescending(n => n.PublishedAt ?? DateTime.MinValue)
                .Take(30)
                .ToList();
            return (source, items, null);
        }
        catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
        {
            return (source, null, ex.Message.Length > 200 ? ex.Message[..200] : ex.Message);
        }
    }

    private async Task<int> StoreAsync(NewsSource source, List<ParsedNews> items, DateTime now, CancellationToken ct)
    {
        var urls = items.Select(i => i.Url).ToList();
        var existing = await db.NewsItems.Where(n => urls.Contains(n.Url)).ToDictionaryAsync(n => n.Url, ct);

        var added = 0;
        foreach (var item in items)
        {
            if (existing.TryGetValue(item.Url, out var known))
            {
                // Medierne retter ofte overskriften løbende.
                known.Title = Truncate(item.Title, 300);
                known.Summary = item.Summary ?? known.Summary;
                known.PublishedAt ??= item.PublishedAt;
                known.FetchedAt = now;
                continue;
            }

            db.NewsItems.Add(new NewsItem
            {
                Source = source.Id,
                Title = Truncate(item.Title, 300),
                Url = item.Url,
                Summary = item.Summary,
                // Fremtidige datoer (forkerte tidszoner) vil ellers ligge øverst i flere timer.
                PublishedAt = item.PublishedAt > now ? now : item.PublishedAt,
                FetchedAt = now,
            });
            added++;
        }

        await db.SaveChangesAsync(ct);
        return added;
    }

    private async Task SaveStateAsync(string source, DateTime now, string? error, int count, CancellationToken ct)
    {
        var state = await db.FeedStates.FindAsync([source], ct);
        if (state is null)
        {
            state = new FeedState { Source = source };
            db.FeedStates.Add(state);
        }

        state.LastFetch = now;
        state.Ok = error is null;
        state.Count = count;
        state.Error = error;
        await db.SaveChangesAsync(ct);
    }

    private static string Truncate(string s, int max) => s.Length <= max ? s : s[..max];
}
