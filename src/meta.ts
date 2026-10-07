const UA = "Mozilla/5.0 (compatible; LongBets/1.0)";
const MAX_BYTES = 400_000;

export interface LinkMeta {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  site: string | null;
  error?: string;
}

const FORBIDDEN_HOST = /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[::1\])/i;

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i")) ?? tag.match(new RegExp(`${name}\\s*=\\s*'([^']*)'`, "i"));
  return m ? m[1] : null;
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)));
}

function metaContent(html: string, key: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:property|name)\\s*=\\s*["']${key}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  if (!tag) return null;
  const c = attr(tag, "content");
  return c ? decode(c).trim() || null : null;
}

/** Hent titel, beskrivelse og billede fra det link brugeren indsætter. */
export async function fetchLinkMeta(rawUrl: string): Promise<LinkMeta> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return { url: rawUrl, title: null, description: null, image: null, site: null, error: "Det ligner ikke et gyldigt link." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { url: rawUrl, title: null, description: null, image: null, site: null, error: "Kun http- og https-links må bruges." };
  }
  if (url.username || url.password || FORBIDDEN_HOST.test(url.hostname)) {
    return { url: rawUrl, title: null, description: null, image: null, site: null, error: "Det link må jeg ikke hente." };
  }

  try {
    const res = await fetch(url.toString(), {
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(9000),
      redirect: "follow",
    });
    if (!res.ok) return { url: url.toString(), title: null, description: null, image: null, site: url.hostname.replace(/^www\./, ""), error: `Svarede ${res.status}.` };

    const text = (await res.text()).slice(0, MAX_BYTES);
    const head = text.slice(0, 20000);
    const title =
      metaContent(head, "og:title") ??
      (head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ? decode(head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)![1]).trim() : null) ??
      null;
    const description =
      metaContent(head, "og:description") ?? metaContent(head, "description") ?? metaContent(head, "twitter:description");
    let image = metaContent(head, "og:image") ?? metaContent(head, "twitter:image") ?? metaContent(head, "og:image:secure_url");
    if (image) {
      try {
        image = new URL(image, res.url || url).toString();
      } catch {
        image = null;
      }
    }
    const site = metaContent(head, "og:site_name") ?? url.hostname.replace(/^www\./, "");
    return { url: res.url || url.toString(), title, description, image, site };
  } catch (err) {
    return {
      url: url.toString(),
      title: null,
      description: null,
      image: null,
      site: url.hostname.replace(/^www\./, ""),
      error: err instanceof Error ? `Kunne ikke hente siden (${err.message}).` : "Kunne ikke hente siden.",
    };
  }
}
