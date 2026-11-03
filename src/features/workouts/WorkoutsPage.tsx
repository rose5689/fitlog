import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db, CURRENT_USER_ID } from '../../db/db'
import { todayStr, weekdayLabel } from '../../utils/date'
import { totalReps, totalSets, totalVolume } from '../../core/metrics'

export default function WorkoutsPage() {
  const navigate = useNavigate()

  const sessions = useLiveQuery(async () => {
    const list = await db.workoutSessions.orderBy('date').reverse().toArray()
    const sets = await db.workoutSets.toArray()
    return list.map((s) => {
      const ss = sets.filter((x) => x.sessionId === s.id)
      return { session: s, volume: totalVolume(ss), sets: totalSets(ss), reps: totalReps(ss) }
    })
  }, [])

  async function createSession() {
    const now = Date.now()
    const id = await db.workoutSessions.add({
      userId: CURRENT_USER_ID,
      date: todayStr(),
      targetParts: [],
      createdAt: now,
      updatedAt: now,
    })
    navigate(`/workouts/${id}`)
  }

  return (
    <div className="p-4">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">训练记录</h1>
        <button onClick={() => navigate('/settings')} className="text-sm text-gray-400">
          设置
        </button>
      </header>

      <button onClick={createSession} className="btn-primary mb-4 w-full">
        ＋ 新建训练
      </button>

      {sessions === undefined ? (
        <p className="text-center text-sm text-gray-400">加载中…</p>
      ) : sessions.length === 0 ? (
        <p className="py-16 text-center text-sm text-gray-400">
          还没有训练记录，点击上方按钮开始
        </p>
      ) : (
        <ul className="space-y-3">
          {sessions.map(({ session, volume, sets, reps }) => (
            <li key={session.id}>
              <button
                onClick={() => navigate(`/workouts/${session.id}`)}
                className="card w-full text-left active:bg-gray-50"
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold">{session.date}</span>
                  <span className="text-xs text-gray-400">{weekdayLabel(session.date)}</span>
                </div>
                {session.targetParts.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {session.targetParts.map((p) => (
                      <span
                        key={p}
                        className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-primary"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-2 flex gap-4 text-sm text-gray-500">
                  <span>
                    容量 <b className="text-gray-900">{volume.toLocaleString()}</b> kg
                  </span>
                  <span>
                    <b className="text-gray-900">{sets}</b> 组
                  </span>
                  <span>
                    <b className="text-gray-900">{reps}</b> 次
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
