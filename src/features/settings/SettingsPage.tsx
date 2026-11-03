import { useLiveQuery } from 'dexie-react-hooks'
import { db, CURRENT_USER_ID, MUSCLE_GROUP_LABELS, MEAL_LABELS } from '../../db/db'
import { epleyE1RM, setVolume } from '../../core/metrics'
import { todayStr } from '../../utils/date'
import { buildCsv, downloadCsv } from '../../utils/csv'

export default function SettingsPage() {
  const counts = useLiveQuery(async () => ({
    sessions: await db.workoutSessions.count(),
    sets: await db.workoutSets.count(),
    foods: await db.foodEntries.count(),
    weights: await db.bodyMetrics.count(),
    measures: await db.bodyMeasurements.count(),
  }), [])

  async function exportWorkouts() {
    const [sessions, sets, exercises] = await Promise.all([
      db.workoutSessions.orderBy('date').toArray(),
      db.workoutSets.toArray(),
      db.exercises.toArray(),
    ])
    const dateMap = new Map(sessions.map((s) => [s.id!, s]))
    const exMap = new Map(exercises.map((e) => [e.id!, e]))
    const rows = sets
      .map((s) => ({ s, session: dateMap.get(s.sessionId) }))
      .filter((r) => r.session)
      .sort((a, b) => (a.session!.date < b.session!.date ? -1 : 1))
      .map(({ s, session }) => {
        const ex = exMap.get(s.exerciseId)
        return [
          session!.date,
          session!.targetParts.join('|'),
          session!.note ?? '',
          ex?.name ?? '',
          ex ? MUSCLE_GROUP_LABELS[ex.muscleGroup] : '',
          s.orderIndex + 1,
          s.weightKg,
          s.reps,
          s.rpe ?? '',
          setVolume(s),
          epleyE1RM(s.weightKg, s.reps),
        ]
      })
    downloadCsv(
      `fitlog-workouts-${todayStr()}.csv`,
      buildCsv(
        ['日期', '部位', '备注', '动作', '肌群', '组序', '重量kg', '次数', 'RPE', '组容量kg', 'e1RMkg'],
        rows,
      ),
    )
  }

  async function exportDiet() {
    const entries = await db.foodEntries.orderBy('date').toArray()
    const rows = entries.map((e) => [
      e.date,
      MEAL_LABELS[e.mealType],
      e.name,
      e.portion ?? '',
      e.kcal,
      e.carbsG,
      e.proteinG,
      e.fatG,
    ])
    downloadCsv(
      `fitlog-diet-${todayStr()}.csv`,
      buildCsv(['日期', '餐次', '食物', '份量', '热量kcal', '碳水g', '蛋白质g', '脂肪g'], rows),
    )
  }

  async function exportBody() {
    const [metrics, measurements] = await Promise.all([
      db.bodyMetrics.orderBy('date').toArray(),
      db.bodyMeasurements.orderBy('date').toArray(),
    ])
    const rows: Array<Array<string | number>> = [
      ...metrics.map((m) => [m.date, '体重', 'weight', m.weightKg, m.bodyFatPct ?? '']),
      ...measurements.map((m) => [m.date, '维度', m.part, m.valueCm, '']),
    ]
    rows.sort((a, b) => (String(a[0]) < String(b[0]) ? -1 : 1))
    downloadCsv(
      `fitlog-body-${todayStr()}.csv`,
      buildCsv(['日期', '类型', '部位/标识', '数值', '体脂率%'], rows),
    )
  }

  async function clearAll() {
    if (!confirm('确定清空所有训练/饮食/身体数据？此操作不可恢复（动作库保留）。')) return
    if (!confirm('再次确认：真的要清空全部记录数据吗？')) return
    await db.transaction(
      'rw',
      [db.workoutSessions, db.workoutSets, db.foodEntries, db.bodyMetrics, db.bodyMeasurements],
      async () => {
        await Promise.all([
          db.workoutSessions.clear(),
          db.workoutSets.clear(),
          db.foodEntries.clear(),
          db.bodyMetrics.clear(),
          db.bodyMeasurements.clear(),
        ])
      },
    )
    alert('已清空')
  }

  return (
    <div className="p-4">
      <header className="mb-4">
        <h1 className="text-xl font-bold">设置</h1>
      </header>

      <div className="card mb-4">
        <h2 className="mb-2 font-semibold">数据导出（CSV）</h2>
        <div className="space-y-2">
          <button className="btn-secondary w-full" onClick={exportWorkouts}>
            导出训练记录
          </button>
          <button className="btn-secondary w-full" onClick={exportDiet}>
            导出饮食记录
          </button>
          <button className="btn-secondary w-full" onClick={exportBody}>
            导出身体数据
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          导出为 UTF-8 CSV，可用 Excel/WPS 直接打开。
        </p>
      </div>

      <div className="card mb-4">
        <h2 className="mb-2 font-semibold">数据概况</h2>
        {counts && (
          <ul className="space-y-1 text-sm text-gray-600">
            <li>训练次数：{counts.sessions}</li>
            <li>训练组数：{counts.sets}</li>
            <li>饮食记录：{counts.foods}</li>
            <li>体重记录：{counts.weights}</li>
            <li>维度记录：{counts.measures}</li>
          </ul>
        )}
      </div>

      <div className="card mb-4 border border-red-100">
        <h2 className="mb-2 font-semibold text-red-500">危险操作</h2>
        <button
          className="w-full rounded-lg bg-red-50 px-4 py-2.5 text-center font-medium text-red-500 active:bg-red-100"
          onClick={clearAll}
        >
          清空全部记录数据
        </button>
        <p className="mt-2 text-xs text-gray-400">动作库与营养目标将保留。</p>
      </div>

      <p className="pb-4 text-center text-xs text-gray-300">
        FitLog v0.1 · 数据仅存储在本设备浏览器中（ID：{CURRENT_USER_ID}）
      </p>
    </div>
  )
}
