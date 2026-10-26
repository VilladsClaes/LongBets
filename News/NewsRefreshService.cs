using LongBets.Data;
using Microsoft.EntityFrameworkCore;

namespace LongBets.News;

/// <summary>
/// Henter nyheder ved opstart og derefter hvert tiende minut.
/// IIS på webhotellet lukker appen ned, når ingen besøger den. Derfor kan en sidevisning
/// også vække tjenesten med <see cref="RequestRefreshIfStale"/>, når nyhederne er for gamle.
/// </summary>
public class NewsRefreshService(IServiceScopeFactory scopes, IConfiguration config, ILogger<NewsRefreshService> logger) : BackgroundService
{
    private readonly SemaphoreSlim _wake = new(0, 1);
    private DateTime _lastRun = DateTime.MinValue;

    private TimeSpan Interval => TimeSpan.FromMinutes(Math.Max(1, config.GetValue("News:IntervalMinutes", 10)));

    public bool Enabled => config.GetValue("News:Enabled", true);

    public DateTime LastRun => _lastRun;

    /// <summary>Vækker tjenesten, hvis seneste hentning er ældre end intervallet. Venter ikke på den.</summary>
    public void RequestRefreshIfStale()
    {
        if (Enabled && DateTime.UtcNow - _lastRun > Interval) Wake();
    }

    /// <summary>Starter en hentning med det samme (bruges fra admin).</summary>
    public void Wake()
    {
        // Er der allerede et signal i kø, er det nok.
        if (_wake.CurrentCount == 0)
        {
            try { _wake.Release(); } catch (SemaphoreFullException) { }
        }
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!Enabled)
        {
            logger.LogInformation("Nyhedsimport er slået fra (News:Enabled = false)");
            return;
        }

        _lastRun = await LastFetchFromDbAsync(stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            var due = _lastRun + Interval - DateTime.UtcNow;
            if (due > TimeSpan.Zero)
            {
                try { await _wake.WaitAsync(due, stoppingToken); }
                catch (OperationCanceledException) { break; }
            }

            // Sættes før hentningen, så sidevisninger undervejs ikke sætter en ekstra hentning i kø.
            _lastRun = DateTime.UtcNow;
            try
            {
                using var scope = scopes.CreateScope();
                await scope.ServiceProvider.GetRequiredService<NewsImporter>().ImportAllAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Nyhedsimport fejlede");
            }
        }
    }

    private async Task<DateTime> LastFetchFromDbAsync(CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var last = await db.FeedStates.Select(s => (DateTime?)s.LastFetch).MaxAsync(ct);
        return last ?? DateTime.MinValue;
    }
}
