import { useState } from 'react'
import { MUSCLE_GROUP_LABELS, type Exercise, type MuscleGroup } from '../../db/db'

interface Props {
  exercises: Exercise[]
  onClose: () => void
  onPick: (exerciseId: number) => void
  onCreate: (name: string, muscleGroup: MuscleGroup) => void
}

const GROUPS = Object.entries(MUSCLE_GROUP_LABELS) as Array<[MuscleGroup, string]>

export default function ExercisePicker({ exercises, onClose, onPick, onCreate }: Props) {
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newGroup, setNewGroup] = useState<MuscleGroup>('chest')

  const q = query.trim().toLowerCase()
  const filtered = q ? exercises.filter((e) => e.name.toLowerCase().includes(q)) : exercises

  return (
    <div className="fixed inset-0 z-20 flex items-end bg-black/40" onClick={onClose}>
      <div
        className="mx-auto max-h-[75vh] w-full max-w-md overflow-hidden rounded-t-2xl bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-100 p-4">
          <div className="flex gap-2">
            <input
              className="input"
              placeholder="搜索动作，如：卧推"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <button className="btn-secondary shrink-0 !px-3 !py-2 text-sm" onClick={() => setCreating(!creating)}>
              {creating ? '取消' : '新建'}
            </button>
          </div>
          {creating && (
            <div className="mt-3 space-y-2">
              <input
                className="input"
                placeholder="新动作名称"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <select
                className="input"
                value={newGroup}
                onChange={(e) => setNewGroup(e.target.value as MuscleGroup)}
              >
                {GROUPS.map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
              <button
                className="btn-primary w-full"
                disabled={!newName.trim()}
                onClick={() => onCreate(newName.trim(), newGroup)}
              >
                创建并添加
              </button>
            </div>
          )}
        </div>
        <ul className="max-h-[50vh] overflow-y-auto pb-4">
          {filtered.map((e) => (
            <li key={e.id}>
              <button
                className="flex w-full items-center justify-between px-4 py-3 text-left active:bg-gray-50"
                onClick={() => onPick(e.id!)}
              >
                <span>{e.name}</span>
                <span className="text-xs text-gray-400">
                  {MUSCLE_GROUP_LABELS[e.muscleGroup]}
                  {e.isCustom && ' · 自定义'}
                </span>
              </button>
            </li>
          ))}
          {filtered.length === 0 && !creating && (
            <li className="px-4 py-8 text-center text-sm text-gray-400">
              没有匹配的动作，点击"新建"添加
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}
