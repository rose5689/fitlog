import { describe, expect, it } from 'vitest'
import {
  achievementRate,
  computePRs,
  e1RMTrendByDate,
  epleyE1RM,
  maxWeight,
  nutritionTrendByDate,
  setVolume,
  sumNutrition,
  totalReps,
  totalSets,
  totalVolume,
  weight7dMA,
  weeklyWeightChange,
} from './metrics'

describe('训练容量', () => {
  it('单组容量 = 重量 × 次数', () => {
    expect(setVolume({ weightKg: 60, reps: 8 })).toBe(480)
  })

  it('自重组（weight=0）不计入容量', () => {
    expect(setVolume({ weightKg: 0, reps: 20 })).toBe(0)
  })

  it('总容量 = Σ(重量×次数)，保留 2 位', () => {
    expect(
      totalVolume([
        { weightKg: 60, reps: 8 },
        { weightKg: 62.5, reps: 6 },
        { weightKg: 0, reps: 15 },
      ]),
    ).toBe(855)
  })

  it('总组数与总次数', () => {
    const sets = [
      { weightKg: 60, reps: 8 },
      { weightKg: 60, reps: 8 },
      { weightKg: 62.5, reps: 6 },
    ]
    expect(totalSets(sets)).toBe(3)
    expect(totalReps(sets)).toBe(22)
  })
})

describe('e1RM（Epley）', () => {
  it('reps=1 时等于重量', () => {
    expect(epleyE1RM(100, 1)).toBe(100)
  })

  it('Epley 公式：weight × (1 + reps/30)', () => {
    expect(epleyE1RM(100, 10)).toBeCloseTo(133.33, 1)
    expect(epleyE1RM(80, 5)).toBeCloseTo(93.33, 1)
  })

  it('reps=0 返回 0', () => {
    expect(epleyE1RM(100, 0)).toBe(0)
  })

  it('最大重量仅统计 weight>0 的组', () => {
    expect(
      maxWeight([
        { weightKg: 0, reps: 15 },
        { weightKg: 80, reps: 5 },
        { weightKg: 90, reps: 3 },
      ]),
    ).toBe(90)
    expect(maxWeight([{ weightKg: 0, reps: 10 }])).toBe(0)
  })
})

describe('PR 判定', () => {
  it('e1RM 刷新历史最高时记 PR，按时间升序', () => {
    const prs = computePRs([
      { date: '2026-10-01', weightKg: 80, reps: 5 }, // e1RM 93.33 PR
      { date: '2026-10-08', weightKg: 78, reps: 5 }, // e1RM 91 无 PR
      { date: '2026-10-15', weightKg: 85, reps: 5 }, // e1RM 99.17 PR
    ])
    expect(prs).toHaveLength(2)
    expect(prs[1].weightKg).toBe(85)
  })

  it('纯重量刷新也算 PR（大重量低次数）', () => {
    const prs = computePRs([
      { date: '2026-10-01', weightKg: 100, reps: 10 }, // e1RM 133.33
      { date: '2026-10-08', weightKg: 120, reps: 2 }, // e1RM 128 < 133.33，但重量 120 > 100 → PR
    ])
    expect(prs).toHaveLength(2)
    expect(prs[1].weightKg).toBe(120)
  })

  it('自重组不参与 PR', () => {
    expect(computePRs([{ date: '2026-10-01', weightKg: 0, reps: 20 }])).toHaveLength(0)
  })
})

describe('e1RM 趋势（按日聚合取最大）', () => {
  it('同日多组取最大 e1RM', () => {
    const trend = e1RMTrendByDate([
      { date: '2026-10-01', weightKg: 80, reps: 5 },
      { date: '2026-10-01', weightKg: 85, reps: 3 }, // e1RM 93.5
      { date: '2026-10-08', weightKg: 90, reps: 3 }, // e1RM 99
    ])
    expect(trend).toEqual([
      { date: '2026-10-01', e1RM: 93.5 },
      { date: '2026-10-08', e1RM: 99 },
    ])
  })
})

describe('营养汇总', () => {
  it('日汇总 = 各项求和', () => {
    const s = sumNutrition([
      { kcal: 500, carbsG: 60, proteinG: 30, fatG: 15 },
      { kcal: 700.55, carbsG: 80, proteinG: 40, fatG: 20.4 },
    ])
    expect(s.kcal).toBe(1200.6)
    expect(s.carbsG).toBe(140)
    expect(s.proteinG).toBe(70)
    expect(s.fatG).toBe(35.4)
    expect(s.count).toBe(2)
  })

  it('达成率上限 150%', () => {
    expect(achievementRate(1000, 2000)).toBe(50)
    expect(achievementRate(2400, 2000)).toBe(120)
    expect(achievementRate(5000, 2000)).toBe(150)
    expect(achievementRate(100, 0)).toBe(0)
  })
})

describe('营养趋势按日聚合', () => {
  it('跨日聚合并升序排列', () => {
    const trend = nutritionTrendByDate([
      { date: '2026-11-02', kcal: 1800, carbsG: 150, proteinG: 100, fatG: 50 },
      { date: '2026-11-01', kcal: 2000, carbsG: 200, proteinG: 120, fatG: 60 },
      { date: '2026-11-02', kcal: 200, carbsG: 20, proteinG: 10, fatG: 5 },
    ])
    expect(trend.map((t) => t.date)).toEqual(['2026-11-01', '2026-11-02'])
    expect(trend[1].kcal).toBe(2000)
  })
})

describe('体重 7 日移动平均', () => {
  it('按最近 7 天内有记录的天数平均', () => {
    const ma = weight7dMA([
      { date: '2026-10-01', weightKg: 80 },
      { date: '2026-10-02', weightKg: 81 },
      { date: '2026-10-09', weightKg: 82 }, // 窗口 10-03..10-09 仅一条
    ])
    expect(ma).toEqual([
      { date: '2026-10-01', value: 80 },
      { date: '2026-10-02', value: 80.5 },
      { date: '2026-10-09', value: 82 },
    ])
  })

  it('输入乱序时先排序', () => {
    const ma = weight7dMA([
      { date: '2026-10-02', weightKg: 81 },
      { date: '2026-10-01', weightKg: 80 },
    ])
    expect(ma.map((p) => p.date)).toEqual(['2026-10-01', '2026-10-02'])
  })
})

describe('每周体重变化', () => {
  it('本周日均 − 上周日均', () => {
    const records = [
      { date: '2026-10-27', weightKg: 80 }, // 上周周一
      { date: '2026-10-31', weightKg: 80.6 },
      { date: '2026-11-03', weightKg: 81 }, // 本周周二
    ]
    // 均线：10-27:80, 10-31:80.15, 11-03:80.53（窗口含全部三条）
    const change = weeklyWeightChange(records, '2026-11-02')
    expect(change).toBeGreaterThan(0)
    expect(change).toBeLessThan(1)
  })

  it('缺上一周数据时返回 0', () => {
    expect(weeklyWeightChange([{ date: '2026-11-03', weightKg: 80 }], '2026-11-02')).toBe(0)
  })
})
