/** 本地时区日期工具，日期一律 YYYY-MM-DD 字符串 */

export function todayStr(): string {
  return toDateStr(new Date())
}

export function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseDateStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(s: string, days: number): string {
  const d = parseDateStr(s)
  d.setDate(d.getDate() + days)
  return toDateStr(d)
}

/** 本周周一的日期（周为自然周，周一为一周开始） */
export function weekStart(s: string): string {
  const d = parseDateStr(s)
  const dow = d.getDay() // 0=周日
  const diff = dow === 0 ? -6 : 1 - dow
  return addDays(s, diff)
}

/** 生成从 start（含）到 end（含）的日期数组 */
export function dateRange(start: string, end: string): string[] {
  const out: string[] = []
  let cur = start
  while (cur <= end) {
    out.push(cur)
    cur = addDays(cur, 1)
  }
  return out
}

/** YYYY-MM-DD → "M/D" 短显示 */
export function shortDate(s: string): string {
  const [, m, d] = s.split('-')
  return `${Number(m)}/${Number(d)}`
}

/** 星期显示 */
export function weekdayLabel(s: string): string {
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][parseDateStr(s).getDay()]
}
