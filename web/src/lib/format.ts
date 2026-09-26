const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("it-IT");
const rtf = new Intl.RelativeTimeFormat("it", { numeric: "auto" });
const dateFmt = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric" });

export const fmtCompact = (n: number | null | undefined) => (n == null ? "—" : compact.format(n));
export const fmtFull = (n: number | null | undefined) => (n == null ? "—" : full.format(n));
export const fmtDate = (iso?: string | null) => (iso ? dateFmt.format(new Date(iso)) : "");

export function fmtAgo(iso?: string | null): string {
  if (!iso) return "";
  const s = (new Date(iso).getTime() - Date.now()) / 1000;
  const abs = Math.abs(s);
  if (abs < 45) return "adesso";
  if (abs < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(s / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(s / 86400), "day");
  return fmtDate(iso);
}

export function fmtDuration(fromIso?: string, toIso?: string): string {
  if (!fromIso) return "";
  const ms = (toIso ? new Date(toIso).getTime() : Date.now()) - new Date(fromIso).getTime();
  const m = Math.max(0, Math.round(ms / 60000));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

/** "https://instagram.com/foo/?hl=it", "@foo", "foo" -> "foo" */
export function parseUsername(input: string): string | null {
  let s = input.trim();
  const m = s.match(/instagram\.com\/([^/?#\s]+)/i);
  if (m) s = m[1];
  s = s.replace(/^@/, "").replace(/\/+$/, "");
  if (["p", "reel", "reels", "stories", "explore"].includes(s.toLowerCase())) return null;
  return /^[A-Za-z0-9._]{1,30}$/.test(s) ? s.toLowerCase() : null;
}
