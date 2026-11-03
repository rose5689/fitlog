import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { db } from '../../db/db'
import { computePRs, e1RMTrendByDate, epleyE1RM, maxWeight } from '../../core/metrics'
import { shortDate } from '../../utils/date'

export default function ExerciseDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const exerciseId = Number(id)

  const exercise = useLiveQuery(() => db.exercises.get(exerciseId), [exerciseId])
  const data = useLiveQuery(async () => {
    const [sessions, allSets] = await Promise.all([
      db.workoutSessions.toArray(),
      db.workoutSets.where('exerciseId').equals(exerciseId).toArray(),
    ])
    const dateMap = new Map(sessions.map((s) => [s.id!, s.date]))
    const dated = allSets
      .map((s) => ({ ...s, date: dateMap.get(s.sessionId) ?? '' }))
      .filter((s) => s.date)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.orderIndex - b.orderIndex))
    return {
      dated,
      trend: e1RMTrendByDate(dated).map((p) => ({ ...p, label: shortDate(p.date) })),
      prs: computePRs(dated).reverse(),
      max: maxWeight(dated),
      bestE1RM: dated.reduce((m, s) => Math.max(m, epleyE1RM(s.weightKg, s.reps)), 0),
    }
  }, [exerciseId])

  if (exercise === undefined || data === undefined) {
    return <p className="p-4 text-sm text-gray-400">加载中…</p>
  }
  if (exercise === null || data === null) {
    return <p className="p-4 text-sm text-gray-400">动作不存在</p>
  }

  return (
    <div className="p-4">
      <header className="mb-4 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="text-sm text-gray-500">
          ← 返回
        </button>
      </header>
      <h1 className="text-xl font-bold">{exercise.name}</h1>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="card !p-3">
          <p className="text-xs text-gray-400">最大重量</p>
          <p className="text-lg font-bold">{data.max || '—'}<span className="text-xs font-normal text-gray-400"> kg</span></p>
        </div>
        <div className="card !p-3">
          <p className="text-xs text-gray-400">最佳 e1RM</p>
          <p className="text-lg font-bold">{data.bestE1RM || '—'}<span className="text-xs font-normal text-gray-400"> kg</span></p>
        </div>
        <div className="card !p-3">
          <p className="text-xs text-gray-400">总组数</p>
          <p className="text-lg font-bold">{data.dated.length}</p>
        </div>
      </div>

      <h2 className="mb-2 mt-5 font-semibold">e1RM 趋势</h2>
      <div className="card">
        {data.trend.length >= 2 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data.trend} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
              <Tooltip
                formatter={(v: number) => [`${v} kg`, 'e1RM']}
                labelFormatter={(l) => data.trend.find((p) => p.label === l)?.date ?? l}
              />
              <Line type="monotone" dataKey="e1RM" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-8 text-center text-sm text-gray-400">记录 ≥ 2 天后显示趋势</p>
        )}
      </div>

      <h2 className="mb-2 mt-5 font-semibold">PR 历史</h2>
      <div className="card divide-y divide-gray-50 !p-0">
        {data.prs.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">暂无 PR</p>
        ) : (
          data.prs.map((pr, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-gray-500">{pr.date}</span>
              <span className="text-sm">
                <b>{pr.weightKg}</b> kg × {pr.reps} 次
                <span className="ml-2 text-xs text-primary">e1RM {pr.e1RM}</span>
              </span>
            </div>
          ))
        )}
      </div>

      <h2 className="mb-2 mt-5 font-semibold">全部记录</h2>
      <div className="space-y-3 pb-4">
        {groupDates(data.dated).map(([date, sets]) => (
          <div key={date} className="card">
            <p className="mb-1 text-sm font-medium">{date}</p>
            {sets.map((s, i) => (
              <div key={s.id} className="flex justify-between py-0.5 text-sm text-gray-600">
                <span>
                  第 {i + 1} 组：{s.weightKg} kg × {s.reps} 次
                  {s.rpe !== undefined && <span className="ml-1 text-xs text-gray-400">RPE {s.rpe}</span>}
                </span>
                <span className="text-xs text-gray-400">{(s.weightKg * s.reps).toLocaleString()} kg</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function groupDates<T extends { date: string }>(items: T[]): Array<[string, T[]]> {
  const map = new Map<string, T[]>()
  for (const it of items) {
    if (!map.has(it.date)) map.set(it.date, [])
    map.get(it.date)!.push(it)
  }
  return [...map.entries()]
}
