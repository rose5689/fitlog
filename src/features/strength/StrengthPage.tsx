import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { db, MUSCLE_GROUP_LABELS, type Exercise } from '../../db/db'
import {
  STRENGTH_MODE_LABELS,
  dailyStrengthSeries,
  dailyVolumeSeries,
  markPRs,
  weeklySlope,
  type StrengthMode,
} from '../../core/strength'
import { addDays, shortDate, todayStr } from '../../utils/date'

const RANGE_OPTIONS = [30, 90, 180, 0] as const
const RM_OPTIONS = [3, 5, 8, 10]
const STORAGE_KEY = 'fitlog.strength.exerciseId'

type ExerciseRow = Exercise & { last: string; weightedSets: number }

export default function StrengthPage() {
  const navigate = useNavigate()
  const [selectedId, setSelectedId] = useState<number | null>(() => {
    const v = localStorage.getItem(STORAGE_KEY)
    return v ? Number(v) : null
  })
  const [mode, setMode] = useState<StrengthMode>('top')
  const [rm, setRm] = useState(5)
  const [range, setRange] = useState<(typeof RANGE_OPTIONS)[number]>(90)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [query, setQuery] = useState('')

  const raw = useLiveQuery(async () => {
    const [sets, sessions, exercises] = await Promise.all([
      db.workoutSets.toArray(),
      db.workoutSessions.toArray(),
      db.exercises.toArray(),
    ])
    const dateBySession = new Map(sessions.map((s) => [s.id!, s.date]))
    const dated = sets
      .map((s) => ({ ...s, date: dateBySession.get(s.sessionId) ?? '' }))
      .filter((s) => s.date)
    return { dated, exercises }
  }, [])

  const rows = useMemo<ExerciseRow[]>(() => {
    if (!raw) return []
    const stat = new Map<number, { last: string; weightedSets: number }>()
    for (const s of raw.dated) {
      const cur = stat.get(s.exerciseId) ?? { last: '', weightedSets: 0 }
      if (s.date > cur.last) cur.last = s.date
      if (s.weightKg > 0) cur.weightedSets += 1
      stat.set(s.exerciseId, cur)
    }
    return raw.exercises
      .map((e) => ({ ...e, ...(stat.get(e.id!) ?? { last: '', weightedSets: 0 }) }))
      .filter((e) => e.last !== '')
      .sort((a, b) => (a.last < b.last ? 1 : a.last > b.last ? -1 : 0))
  }, [raw])

  const currentId =
    selectedId !== null && rows.some((r) => r.id === selectedId)
      ? selectedId
      : rows[0]?.id ?? null
  const current = rows.find((r) => r.id === currentId) ?? null

  useEffect(() => {
    if (currentId !== null) localStorage.setItem(STORAGE_KEY, String(currentId))
  }, [currentId])

  const selectedSets = useMemo(() => {
    if (!raw || currentId === null) return []
    return raw.dated
      .filter((s) => s.exerciseId === currentId)
      .map((s) => ({ date: s.date, weightKg: s.weightKg, reps: s.reps }))
  }, [raw, currentId])

  const allPoints = useMemo(
    () => markPRs(dailyStrengthSeries(selectedSets, mode, rm)),
    [selectedSets, mode, rm],
  )

  const pointsInRange = useMemo(() => {
    const cutoff = range === 0 ? '' : addDays(todayStr(), -(range - 1))
    return allPoints.filter((p) => range === 0 || p.date >= cutoff)
  }, [allPoints, range])

  // 容量不区分动作：按训练日汇总当日全部动作的总容量
  const volumeRows = useMemo(() => {
    if (!raw) return []
    const cutoff = range === 0 ? '' : addDays(todayStr(), -(range - 1))
    return dailyVolumeSeries(raw.dated)
      .filter((p) => range === 0 || p.date >= cutoff)
      .map((p) => ({ date: p.date, label: shortDate(p.date), value: p.value }))
  }, [raw, range])

  const volumeTotal = volumeRows.reduce((a, p) => a + p.value, 0)
  const volumeAvg = volumeRows.length ? round2(volumeTotal / volumeRows.length) : 0
  const volumeSlope = weeklySlope(volumeRows)

  const chartRows = useMemo(
    () =>
      pointsInRange.map((p) => {
        const top = p.sets.reduce((a, s) => (s.weightKg > a.weightKg ? s : a), p.sets[0])
        return {
          date: p.date,
          label: shortDate(p.date),
          value: p.value,
          isPR: p.isPR,
          setCount: p.sets.length,
          topWeight: top.weightKg,
          topReps: top.reps,
        }
      }),
    [pointsInRange],
  )

  const latest = allPoints[allPoints.length - 1]
  const bestInRange = pointsInRange.reduce((m, p) => Math.max(m, p.value), 0)
  const firstInRange = pointsInRange[0]
  const lastInRange = pointsInRange[pointsInRange.length - 1]
  const delta =
    firstInRange && lastInRange && pointsInRange.length >= 2
      ? round2(lastInRange.value - firstInRange.value)
      : null
  const deltaPct =
    delta !== null && firstInRange && firstInRange.value > 0
      ? round1((delta / firstInRange.value) * 100)
      : null
  const slope = weeklySlope(pointsInRange)

  const filteredRows = rows.filter((r) =>
    query.trim() ? r.name.toLowerCase().includes(query.trim().toLowerCase()) : true,
  )

  if (raw === undefined) {
    return <p className="p-4 text-sm text-gray-400">加载中…</p>
  }

  return (
    <div className="p-4 pb-4">
      <header className="mb-3 flex items-center justify-between">
        <h1 className="text-xl font-bold">力量曲线</h1>
        {current && <span className="text-xs text-gray-400">{MUSCLE_GROUP_LABELS[current.muscleGroup]}</span>}
      </header>

      {/* 动作选择 */}
      {rows.length === 0 ? (
        <div className="card text-center">
          <p className="text-sm text-gray-400">还没有训练记录</p>
          <button className="btn-primary mt-3" onClick={() => navigate('/workouts')}>
            去记录一次训练
          </button>
        </div>
      ) : (
        <>
          <button
            className="card mb-3 flex w-full items-center justify-between text-left"
            onClick={() => setSheetOpen(true)}
          >
            <span>
              <span className="font-semibold">{current?.name}</span>
              <span className="ml-2 text-xs text-gray-400">
                共 {current?.weightedSets ?? 0} 组负重记录
              </span>
            </span>
            <span className="text-xs text-gray-400">切换 ▾</span>
          </button>

          {/* 时间范围：力量曲线与容量曲线共用 */}
          <div className="mb-3 flex gap-1.5">
            {RANGE_OPTIONS.map((r) => (
              <button
                key={r}
                className={`flex-1 rounded-full py-1.5 text-xs ${
                  range === r ? 'bg-primary text-white' : 'bg-white text-gray-500'
                }`}
                onClick={() => setRange(r)}
              >
                {r === 0 ? '全部' : `${r} 天`}
              </button>
            ))}
          </div>

          {current && current.weightedSets === 0 ? (
            <div className="card py-8 text-center text-sm text-gray-400">
              该动作的记录均为自重，暂不支持重量曲线
            </div>
          ) : (
            <>

              {/* 口径 */}
              <div className="mb-3 flex gap-1.5">
                {(['top', 'e1rm', 'rm'] as StrengthMode[]).map((m) => (
                  <button
                    key={m}
                    className={`flex-1 rounded-full py-1.5 text-xs ${
                      mode === m ? 'bg-primary text-white' : 'bg-white text-gray-500'
                    }`}
                    onClick={() => setMode(m)}
                  >
                    {STRENGTH_MODE_LABELS[m]}
                  </button>
                ))}
              </div>

              {mode === 'rm' && (
                <div className="mb-3 flex gap-1.5">
                  {RM_OPTIONS.map((n) => (
                    <button
                      key={n}
                      className={`flex-1 rounded-full border py-1 text-xs ${
                        rm === n
                          ? 'border-primary text-primary'
                          : 'border-gray-200 bg-white text-gray-400'
                      }`}
                      onClick={() => setRm(n)}
                    >
                      {n}+ 次
                    </button>
                  ))}
                </div>
              )}

              {/* 结论卡 */}
              <div className="mb-3 grid grid-cols-2 gap-2">
                <div className="card !p-3">
                  <p className="text-xs text-gray-400">最近一次</p>
                  <p className="text-lg font-bold">
                    {latest ? latest.value : '—'}
                    <span className="text-xs font-normal text-gray-400"> kg</span>
                  </p>
                  <p className="text-[11px] text-gray-400">{latest ? latest.date : ''}</p>
                </div>
                <div className="card !p-3">
                  <p className="text-xs text-gray-400">区间最佳</p>
                  <p className="text-lg font-bold">
                    {bestInRange ? bestInRange : '—'}
                    <span className="text-xs font-normal text-gray-400"> kg</span>
                  </p>
                  <p className="text-[11px] text-gray-400">近 {range === 0 ? '全部' : `${range} 天`}</p>
                </div>
                <div className="card !p-3">
                  <p className="text-xs text-gray-400">区间变化</p>
                  <p
                    className={`text-lg font-bold ${
                      delta === null ? '' : delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-rose-500' : ''
                    }`}
                  >
                    {delta === null ? '—' : `${delta > 0 ? '+' : ''}${delta}`}
                    <span className="text-xs font-normal text-gray-400"> kg</span>
                  </p>
                  <p className="text-[11px] text-gray-400">
                    {deltaPct === null ? '数据不足' : `${deltaPct > 0 ? '+' : ''}${deltaPct}%`}
                  </p>
                </div>
                <div className="card !p-3">
                  <p className="text-xs text-gray-400">每周斜率</p>
                  <p
                    className={`text-lg font-bold ${
                      slope > 0 ? 'text-emerald-600' : slope < 0 ? 'text-rose-500' : ''
                    }`}
                  >
                    {pointsInRange.length >= 2 ? `${slope > 0 ? '+' : ''}${slope}` : '—'}
                    <span className="text-xs font-normal text-gray-400"> kg/周</span>
                  </p>
                  <p className="text-[11px] text-gray-400">线性回归</p>
                </div>
              </div>

              {/* 主图 */}
              <div className="card mb-3">
                {chartRows.length >= 2 ? (
                  <>
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={chartRows} margin={{ top: 12, right: 12, bottom: 0, left: -12 }}>
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11 }}
                          interval="preserveStartEnd"
                          minTickGap={24}
                        />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          domain={['auto', 'auto']}
                          tickFormatter={(v: number) => `${v}`}
                        />
                        <Tooltip
                          labelFormatter={(_label: unknown, payload: any) => {
                            const p = payload?.[0]?.payload
                            if (!p) return ''
                            return `${p.date} · ${p.setCount} 组 · 当日最重 ${p.topWeight} kg × ${p.topReps}`
                          }}
                          formatter={(v: number) => [`${v} kg`, STRENGTH_MODE_LABELS[mode]]}
                        />
                        <Line
                          type="linear"
                          dataKey="value"
                          stroke="#2563eb"
                          strokeWidth={2}
                          dot={(props: any) => renderDot(props)}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                    <p className="mt-1 text-center text-[11px] text-gray-400">
                      <span className="inline-block h-2 w-2 rounded-full bg-amber-400 align-middle" /> 橙点为刷新历史最高
                    </p>
                  </>
                ) : (
                  <p className="py-10 text-center text-sm text-gray-400">
                    {chartRows.length === 0
                      ? mode === 'rm'
                        ? `区间内没有「${rm} 次以上」的记录，换个口径看看`
                        : '当前区间没有数据，试试切换时间范围'
                      : '需要至少 2 个训练日才能画出曲线'}
                  </p>
                )}
              </div>

              {/* 明细 */}
              <h2 className="mb-2 font-semibold">区间记录</h2>
              <div className="card divide-y divide-gray-50 !p-0">
                {chartRows.length === 0 ? (
                  <p className="py-6 text-center text-sm text-gray-400">暂无记录</p>
                ) : (
                  [...chartRows].reverse().map((p) => (
                    <button
                      key={p.date}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-left active:bg-gray-50"
                      onClick={() => navigate(`/exercises/${currentId}`)}
                    >
                      <span className="text-sm text-gray-600">{p.date}</span>
                      <span className="text-right text-sm">
                        <b>{p.value}</b> kg
                        <span className="ml-2 text-[11px] text-gray-400">
                          {p.setCount} 组 · 最重 {p.topWeight}kg×{p.topReps}
                        </span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            </>
          )}

          {/* 训练容量曲线：按训练日汇总当日全部动作的总容量 */}
          <h2 className="mb-2 font-semibold">
            训练容量
            <span className="ml-2 text-xs font-normal text-gray-400">全部动作 · 按日汇总</span>
          </h2>
          <div className="card mb-3">
            {volumeRows.length >= 2 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={volumeRows} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    interval="preserveStartEnd"
                    minTickGap={24}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    domain={[0, 'auto']}
                    tickFormatter={(v: number) => (v >= 1000 ? `${v / 1000}k` : `${v}`)}
                  />
                  <Tooltip
                    labelFormatter={(_l: unknown, payload: any) => payload?.[0]?.payload?.date ?? ''}
                    formatter={(v: number) => [`${v.toLocaleString()} kg`, '当日总容量']}
                  />
                  <Bar dataKey="value" fill="#7c3aed" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-8 text-center text-sm text-gray-400">
                {volumeRows.length === 0
                  ? '当前区间没有负重训练容量'
                  : '需要至少 2 个训练日才能画出容量曲线'}
              </p>
            )}
            {volumeRows.length > 0 && (
              <div className="mt-2 flex justify-between text-xs text-gray-400">
                <span>
                  总容量 <b className="text-gray-700">{volumeTotal.toLocaleString()}</b> kg
                </span>
                <span>
                  日均{' '}
                  <b className="text-gray-700">{Math.round(volumeAvg).toLocaleString()}</b> kg
                </span>
                <span>
                  周变化{' '}
                  <b
                    className={
                      volumeSlope > 0
                        ? 'text-emerald-600'
                        : volumeSlope < 0
                          ? 'text-rose-500'
                          : 'text-gray-700'
                    }
                  >
                    {volumeSlope > 0 ? '+' : ''}
                    {volumeSlope}
                  </b>{' '}
                  kg
                </span>
              </div>
            )}
          </div>
        </>
      )}

      {/* 动作选择弹层 */}
      {sheetOpen && (
        <div className="fixed inset-0 z-20 flex items-end bg-black/40" onClick={() => setSheetOpen(false)}>
          <div
            className="mx-auto max-h-[75vh] w-full max-w-md overflow-hidden rounded-t-2xl bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-gray-100 p-4">
              <input
                className="input"
                placeholder="搜索动作，如：卧推"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
            </div>
            <ul className="max-h-[55vh] overflow-y-auto pb-4">
              {filteredRows.map((r) => (
                <li key={r.id}>
                  <button
                    className={`flex w-full items-center justify-between px-4 py-3 text-left active:bg-gray-50 ${
                      r.id === currentId ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => {
                      setSelectedId(r.id!)
                      setSheetOpen(false)
                      setQuery('')
                    }}
                  >
                    <span>{r.name}</span>
                    <span className="text-xs text-gray-400">
                      {MUSCLE_GROUP_LABELS[r.muscleGroup]}
                      {r.weightedSets === 0 ? ' · 自重' : ` · ${r.last}`}
                    </span>
                  </button>
                </li>
              ))}
              {filteredRows.length === 0 && (
                <li className="px-4 py-8 text-center text-sm text-gray-400">没有匹配的动作</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

function renderDot(props: any) {
  const { cx, cy, payload } = props
  if (cx == null || cy == null) return <g />
  return payload?.isPR ? (
    <circle cx={cx} cy={cy} r={5} fill="#fbbf24" stroke="#b45309" strokeWidth={1} />
  ) : (
    <circle cx={cx} cy={cy} r={3} fill="#2563eb" />
  )
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
