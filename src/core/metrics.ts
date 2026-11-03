/**
 * FitLog 核心计算模块（纯函数，可单测）
 * 指标口径见 docs/SCHEMA.md
 */

export interface SetLike {
  weightKg: number
  reps: number
}

/** 单组容量 = 重量 × 次数（自重 weight=0 不计入容量） */
export function setVolume(s: SetLike): number {
  return s.weightKg * s.reps
}

/** 训练容量 = Σ(重量 × 次数) */
export function totalVolume(sets: SetLike[]): number {
  return round2(sets.reduce((acc, s) => acc + setVolume(s), 0))
}

/** 总组数 */
export function totalSets(sets: SetLike[]): number {
  return sets.length
}

/** 总次数 = Σ reps */
export function totalReps(sets: SetLike[]): number {
  return sets.reduce((acc, s) => acc + s.reps, 0)
}

/** Epley 估算 1RM：weight × (1 + reps/30)；reps=1 时等于重量 */
export function epleyE1RM(weightKg: number, reps: number): number {
  if (reps <= 0) return 0
  if (reps === 1) return round2(weightKg)
  return round2(weightKg * (1 + reps / 30))
}

/** 最大重量（仅 weight>0 的组参与） */
export function maxWeight(sets: SetLike[]): number {
  const positive = sets.filter((s) => s.weightKg > 0).map((s) => s.weightKg)
  return positive.length ? Math.max(...positive) : 0
}

export interface PRRecord {
  date: string
  weightKg: number
  reps: number
  e1RM: number
}

/**
 * 计算某动作的 PR 历史：某组 e1RM 或重量刷新历史最高时记为 PR。
 * 输入需按时间升序排列（每组带日期）。
 */
export function computePRs(
  sets: Array<SetLike & { date: string }>,
): PRRecord[] {
  const prs: PRRecord[] = []
  let bestE1RM = 0
  let bestWeight = 0
  for (const s of sets) {
    if (s.weightKg <= 0) continue
    const e = epleyE1RM(s.weightKg, s.reps)
    if (e > bestE1RM || s.weightKg > bestWeight) {
      prs.push({ date: s.date, weightKg: s.weightKg, reps: s.reps, e1RM: e })
      bestE1RM = Math.max(bestE1RM, e)
      bestWeight = Math.max(bestWeight, s.weightKg)
    }
  }
  return prs
}

/**
 * 动作 e1RM 趋势：按日期聚合，每日取当日所有组的最大 e1RM。
 * 输入需按日期升序排列。
 */
export function e1RMTrendByDate(
  sets: Array<SetLike & { date: string }>,
): Array<{ date: string; e1RM: number }> {
  const byDate = new Map<string, number>()
  for (const s of sets) {
    if (s.weightKg <= 0) continue
    const e = epleyE1RM(s.weightKg, s.reps)
    const cur = byDate.get(s.date)
    if (cur === undefined || e > cur) byDate.set(s.date, e)
  }
  return [...byDate.entries()].map(([date, e1RM]) => ({ date, e1RM }))
}

export interface NutritionLike {
  kcal: number
  carbsG: number
  proteinG: number
  fatG: number
}

/** 日营养汇总 */
export function sumNutrition(entries: NutritionLike[]): NutritionLike & { count: number } {
  return {
    count: entries.length,
    kcal: round1(entries.reduce((a, e) => a + e.kcal, 0)),
    carbsG: round1(entries.reduce((a, e) => a + e.carbsG, 0)),
    proteinG: round1(entries.reduce((a, e) => a + e.proteinG, 0)),
    fatG: round1(entries.reduce((a, e) => a + e.fatG, 0)),
  }
}

/** 达成率 = 实际/目标 × 100%，上限 150% */
export function achievementRate(actual: number, target: number): number {
  if (target <= 0) return 0
  return Math.min(150, Math.round((actual / target) * 100))
}

export interface WeightRecord {
  date: string
  weightKg: number
}

/**
 * 体重 7 日移动平均：第 D 天 = 最近 7 天（D-6..D）内有记录的体重算术平均。
 * 输入按日期升序；记录不足 7 天按已有天数平均，≥1 条才出点。
 */
export function weight7dMA(
  records: WeightRecord[],
): Array<{ date: string; value: number }> {
  const sorted = [...records].sort((a, b) => (a.date < b.date ? -1 : 1))
  const out: Array<{ date: string; value: number }> = []
  for (let i = 0; i < sorted.length; i++) {
    const end = sorted[i]
    const cutoffIdx = sorted.findIndex((r) => daysBetween(r.date, end.date) <= 6)
    const window = sorted.slice(cutoffIdx, i + 1)
    const avg = window.reduce((a, r) => a + r.weightKg, 0) / window.length
    out.push({ date: end.date, value: round2(avg) })
  }
  return out
}

/** 每周体重变化：本周日均 − 上周日均（基于 7 日均线值再按周分组平均） */
export function weeklyWeightChange(
  records: WeightRecord[],
  weekStartDate: string,
): number {
  const ma = weight7dMA(records)
  if (ma.length === 0) return 0
  const inWeek = (d: string, ws: string) => d >= ws && d <= shiftDate(ws, 6)
  const thisWeek = ma.filter((p) => inWeek(p.date, weekStartDate))
  const lastWeek = ma.filter((p) => inWeek(p.date, shiftDate(weekStartDate, -7)))
  if (thisWeek.length === 0 || lastWeek.length === 0) return 0
  const avg = (arr: Array<{ value: number }>) =>
    arr.reduce((a, p) => a + p.value, 0) / arr.length
  return round2(avg(thisWeek) - avg(lastWeek))
}

export interface DailyTotals {
  date: string
  kcal: number
  carbsG: number
  proteinG: number
  fatG: number
}

/** 按日聚合营养（用于趋势图），输入含 date 字段 */
export function nutritionTrendByDate(
  entries: Array<NutritionLike & { date: string }>,
): DailyTotals[] {
  const map = new Map<string, DailyTotals>()
  for (const e of entries) {
    let t = map.get(e.date)
    if (!t) {
      t = { date: e.date, kcal: 0, carbsG: 0, proteinG: 0, fatG: 0 }
      map.set(e.date, t)
    }
    t.kcal += e.kcal
    t.carbsG += e.carbsG
    t.proteinG += e.proteinG
    t.fatG += e.fatG
  }
  return [...map.values()]
    .map((t) => ({
      ...t,
      kcal: round1(t.kcal),
      carbsG: round1(t.carbsG),
      proteinG: round1(t.proteinG),
      fatG: round1(t.fatG),
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
}

// ---------- 内部工具 ----------

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/** 两个 YYYY-MM-DD 之间的天数差（b - a） */
function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T00:00:00') - Date.parse(a + 'T00:00:00')) / 86400000)
}

function shiftDate(s: string, days: number): string {
  const d = new Date(s + 'T00:00:00')
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}
