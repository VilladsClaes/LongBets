namespace LongBets.News;

public enum FeedKind
{
    /// <summary>RSS 2.0 eller Atom.</summary>
    Rss,

    /// <summary>Google News-sitemap (&lt;url&gt; med &lt;news:news&gt;).</summary>
    NewsSitemap,
}

public record NewsSource(string Id, string Name, string Color, FeedKind Kind, params string[] Urls);

public static class NewsSources
{
    // Alle feeds er afprøvet 8. oktober 2026. Hvis et medie ændrer adresse, kan det ses på admin-siden.
    public static readonly IReadOnlyList<NewsSource> All =
    [
        // DR's "senestenyt" er kun Kort nyt-sektionen, så vi fletter sektionsfeedene.
        new("dr", "DR", "#e01e2f", FeedKind.Rss,
            "https://www.dr.dk/nyheder/service/feeds/indland",
            "https://www.dr.dk/nyheder/service/feeds/udland",
            "https://www.dr.dk/nyheder/service/feeds/politik",
            "https://www.dr.dk/nyheder/service/feeds/senestenyt"),
        new("politiken", "Politiken", "#c8102e", FeedKind.Rss, "https://politiken.dk/rss/senestenyt.rss"),
        new("berlingske", "Berlingske", "#3a6ea5", FeedKind.NewsSitemap, "https://www.berlingske.dk/news-sitemap.xml"),
        new("bt", "BT", "#0072ce", FeedKind.NewsSitemap, "https://bt.dk/news-sitemap.xml"),
        new("jp", "Jyllands-Posten", "#8a8f99", FeedKind.Rss, "https://feeds.jp.dk/jp/topnyheder"),
        new("information", "Information", "#e67e22", FeedKind.Rss, "https://www.information.dk/feed"),
        new("altinget", "Altinget", "#8e5cc7", FeedKind.Rss, "https://www.altinget.dk/rss"),
        new("ekstrabladet", "Ekstra Bladet", "#ffd400", FeedKind.Rss, "https://ekstrabladet.dk/rssfeed/all/"),
    ];

    public static NewsSource? Find(string? id) => All.FirstOrDefault(s => s.Id == id);

    public static string NameOf(string? id) => Find(id)?.Name ?? id ?? "";
}
