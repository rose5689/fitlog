import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  db,
  CURRENT_USER_ID,
  MEAL_LABELS,
  type MealType,
  type NutritionTarget,
} from '../../db/db'
import { achievementRate, sumNutrition } from '../../core/metrics'
import { addDays, todayStr, weekdayLabel } from '../../utils/date'
import FoodEntryForm from './FoodEntryForm'

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

export default function DietPage() {
  const [date, setDate] = useState(todayStr())
  const [addingMeal, setAddingMeal] = useState<MealType | null>(null)
  const [targetOpen, setTargetOpen] = useState(false)

  const entries = useLiveQuery(
    () => db.foodEntries.where('[userId+date]').equals([CURRENT_USER_ID, date]).toArray(),
    [date],
  )
  const target = useLiveQuery(
    () => db.nutritionTargets.where('userId').equals(CURRENT_USER_ID).first(),
    [],
  )

  const totals = entries ? sumNutrition(entries) : null

  async function updateTarget(data: {
    kcalTarget: number
    carbsGTarget: number
    proteinGTarget: number
    fatGTarget: number
  }) {
    const t = await db.nutritionTargets.where('userId').equals(CURRENT_USER_ID).first()
    if (t?.id) await db.nutritionTargets.update(t.id, { ...data, updatedAt: Date.now() })
    setTargetOpen(false)
  }

  return (
    <div className="p-4">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">饮食记录</h1>
        <button onClick={() => setTargetOpen(true)} className="text-sm text-gray-400">
          目标设置
        </button>
      </header>

      {/* 日期切换 */}
      <div className="mb-4 flex items-center justify-between">
        <button className="btn-secondary !px-3 !py-1.5" onClick={() => setDate(addDays(date, -1))}>
          ‹
        </button>
        <div className="text-center">
          <p className="font-semibold">
            {date === todayStr() ? '今天' : ''} {date}
          </p>
          <p className="text-xs text-gray-400">{weekdayLabel(date)}</p>
        </div>
        <button
          className="btn-secondary !px-3 !py-1.5"
          disabled={date >= todayStr()}
          onClick={() => setDate(addDays(date, 1))}
        >
          ›
        </button>
      </div>

      {/* 当日汇总 */}
      {totals && target && (
        <div className="card mb-4">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-gray-500">总热量</span>
            <span className="text-xs text-gray-400">达成率 {achievementRate(totals.kcal, target.kcalTarget)}%</span>
          </div>
          <p className="mt-1 text-2xl font-bold">
            {totals.kcal.toLocaleString()}
            <span className="text-sm font-normal text-gray-400"> / {target.kcalTarget.toLocaleString()} kcal</span>
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(100, achievementRate(totals.kcal, target.kcalTarget) * (100 / 150))}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-gray-400">
            剩余 {(target.kcalTarget - totals.kcal).toLocaleString()} kcal
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
            {(
              [
                ['碳水', totals.carbsG, target.carbsGTarget],
                ['蛋白', totals.proteinG, target.proteinGTarget],
                ['脂肪', totals.fatG, target.fatGTarget],
              ] as const
            ).map(([label, actual, goal]) => (
              <div key={label} className="rounded-lg bg-gray-50 py-2">
                <p className="text-xs text-gray-400">{label}</p>
                <p className="font-semibold">{actual}</p>
                <p className="text-xs text-gray-400">/ {goal} g</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 四餐分组 */}
      {MEAL_ORDER.map((meal) => {
        const list = (entries ?? []).filter((e) => e.mealType === meal)
        return (
          <div key={meal} className="card mb-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">{MEAL_LABELS[meal]}</h2>
              <button className="text-sm text-primary" onClick={() => setAddingMeal(meal)}>
                ＋ 添加
              </button>
            </div>
            {list.length === 0 ? (
              <p className="py-2 text-sm text-gray-300">未记录</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {list.map((e) => (
                  <li key={e.id} className="flex items-center justify-between py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{e.name}</p>
                      <p className="text-xs text-gray-400">
                        {e.portion ? `${e.portion} · ` : ''}
                        碳 {e.carbsG} / 蛋白 {e.proteinG} / 脂 {e.fatG} g
                      </p>
                    </div>
                    <div className="ml-2 flex shrink-0 items-center gap-2">
                      <span className="text-sm font-semibold">{e.kcal} kcal</span>
                      <button
                        className="text-gray-300"
                        onClick={() => e.id && db.foodEntries.delete(e.id)}
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}

      {addingMeal && (
        <FoodEntryForm
          mealType={addingMeal}
          mealLabel={MEAL_LABELS[addingMeal]}
          onClose={() => setAddingMeal(null)}
          onSave={async (data) => {
            await db.foodEntries.add({
              userId: CURRENT_USER_ID,
              date,
              mealType: addingMeal,
              createdAt: Date.now(),
              ...data,
            })
            setAddingMeal(null)
          }}
        />
      )}

      {targetOpen && target && (
        <TargetDialog
          target={target}
          onClose={() => setTargetOpen(false)}
          onSave={updateTarget}
        />
      )}
    </div>
  )
}

function TargetDialog({
  target,
  onClose,
  onSave,
}: {
  target: NutritionTarget
  onClose: () => void
  onSave: (data: {
    kcalTarget: number
    carbsGTarget: number
    proteinGTarget: number
    fatGTarget: number
  }) => void
}) {
  const [kcal, setKcal] = useState(String(target.kcalTarget))
  const [carbs, setCarbs] = useState(String(target.carbsGTarget))
  const [protein, setProtein] = useState(String(target.proteinGTarget))
  const [fat, setFat] = useState(String(target.fatGTarget))

  return (
    <div className="fixed inset-0 z-20 flex items-end bg-black/40" onClick={onClose}>
      <div
        className="mx-auto w-full max-w-md rounded-t-2xl bg-white p-4 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-bold">每日营养目标</h2>
        <div className="space-y-3">
          {(
            [
              ['热量 (kcal)', kcal, setKcal],
              ['碳水 (g)', carbs, setCarbs],
              ['蛋白质 (g)', protein, setProtein],
              ['脂肪 (g)', fat, setFat],
            ] as const
          ).map(([label, value, setter]) => (
            <div key={label}>
              <span className="label">{label}</span>
              <input
                type="number"
                inputMode="numeric"
                className="input"
                min={0}
                value={value}
                onChange={(e) => setter(e.target.value)}
              />
            </div>
          ))}
        </div>
        <button
          className="btn-primary mt-4 w-full"
          onClick={() =>
            onSave({
              kcalTarget: Number(kcal) || 0,
              carbsGTarget: Number(carbs) || 0,
              proteinGTarget: Number(protein) || 0,
              fatGTarget: Number(fat) || 0,
            })
          }
        >
          保存
        </button>
      </div>
    </div>
  )
}
