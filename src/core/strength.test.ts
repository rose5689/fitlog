import { describe, expect, it } from 'vitest'
import {
  dailyStrengthSeries,
  dailyVolumeSeries,
  markPRs,
  weeklySlope,
  type StrengthSetLike,
} from './strength'

const s = (date: string, weightKg: number, reps: number): StrengthSetLike => ({
  date,
  weightKg,
  reps,
})

describe('dailyStrengthSeries', () => {
  const sets: StrengthSetLike[] = [
    s('2026-10-01', 60, 8),
    s('2026-10-01', 70, 5),
    s('2026-10-01', 72, 3),
    s('2026-10-08', 75, 5),
    s('2026-10-08', 68, 8),
    s('2026-10-15', 0, 10), // 自重，忽略
    s('2026-10-15', 30, 12),
  ]

  it('最重一组：每日取最大重量，忽略自重', () => {
    const out = dailyStrengthSeries(sets, 'top')
    expect(out.map((p) => [p.date, p.value])).toEqual([
      ['2026-10-01', 72],
      ['2026-10-08', 75],
      ['2026-10-15', 30],
    ])
  })

  it('e1RM：每日取最大 Epley 估算值', () => {
    const out = dailyStrengthSeries(sets, 'e1rm')
    // 10-01: 60×(1+8/30)=76, 70×(1+5/30)=81.67, 72×(1+3/30)=79.2 → 81.67
    // 10-08: 68×(1+8/30)=86.13, 75×(1+5/30)=87.5 → 87.5
    // 10-15: 30×(1+12/30)=42
    expect(out.map((p) => [p.date, p.value])).toEqual([
      ['2026-10-01', 81.67],
      ['2026-10-08', 87.5],
      ['2026-10-15', 42],
    ])
  })

  it('指定 RM：只取次数 ≥ N 的组，无匹配组则不出点', () => {
    const out = dailyStrengthSeries(sets, 'rm', 5)
    expect(out.map((p) => [p.date, p.value])).toEqual([
      ['2026-10-01', 70],
      ['2026-10-08', 75],
      ['2026-10-15', 30],
    ])
    const onlyTriples = dailyStrengthSeries([s('2026-10-01', 72, 3)], 'rm', 5)
    expect(onlyTriples).toEqual([])
  })

  it('结果按日期升序', () => {
    const out = dailyStrengthSeries(
      [s('2026-10-20', 80, 5), s('2026-10-02', 60, 5)],
      'top',
    )
    expect(out[0].date).toBe('2026-10-02')
  })
})

describe('dailyVolumeSeries', () => {
  it('按日汇总 Σ(重量 × 次数)，忽略自重', () => {
    const out = dailyVolumeSeries([
      s('2026-10-01', 60, 8),
      s('2026-10-01', 70, 5),
      s('2026-10-01', 0, 12),
      s('2026-10-08', 75, 5),
    ])
    expect(out).toEqual([
      { date: '2026-10-01', value: 830, setCount: 2 },
      { date: '2026-10-08', value: 375, setCount: 1 },
    ])
  })

  it('全是自重的训练日不出点', () => {
    expect(dailyVolumeSeries([s('2026-10-01', 0, 10)])).toEqual([])
  })
})

describe('markPRs', () => {
  it('只在刷新历史最高时标记', () => {
    const points = [
      { date: '2026-10-01', value: 80, sets: [] },
      { date: '2026-10-08', value: 78, sets: [] },
      { date: '2026-10-15', value: 85, sets: [] },
      { date: '2026-10-22', value: 85, sets: [] },
    ]
    expect(markPRs(points).map((p) => p.isPR)).toEqual([true, false, true, false])
  })
})

describe('weeklySlope', () => {
  it('线性上升时按周折算', () => {
    expect(
      weeklySlope([
        { date: '2026-10-01', value: 80 },
        { date: '2026-10-08', value: 82 },
        { date: '2026-10-15', value: 84 },
      ]),
    ).toBe(2)
  })

  it('数据不足时返回 0', () => {
    expect(weeklySlope([{ date: '2026-10-01', value: 80 }])).toBe(0)
    expect(weeklySlope([])).toBe(0)
    expect(
      weeklySlope([
        { date: '2026-10-01', value: 80 },
        { date: '2026-10-01', value: 90 },
      ]),
    ).toBe(0)
  })
})
