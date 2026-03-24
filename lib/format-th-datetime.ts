/**
 * Stable Thai date/time formatting for SSR + client hydration.
 * Avoid bare `toLocaleString()` — server default locale/TZ often differs from the browser.
 * ใช้ปฏิทินพุทธ (พ.ศ.) ให้สอดคล้องทั้งจอ — ค่าเก็บในระบบยังเป็น ISO / YYYY-MM-DD (ค.ศ.) ตามเดิม
 */

const TH_LOCALE = "th-TH"
const TH_TZ = "Asia/Bangkok"

/** พ.ศ. ผ่าน Intl (fallback ถ้า runtime ไม่รองรับ calendar) */
const BUDDHIST: Intl.DateTimeFormatOptions = {
  timeZone: TH_TZ,
  calendar: "buddhist",
  year: "numeric",
  month: "short",
  day: "numeric",
}

const dateTimeOpts: Intl.DateTimeFormatOptions = {
  ...BUDDHIST,
  hour: "2-digit",
  minute: "2-digit",
}

const dateOnlyOpts: Intl.DateTimeFormatOptions = BUDDHIST

function formatWithBuddhistFallback(d: Date, opts: Intl.DateTimeFormatOptions): string {
  try {
    return new Intl.DateTimeFormat(TH_LOCALE, opts).format(d)
  } catch {
    return new Intl.DateTimeFormat(TH_LOCALE, { ...opts, calendar: undefined }).format(d)
  }
}

export function formatThDateTime(iso: string | null | undefined): string {
  if (iso == null || iso === "") return "—"
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return String(iso)
  return formatWithBuddhistFallback(new Date(iso), dateTimeOpts)
}

/** Calendar date from `YYYY-MM-DD` (equipment_calibration_date, etc.) — แสดง พ.ศ. */
export function formatThDateFromYMD(ymd: string | null | undefined): string {
  if (ymd == null || ymd === "") return "—"
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd
  const [y, mo, d] = ymd.split("-").map(Number)
  if (!y || !mo || !d) return ymd
  const utc = Date.UTC(y, mo - 1, d, 12, 0, 0)
  return formatWithBuddhistFallback(new Date(utc), dateOnlyOpts)
}

/**
 * ข้อความใต้ `<input type="date">` — ค่าใน input ยังเป็น ค.ศ.; บอก พ.ศ. ให้ตรงกับที่แสดงในรายการ
 */
export function thDateInputBeHint(ymd: string | null | undefined): string {
  if (ymd == null || ymd === "" || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    return "เลือกวันที่ (ปฏิทินเบราว์เซอร์เป็น ค.ศ.)"
  }
  return `ตรงกับ ${formatThDateFromYMD(ymd)}`
}
