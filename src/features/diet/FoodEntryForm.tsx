import { useState } from 'react'
import type { MealType } from '../../db/db'

export interface FoodEntryInput {
  name: string
  portion?: string
  kcal: number
  carbsG: number
  proteinG: number
  fatG: number
}

interface Props {
  mealType: MealType
  mealLabel?: string
  onClose: () => void
  onSave: (data: FoodEntryInput) => void
}

/** 食物录入表单：营养数据一律手动输入，不做任何估算 */
export default function FoodEntryForm({ mealType, mealLabel, onClose, onSave }: Props) {
  const [name, setName] = useState('')
  const [portion, setPortion] = useState('')
  const [kcal, setKcal] = useState('')
  const [carbs, setCarbs] = useState('')
  const [protein, setProtein] = useState('')
  const [fat, setFat] = useState('')

  const valid = name.trim() && kcal !== ''

  return (
    <div className="fixed inset-0 z-20 flex items-end bg-black/40" onClick={onClose}>
      <div
        className="mx-auto max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-bold">添加食物（{mealLabel ?? mealType}）</h2>
        <div className="space-y-3">
          <div>
            <span className="label">食物名称 *</span>
            <input
              className="input"
              placeholder="如：鸡胸肉"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <span className="label">份量（可选）</span>
            <input
              className="input"
              placeholder="如：200g / 1 碗"
              value={portion}
              onChange={(e) => setPortion(e.target.value)}
            />
          </div>
          <div>
            <span className="label">热量 (kcal) *</span>
            <input
              type="number"
              inputMode="decimal"
              className="input"
              min={0}
              value={kcal}
              onChange={(e) => setKcal(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ['碳水 (g)', carbs, setCarbs],
                ['蛋白质 (g)', protein, setProtein],
                ['脂肪 (g)', fat, setFat],
              ] as const
            ).map(([label, value, setter]) => (
              <div key={label}>
                <span className="label">{label}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  className="input"
                  min={0}
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
        <button
          className="btn-primary mt-4 w-full"
          disabled={!valid}
          onClick={() =>
            onSave({
              name: name.trim(),
              portion: portion.trim() || undefined,
              kcal: Number(kcal) || 0,
              carbsG: Number(carbs) || 0,
              proteinG: Number(protein) || 0,
              fatG: Number(fat) || 0,
            })
          }
        >
          保存
        </button>
      </div>
    </div>
  )
}
