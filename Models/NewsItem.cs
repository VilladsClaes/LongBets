namespace LongBets.Models;

public class NewsItem
{
    public int Id { get; set; }

    /// <summary>Id på kilden i <see cref="News.NewsSources"/>, fx "dr".</summary>
    public string Source { get; set; } = "";

    public string Title { get; set; } = "";
    public string Url { get; set; } = "";
    public string? Summary { get; set; }

    public DateTime? PublishedAt { get; set; }
    public DateTime FetchedAt { get; set; }

    /// <summary>Tidspunktet nyheden sorteres efter: udgivelse, ellers første gang vi så den.</summary>
    public DateTime SortTime => PublishedAt ?? FetchedAt;
}

public static class NewsItemExtensions
{
    /// <summary>
    /// Ritzau-telegrammer bringes ordret af flere medier. Vis kun den første udgave af hver overskrift.
    /// </summary>
    public static IEnumerable<NewsItem> DistinctStories(this IEnumerable<NewsItem> items) =>
        items.DistinctBy(n => new string(n.Title.Where(char.IsLetterOrDigit).ToArray()).ToLowerInvariant());
}

/// <summary>Seneste hentning pr. kilde, så admin kan se om et feed er gået i stykker.</summary>
public class FeedState
{
    public string Source { get; set; } = "";
    public DateTime LastFetch { get; set; }
    public bool Ok { get; set; }
    public int Count { get; set; }
    public string? Error { get; set; }
}
