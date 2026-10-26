using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.RegularExpressions;

namespace LongBets.News;

public record LinkMeta(string Url, string Site, string? Title, string? Description, string? Image);

/// <summary>
/// Henter titel, beskrivelse og billede (Open Graph) fra et link, som en bruger indsætter,
/// når de opretter et bet. Kun offentlige adresser: forbindelser til localhost og private net afvises.
/// </summary>
public partial class LinkPreview(IHttpClientFactory httpFactory, ILogger<LinkPreview> logger)
{
    public const string HttpClientName = "link-preview";
    private const int MaxBytes = 400_000;

    public async Task<(LinkMeta? Meta, string? Error)> FetchAsync(string? raw, CancellationToken ct)
    {
        if (!TryParse(raw, out var url, out var error)) return (null, error);

        try
        {
            using var http = httpFactory.CreateClient(HttpClientName);
            using var response = await http.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, ct);
            var finalUrl = response.RequestMessage?.RequestUri ?? url;
            if (!response.IsSuccessStatusCode) return (null, $"Siden svarede {(int)response.StatusCode}.");

            var html = await ReadLimitedAsync(response, ct);
            var title = Meta(html, "og:title") ?? TitleTag(html);
            var description = Meta(html, "og:description") ?? Meta(html, "description") ?? Meta(html, "twitter:description");
            var image = Meta(html, "og:image") ?? Meta(html, "twitter:image");
            if (image is not null)
                image = Uri.TryCreate(finalUrl, image, out var abs) && abs.Scheme == Uri.UriSchemeHttps ? abs.ToString() : null;

            return (new LinkMeta(finalUrl.ToString(), SiteOf(finalUrl), Clip(title, 300), Clip(description, 1000), image), null);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            // HttpClient pakker fejl fra ConnectCallback ind i en HttpRequestException.
            if (ex.InnerException is BlockedAddressException) return (null, "Det link må vi ikke hente.");
            logger.LogInformation(ex, "Kunne ikke hente {Url}", url);
            return (null, "Kunne ikke hente siden.");
        }
    }

    /// <summary>Kun http(s) uden brugernavn/adgangskode i adressen.</summary>
    public static bool TryParse(string? raw, out Uri url, out string? error)
    {
        url = null!;
        error = null;
        if (!Uri.TryCreate(raw?.Trim(), UriKind.Absolute, out var parsed) || (parsed.Scheme != Uri.UriSchemeHttp && parsed.Scheme != Uri.UriSchemeHttps))
        {
            error = "Det ligner ikke et gyldigt link (det skal starte med https://).";
            return false;
        }
        if (!string.IsNullOrEmpty(parsed.UserInfo) || parsed.OriginalString.Length > 1000)
        {
            error = "Det link må vi ikke hente.";
            return false;
        }
        url = parsed;
        return true;
    }

    /// <summary>Værtsnavnet uden www., højst 30 tegn, så det passer i <c>Bet.NewsSource</c>.</summary>
    public static string SiteOf(Uri url)
    {
        var host = url.Host.StartsWith("www.", StringComparison.OrdinalIgnoreCase) ? url.Host[4..] : url.Host;
        return host.Length > 30 ? host[..30] : host;
    }

    /// <summary>
    /// Bruges som ConnectCallback på HttpClienten: slår navnet op og nægter at forbinde til
    /// ikke-offentlige adresser. Det gælder også efter redirects og ved DNS-rebinding.
    /// </summary>
    public static async ValueTask<Stream> ConnectToPublicAddress(SocketsHttpConnectionContext context, CancellationToken ct)
    {
        var addresses = await Dns.GetHostAddressesAsync(context.DnsEndPoint.Host, ct);
        var target = addresses.FirstOrDefault(IsPublic) ?? throw new BlockedAddressException();

        var socket = new Socket(SocketType.Stream, ProtocolType.Tcp) { NoDelay = true };
        try
        {
            await socket.ConnectAsync(new IPEndPoint(target, context.DnsEndPoint.Port), ct);
            return new NetworkStream(socket, ownsSocket: true);
        }
        catch
        {
            socket.Dispose();
            throw;
        }
    }

    public static bool IsPublic(IPAddress ip)
    {
        if (ip.IsIPv4MappedToIPv6) ip = ip.MapToIPv4();
        if (IPAddress.IsLoopback(ip) || ip.Equals(IPAddress.Any) || ip.Equals(IPAddress.IPv6None)) return false;

        if (ip.AddressFamily == AddressFamily.InterNetwork)
        {
            var b = ip.GetAddressBytes();
            return !(b[0] == 0 || b[0] == 10 || b[0] == 127 || b[0] >= 224
                || (b[0] == 100 && b[1] >= 64 && b[1] <= 127)   // carrier-grade NAT
                || (b[0] == 169 && b[1] == 254)                 // link-local, cloud-metadata
                || (b[0] == 172 && b[1] >= 16 && b[1] <= 31)
                || (b[0] == 192 && b[1] == 168)
                || (b[0] == 192 && b[1] == 0 && b[2] == 0)
                || (b[0] == 198 && (b[1] == 18 || b[1] == 19)));
        }

        var first = ip.GetAddressBytes()[0];
        return !(ip.IsIPv6LinkLocal || ip.IsIPv6SiteLocal || ip.IsIPv6Multicast || (first & 0xFE) == 0xFC);
    }

    private static async Task<string> ReadLimitedAsync(HttpResponseMessage response, CancellationToken ct)
    {
        await using var stream = await response.Content.ReadAsStreamAsync(ct);
        var buffer = new byte[MaxBytes];
        int total = 0, read;
        while (total < MaxBytes && (read = await stream.ReadAsync(buffer.AsMemory(total), ct)) > 0) total += read;
        return Encoding.UTF8.GetString(buffer, 0, total);
    }

    private static string? Meta(string html, string key)
    {
        foreach (Match tag in MetaTag().Matches(html))
        {
            var name = Attr(tag.Value, "property") ?? Attr(tag.Value, "name");
            if (string.Equals(name, key, StringComparison.OrdinalIgnoreCase))
                return Attr(tag.Value, "content") is { } content && content.Trim().Length > 0 ? WebUtility.HtmlDecode(content).Trim() : null;
        }
        return null;
    }

    private static string? Attr(string tag, string name)
    {
        var m = Regex.Match(tag, $@"\b{name}\s*=\s*(?:""([^""]*)""|'([^']*)')", RegexOptions.IgnoreCase);
        return m.Success ? (m.Groups[1].Success ? m.Groups[1].Value : m.Groups[2].Value) : null;
    }

    private static string? TitleTag(string html)
    {
        var m = TitleElement().Match(html);
        return m.Success ? WebUtility.HtmlDecode(m.Groups[1].Value).Trim() : null;
    }

    private static string? Clip(string? text, int max)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        text = Regex.Replace(text, @"\s+", " ").Trim();
        return text.Length > max ? text[..(max - 1)] + "…" : text;
    }

    [GeneratedRegex(@"<meta\b[^>]*>", RegexOptions.IgnoreCase)]
    private static partial Regex MetaTag();

    [GeneratedRegex(@"<title[^>]*>([\s\S]*?)</title>", RegexOptions.IgnoreCase)]
    private static partial Regex TitleElement();

    private sealed class BlockedAddressException() : Exception("Adressen er ikke offentlig.");
}
