import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { db, CURRENT_USER_ID } from '../../db/db'
import { weight7dMA, weeklyWeightChange } from '../../core/metrics'
import { shortDate, todayStr, weekStart } from '../../utils/date'

const PARTS: Array<{ key: string; label: string }> = [
  { key: 'chest', label: '胸围' },
  { key: 'waist', label: '腰围' },
  { key: 'hip', label: '臀围' },
  { key: 'arm', label: '臂围' },
  { key: 'thigh', label: '腿围' },
]

export default function BodyPage() {
  const [weightInput, setWeightInput] = useState('')
  const [fatInput, setFatInput] = useState('')
  const [measureInputs, setMeasureInputs] = useState<Record<string, string>>({})
  const [selectedPart, setSelectedPart] = useState<string | null>(null)

  // 体重记录（全量，用于均线）
  const weights = useLiveQuery(
    () =>
      db.bodyMetrics
        .orderBy('date')
        .toArray()
        .then((all) => all.filter((m) => m.userId === CURRENT_USER_ID)),
    [],
  )
  const measurements = useLiveQuery(
    () =>
      db.bodyMeasurements
        .orderBy('date')
        .toArray()
        .then((all) => all.filter((m) => m.userId === CURRENT_USER_ID)),
    [],
  )

  const ma = weights ? weight7dMA(weights) : []
  const weekChange = weights ? weeklyWeightChange(weights, weekStart(todayStr())) : 0
  const maChart = ma.map((p) => {
    const raw = weights?.find((w) => w.date === p.date)
    return { label: shortDate(p.date), date: p.date, ma: p.value, raw: raw?.weightKg }
  })

  const latestMeasure = new Map<string, { valueCm: number; date: string }>()
  for (const m of measurements ?? []) {
    latestMeasure.set(m.part, { valueCm: m.valueCm, date: m.date })
  }
  const partHistory = selectedPart
    ? (measurements ?? [])
        .filter((m) => m.part === selectedPart)
        .map((m) => ({ label: shortDate(m.date), value: m.valueCm }))
    : []

  async function saveWeight() {
    const w = Number(weightInput)
    if (!w || w <= 0) return
    await db.bodyMetrics.add({
      userId: CURRENT_USER_ID,
      date: todayStr(),
      weightKg: w,
      bodyFatPct: fatInput ? Number(fatInput) : undefined,
      createdAt: Date.now(),
    })
    setWeightInput('')
    setFatInput('')
  }

  async function saveMeasure(part: string) {
    const v = Number(measureInputs[part])
    if (!v || v <= 0) return
    await db.bodyMeasurements.add({
      userId: CURRENT_USER_ID,
      date: todayStr(),
      part,
      valueCm: v,
      createdAt: Date.now(),
    })
    setMeasureInputs((s) => ({ ...s, [part]: '' }))
  }

  return (
    <div className="p-4">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">身体数据</h1>
        <span className="text-xs text-gray-400">
          本周变化 {weekChange > 0 ? '+' : ''}
          {weekChange} kg
        </span>
      </header>

      {/* 体重录入 */}
      <div className="card mb-4">
        <h2 className="mb-2 font-semibold">记录体重（今天）</h2>
        <div className="flex gap-2">
          <input
            type="number"
            inputMode="decimal"
            className="input"
            placeholder="体重 kg"
            step={0.1}
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
          />
          <input
            type="number"
            inputMode="decimal"
            className="input"
            placeholder="体脂% 可选"
            step={0.1}
            value={fatInput}
            onChange={(e) => setFatInput(e.target.value)}
          />
          <button className="btn-primary shrink-0 !px-4" onClick={saveWeight}>
            保存
          </button>
        </div>
        {weights && weights.length > 0 && (
          <p className="mt-2 text-xs text-gray-400">
            最新：{weights[weights.length - 1].weightKg} kg（{weights[weights.length - 1].date}）
          </p>
        )}
      </div>

      {/* 体重趋势 */}
      <h2 className="mb-2 font-semibold">体重趋势（含 7 日移动平均）</h2>
      <div className="card mb-4">
        {maChart.length >= 2 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={maChart} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
              <Tooltip
                formatter={(v: number, name: string) => [
                  `${v} kg`,
                  name === 'ma' ? '7日均线' : '当日体重',
                ]}
              />
              <Line type="monotone" dataKey="raw" stroke="#c7d2fe" strokeWidth={1.5} dot={{ r: 2 }} connectNulls />
              <Line type="monotone" dataKey="ma" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-8 text-center text-sm text-gray-400">记录 ≥ 2 天后显示趋势</p>
        )}
      </div>

      {/* 维度录入 */}
      <h2 className="mb-2 font-semibold">身体维度（cm）</h2>
      <div className="card mb-4">
        <div className="space-y-2">
          {PARTS.map((p) => {
            const latest = latestMeasure.get(p.key)
            return (
              <div key={p.key} className="flex items-center gap-2">
                <button
                  className="w-14 shrink-0 text-left text-sm"
                  onClick={() => setSelectedPart(selectedPart === p.key ? null : p.key)}
                >
                  {p.label}
                  <span className="block text-xs text-gray-400">
                    {latest ? `${latest.valueCm} · ${shortDate(latest.date)}` : '点击看趋势'}
                  </span>
                </button>
                <input
                  type="number"
                  inputMode="decimal"
                  className="input"
                  placeholder="今天测量值"
                  step={0.1}
                  value={measureInputs[p.key] ?? ''}
                  onChange={(e) => setMeasureInputs((s) => ({ ...s, [p.key]: e.target.value }))}
                />
                <button
                  className="btn-secondary shrink-0 !px-3 !py-2 text-sm"
                  onClick={() => saveMeasure(p.key)}
                >
                  记
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* 选中维度的趋势 */}
      {selectedPart && (
        <>
          <h2 className="mb-2 font-semibold">
            {PARTS.find((p) => p.key === selectedPart)?.label}趋势
          </h2>
          <div className="card mb-4">
            {partHistory.length >= 2 ? (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={partHistory} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                  <Tooltip formatter={(v: number) => [`${v} cm`, '']} />
                  <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-8 text-center text-sm text-gray-400">记录 ≥ 2 次后显示趋势</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
