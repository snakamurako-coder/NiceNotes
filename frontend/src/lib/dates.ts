/** Local calendar date as YYYY-MM-DD (Asia/Tokyo or TZ-aware via toLocaleDateString en-CA). */
export function todayYmd(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: undefined })
}

export function parseYmd(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return Number.isNaN(dt.getTime()) ? null : dt
}
