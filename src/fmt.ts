const MAANEDER = [
  "januar", "februar", "marts", "april", "maj", "juni",
  "juli", "august", "september", "oktober", "november", "december",
];

export function krBelob(n: number): string {
  return `${new Intl.NumberFormat("da-DK").format(n)} kr.`;
}

export function kr(n: number): string {
  return krBelob(n).replace(/\.$/, "");
}

export function tal(n: number): string {
  return new Intl.NumberFormat("da-DK").format(n);
}

export function dato(iso: string | null): string {
  if (!iso) return "ukendt dato";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "ukendt dato";
  return `${d.getDate()}. ${MAANEDER[d.getMonth()]} ${d.getFullYear()}`;
}

export function klokkeslet(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function tidsiden(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "";
  const s = Math.max(0, Math.floor((Date.now() - d) / 1000));
  if (s < 60) return "lige nu";
  const m = Math.floor(s / 60);
  if (m < 60) return `for ${m} min. siden`;
  const h = Math.floor(m / 60);
  if (h < 24) return `for ${h} t. siden`;
  const days = Math.floor(h / 24);
  if (days === 1) return "i går";
  if (days < 7) return `for ${days} dage siden`;
  return dato(iso);
}

export function uddrag(text: string | null, max = 200): string {
  if (!text) return "";
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max).replace(/\s+\S*$/, "") + " …";
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9æøå]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
