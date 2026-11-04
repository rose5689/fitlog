/**
 * 力量曲线核心计算（纯函数，可单测）
 * 口径定义见 docs/STRENGTH.md（最重一组 / e1RM / 指定 RM）
 */
import { epleyE1RM } from './metrics'

export type StrengthMode = 'top' | 'e1rm' | 'rm'

export const STRENGTH_MODE_LABELS: Record<StrengthMode, string> = {
  top: '最重一组',
  e1rm: 'e1RM',
  rm: '指定 RM',
}

export interface StrengthSetLike {
  date: string
  weightKg: number
  reps: number
}

export interface StrengthPoint {
  date: string
  /** 该日按口径聚合后的值 */
  value: number
  /** 该日该动作的全部组，用于 tooltip / 明细展示 */
  sets: StrengthSetLike[]
}

export interface StrengthPointWithPR extends StrengthPoint {
  /** 是否刷新了历史最高（以传入的完整序列判断） */
  isPR: boolean
}

/**
 * 按训练日聚合力量曲线数据。
 *
 * - top：当日 weightKg 最大的一组
 * - e1rm：当日各组的最大 Epley 估算 1RM
 * - rm：当日「次数 ≥ rm」的组里最重的重量；该日无匹配组则不出点
 *
 * 自重（weightKg = 0）的组一律忽略。
 * 返回按日期升序排列，一个训练日一个点。
 */
export function dailyStrengthSeries(
  sets: StrengthSetLike[],
  mode: StrengthMode,
  rm = 5,
): StrengthPoint[] {
  const byDate = new Map<string, StrengthSetLike[]>()
  for (const s of sets) {
    if (s.weightKg <= 0) continue
    const list = byDate.get(s.date)
    if (list) list.push(s)
    else byDate.set(s.date, [s])
  }

  const points: StrengthPoint[] = []
  for (const [date, daySets] of byDate) {
    const value = dayValue(daySets, mode, rm)
    if (value === null) continue
    points.push({ date, value, sets: daySets })
  }
  return points.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

function dayValue(
  daySets: StrengthSetLike[],
  mode: StrengthMode,
  rm: number,
): number | null {
  if (mode === 'rm') {
    const qualified = daySets.filter((s) => s.reps >= rm)
    if (qualified.length === 0) return null
    return round2(Math.max(...qualified.map((s) => s.weightKg)))
  }
  if (mode === 'e1rm') {
    return round2(Math.max(...daySets.map((s) => epleyE1RM(s.weightKg, s.reps))))
  }
  return round2(Math.max(...daySets.map((s) => s.weightKg)))
}

/**
 * 按训练日聚合训练容量：Σ(重量 × 次数)。
 * 自重（weightKg = 0）的组不计入容量，若某日全是自重则不出点。
 * 返回按日期升序。
 */
export function dailyVolumeSeries(
  sets: StrengthSetLike[],
): Array<{ date: string; value: number; setCount: number }> {
  const byDate = new Map<string, { value: number; setCount: number }>()
  for (const s of sets) {
    if (s.weightKg <= 0) continue
    const cur = byDate.get(s.date) ?? { value: 0, setCount: 0 }
    cur.value += s.weightKg * s.reps
    cur.setCount += 1
    byDate.set(s.date, cur)
  }
  return [...byDate.entries()]
    .map(([date, v]) => ({ date, value: round2(v.value), setCount: v.setCount }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

/** 标记刷新历史最高的点（输入需日期升序） */
export function markPRs(points: StrengthPoint[]): StrengthPointWithPR[] {
  let best = 0
  return points.map((p) => {
    const isPR = p.value > best
    if (isPR) best = p.value
    return { ...p, isPR }
  })
}

/**
 * 线性回归斜率换算为「每周变化量」（kg/周）。
 * 少于 2 个点或所有点同一天时返回 0。
 */
export function weeklySlope(
  points: Array<{ date: string; value: number }>,
): number {
  if (points.length < 2) return 0
  const base = points[0].date
  const xs = points.map((p) => daysBetween(base, p.date))
  const ys = points.map((p) => p.value)
  const n = xs.length
  const meanX = xs.reduce((a, v) => a + v, 0) / n
  const meanY = ys.reduce((a, v) => a + v, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY)
    den += (xs[i] - meanX) ** 2
  }
  if (den === 0) return 0
  return round2((num / den) * 7)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (Date.parse(b + 'T00:00:00') - Date.parse(a + 'T00:00:00')) / 86400000,
  )
}
