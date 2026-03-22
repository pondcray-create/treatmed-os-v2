/**
 * Stable Thai date/time formatting for SSR + client hydration.
 * Avoid bare `toLocaleString()` — server default locale/TZ often differs from the browser.
 */

const TH_LOCALE = "th-TH"
const TH_TZ = "Asia/Bangkok"

const dateTimeOpts: Intl.DateTimeFormatOptions = {
  timeZone: TH_TZ,
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
}

const dateOnlyOpts: Intl.DateTimeFormatOptions = {
  timeZone: TH_TZ,
  day: "numeric",
  month: "short",
  year: "numeric",
}

export function formatThDateTime(iso: string | null | undefined): string {
  if (iso == null || iso === "") return "—"
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return String(iso)
  return new Date(iso).toLocaleString(TH_LOCALE, dateTimeOpts)
}

/** Calendar date from `YYYY-MM-DD` (equipment_calibration_date, etc.) */
export function formatThDateFromYMD(ymd: string | null | undefined): string {
  if (ymd == null || ymd === "") return "—"
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd
  const [y, mo, d] = ymd.split("-").map(Number)
  if (!y || !mo || !d) return ymd
  const utc = Date.UTC(y, mo - 1, d, 12, 0, 0)
  return new Date(utc).toLocaleDateString(TH_LOCALE, dateOnlyOpts)
}
