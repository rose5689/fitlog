import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { db, CURRENT_USER_ID, MUSCLE_GROUP_LABELS, type MuscleGroup } from '../../db/db'
import { totalReps, totalSets, totalVolume } from '../../core/metrics'
import ExercisePicker from './ExercisePicker'

const PART_OPTIONS = ['胸', '背', '肩', '手臂', '腿', '核心']

export default function WorkoutEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const sessionId = Number(id)
  const [pickerOpen, setPickerOpen] = useState(false)

  const session = useLiveQuery(() => db.workoutSessions.get(sessionId), [sessionId])
  const sets = useLiveQuery(
    () => db.workoutSets.where('sessionId').equals(sessionId).toArray(),
    [sessionId],
  )
  const exercises = useLiveQuery(() => db.exercises.toArray(), [])

  const grouped = useMemo(() => {
    if (!sets || !exercises) return []
    const exMap = new Map(exercises.map((e) => [e.id!, e]))
    const map = new Map<number, { exerciseId: number; name: string; sets: typeof sets }>()
    for (const s of sets) {
      const key = s.exerciseId
      if (!map.has(key)) {
        map.set(key, {
          exerciseId: key,
          name: exMap.get(key)?.name ?? '未知动作',
          sets: [],
        })
      }
      map.get(key)!.sets.push(s)
    }
    return [...map.values()].map((g) => ({
      ...g,
      sets: g.sets.sort((a, b) => a.orderIndex - b.orderIndex),
      volume: totalVolume(g.sets),
    }))
  }, [sets, exercises])

  const summary = useMemo(() => {
    if (!sets) return { volume: 0, sets: 0, reps: 0 }
    return { volume: totalVolume(sets), sets: totalSets(sets), reps: totalReps(sets) }
  }, [sets])

  if (session === undefined) return <p className="p-4 text-sm text-gray-400">加载中…</p>
  if (session === null) {
    return <p className="p-4 text-sm text-gray-400">训练不存在</p>
  }

  async function patch(data: Partial<{ date: string; targetParts: string[]; note: string }>) {
    await db.workoutSessions.update(sessionId, { ...data, updatedAt: Date.now() })
  }

  async function addSet(exerciseId: number) {
    const existing = await db.workoutSets.where('sessionId').equals(sessionId).toArray()
    const last = existing
      .filter((s) => s.exerciseId === exerciseId)
      .sort((a, b) => b.orderIndex - a.orderIndex)[0]
    await db.workoutSets.add({
      userId: CURRENT_USER_ID,
      sessionId,
      exerciseId,
      weightKg: last?.weightKg ?? 0,
      reps: last?.reps ?? 8,
      rpe: last?.rpe,
      orderIndex: last ? last.orderIndex + 1 : 0,
      createdAt: Date.now(),
    })
  }

  async function updateSet(
    setId: number,
    data: Partial<{ weightKg: number; reps: number; rpe?: number }>,
  ) {
    await db.workoutSets.update(setId, data)
  }

  async function removeSet(setId: number) {
    await db.workoutSets.delete(setId)
  }

  async function removeExerciseGroup(exerciseId: number) {
    const all = await db.workoutSets.where('sessionId').equals(sessionId).toArray()
    await db.workoutSets.bulkDelete(
      all.filter((s) => s.exerciseId === exerciseId).map((s) => s.id!),
    )
  }

  return (
    <div className="p-4">
      <header className="mb-4 flex items-center justify-between">
        <button onClick={() => navigate('/workouts')} className="text-sm text-gray-500">
          ← 返回
        </button>
        <button
          onClick={() => {
            if (confirm('删除本次训练？')) {
              db.transaction(
                'rw',
                db.workoutSessions,
                db.workoutSets,
                async () => {
                  await db.workoutSets.where('sessionId').equals(sessionId).delete()
                  await db.workoutSessions.delete(sessionId)
                },
              ).then(() => navigate('/workouts'))
            }
          }}
          className="text-sm text-red-400"
        >
          删除
        </button>
      </header>

      <div className="card mb-4 space-y-3">
        <div>
          <span className="label">日期</span>
          <input
            type="date"
            className="input"
            value={session.date}
            onChange={(e) => patch({ date: e.target.value })}
          />
        </div>
        <div>
          <span className="label">训练部位（可多选）</span>
          <div className="flex flex-wrap gap-2">
            {PART_OPTIONS.map((p) => {
              const active = session.targetParts.includes(p)
              return (
                <button
                  key={p}
                  onClick={() =>
                    patch({
                      targetParts: active
                        ? session.targetParts.filter((x) => x !== p)
                        : [...session.targetParts, p],
                    })
                  }
                  className={`rounded-full px-3 py-1 text-sm ${
                    active ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {p}
                </button>
              )
            })}
          </div>
        </div>
        <div>
          <span className="label">备注</span>
          <textarea
            className="input"
            rows={2}
            placeholder="训练感受、状态等（可选）"
            defaultValue={session.note ?? ''}
            onBlur={(e) => patch({ note: e.target.value })}
          />
        </div>
      </div>

      {grouped.map((g) => (
        <div key={g.exerciseId} className="card mb-4">
          <div className="mb-2 flex items-center justify-between">
            <button
              className="font-semibold text-primary"
              onClick={() => navigate(`/exercises/${g.exerciseId}`)}
            >
              {g.name}
            </button>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">{g.volume.toLocaleString()} kg</span>
              <button
                className="text-xs text-gray-400"
                onClick={() => {
                  if (confirm('删除该动作的全部组？')) removeExerciseGroup(g.exerciseId)
                }}
              >
                删除
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="grid grid-cols-[2rem_1fr_1fr_3.5rem_2rem] gap-2 px-1 text-xs text-gray-400">
              <span>组</span>
              <span>重量(kg)</span>
              <span>次数</span>
              <span>RPE</span>
              <span />
            </div>
            {g.sets.map((s, i) => (
              <div key={s.id} className="grid grid-cols-[2rem_1fr_1fr_3.5rem_2rem] items-center gap-2">
                <span className="text-center text-sm text-gray-400">{i + 1}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  className="input !px-2 !py-1.5 text-center"
                  value={s.weightKg}
                  min={0}
                  step={0.5}
                  onChange={(e) => updateSet(s.id!, { weightKg: Number(e.target.value) || 0 })}
                />
                <input
                  type="number"
                  inputMode="numeric"
                  className="input !px-2 !py-1.5 text-center"
                  value={s.reps}
                  min={0}
                  onChange={(e) => updateSet(s.id!, { reps: Number(e.target.value) || 0 })}
                />
                <input
                  type="number"
                  inputMode="decimal"
                  className="input !px-2 !py-1.5 text-center"
                  value={s.rpe ?? ''}
                  min={1}
                  max={10}
                  step={0.5}
                  placeholder="—"
                  onChange={(e) =>
                    updateSet(s.id!, {
                      rpe: e.target.value === '' ? undefined : Number(e.target.value),
                    })
                  }
                />
                <button className="text-gray-300" onClick={() => removeSet(s.id!)}>
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button className="btn-secondary mt-2 w-full !py-1.5 text-sm" onClick={() => addSet(g.exerciseId)}>
            ＋ 加一组
          </button>
        </div>
      ))}

      <button className="btn-secondary w-full" onClick={() => setPickerOpen(true)}>
        ＋ 添加动作
      </button>

      {/* 底部实时汇总（高于 tab 导航） */}
      {summary.sets > 0 && (
        <div className="fixed inset-x-0 bottom-14 z-10 mx-auto max-w-md px-4">
          <div className="flex justify-around rounded-xl bg-gray-900/90 px-4 py-2 text-center text-xs text-white backdrop-blur">
            <span>
              容量<b className="ml-1 block text-base">{summary.volume.toLocaleString()}</b>
            </span>
            <span>
              组数<b className="ml-1 block text-base">{summary.sets}</b>
            </span>
            <span>
              次数<b className="ml-1 block text-base">{summary.reps}</b>
            </span>
          </div>
        </div>
      )}

      {pickerOpen && (
        <ExercisePicker
          exercises={exercises ?? []}
          onClose={() => setPickerOpen(false)}
          onPick={async (exerciseId) => {
            setPickerOpen(false)
            await addSet(exerciseId)
          }}
          onCreate={async (name, muscleGroup) => {
            const now = Date.now()
            const exId = await db.exercises.add({
              userId: CURRENT_USER_ID,
              name,
              muscleGroup,
              category: 'other',
              isCustom: true,
              createdAt: now,
            })
            setPickerOpen(false)
            await addSet(exId)
          }}
        />
      )}
    </div>
  )
}

export function muscleGroupOptions(): Array<{ value: MuscleGroup; label: string }> {
  return Object.entries(MUSCLE_GROUP_LABELS).map(([value, label]) => ({
    value: value as MuscleGroup,
    label,
  }))
}
