using System.Globalization;
using System.Net;
using System.Text.RegularExpressions;
using System.Xml;
using System.Xml.Linq;

namespace LongBets.News;

public record ParsedNews(string Title, string Url, string? Summary, DateTime? PublishedAt);

/// <summary>Læser RSS, Atom og Google News-sitemaps til en fælles form.</summary>
public static partial class FeedParser
{
    // Sitemaps har flere hundrede artikler. Uden loft ville BT og Berlingske fylde hele forsiden.
    private const int MaxItems = 20;

    public static List<ParsedNews> Parse(FeedKind kind, string xml)
    {
        var doc = Load(xml);
        var items = kind == FeedKind.NewsSitemap ? ParseSitemap(doc) : ParseRss(doc);
        return items
            .Where(n => n.Title.Length >= 5 && IsWebUrl(n.Url))
            .DistinctBy(n => n.Url)
            .OrderByDescending(n => n.PublishedAt ?? DateTime.MinValue)
            .Take(MaxItems)
            .ToList();
    }

    private static XDocument Load(string xml)
    {
        // DTD'er slås fra, så et feed ikke kan få os til at hente eksterne filer (XXE).
        var settings = new XmlReaderSettings { DtdProcessing = DtdProcessing.Ignore, XmlResolver = null };
        using var reader = XmlReader.Create(new StringReader(xml), settings);
        return XDocument.Load(reader);
    }

    private static IEnumerable<ParsedNews> ParseRss(XDocument doc)
    {
        foreach (var item in doc.Descendants().Where(e => e.Name.LocalName is "item" or "entry"))
        {
            var title = CleanText(Child(item, "title"));
            var link = Child(item, "link")?.Trim();
            if (string.IsNullOrEmpty(link))
            {
                // Atom: <link href="..." rel="alternate" />
                link = item.Elements().Where(e => e.Name.LocalName == "link")
                    .Select(e => (string?)e.Attribute("href"))
                    .FirstOrDefault(h => !string.IsNullOrEmpty(h));
            }

            var summary = CleanText(Child(item, "description") ?? Child(item, "summary"));
            var published = ParseDate(Child(item, "pubDate") ?? Child(item, "published") ?? Child(item, "updated") ?? Child(item, "date"));

            if (title is not null && link is not null)
                yield return new ParsedNews(title, link, Shorten(summary), published);
        }
    }

    private static IEnumerable<ParsedNews> ParseSitemap(XDocument doc)
    {
        foreach (var url in doc.Descendants().Where(e => e.Name.LocalName == "url"))
        {
            var news = url.Elements().FirstOrDefault(e => e.Name.LocalName == "news");
            var loc = Child(url, "loc")?.Trim();
            var title = CleanText(news is null ? null : Child(news, "title"));
            var published = ParseDate(news is null ? null : Child(news, "publication_date"));

            if (title is not null && loc is not null)
                yield return new ParsedNews(title, loc, null, published);
        }
    }

    private static string? Child(XElement parent, string localName) =>
        parent.Elements().FirstOrDefault(e => e.Name.LocalName == localName)?.Value;

    private static DateTime? ParseDate(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        raw = raw.Trim();
        // RSS bruger RFC 822 ("Thu, 08 Oct 2026 09:20:00 GMT"), sitemaps og Atom bruger ISO 8601.
        if (DateTimeOffset.TryParse(raw, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var dto))
            return dto.UtcDateTime;
        // Nogle feeds skriver tidszonen som "+0200" eller "CEST", som .NET ikke kender.
        var withoutZone = TrailingZone().Replace(raw, "");
        return DateTimeOffset.TryParse(withoutZone, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out dto)
            ? dto.UtcDateTime
            : null;
    }

    private static string? CleanText(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var text = WebUtility.HtmlDecode(Tags().Replace(raw, " "));
        text = Whitespace().Replace(text, " ").Trim();
        return text.Length == 0 ? null : text;
    }

    private static string? Shorten(string? text, int max = 240)
    {
        if (text is null || text.Length <= max) return text;
        var cut = text[..max];
        var space = cut.LastIndexOf(' ');
        return (space > max / 2 ? cut[..space] : cut) + " …";
    }

    private static bool IsWebUrl(string url) =>
        Uri.TryCreate(url, UriKind.Absolute, out var uri) && (uri.Scheme == Uri.UriSchemeHttps || uri.Scheme == Uri.UriSchemeHttp);

    [GeneratedRegex("<[^>]*>")]
    private static partial Regex Tags();

    [GeneratedRegex(@"\s+")]
    private static partial Regex Whitespace();

    [GeneratedRegex(@"\s+([A-Z]{2,5}|[+-]\d{4})$")]
    private static partial Regex TrailingZone();
}
