import { NavLink, Route, Routes } from 'react-router-dom'
import WorkoutsPage from './features/workouts/WorkoutsPage'
import WorkoutEditorPage from './features/workouts/WorkoutEditorPage'
import ExerciseDetailPage from './features/workouts/ExerciseDetailPage'
import StrengthPage from './features/strength/StrengthPage'
import DietPage from './features/diet/DietPage'
import BodyPage from './features/body/BodyPage'
import SettingsPage from './features/settings/SettingsPage'

const tabs = [
  { to: '/workouts', label: '训练', icon: '🏋️' },
  { to: '/strength', label: '力量', icon: '📈' },
  { to: '/diet', label: '饮食', icon: '🍚' },
  { to: '/body', label: '身体', icon: '⚖️' },
]

export default function App() {
  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<WorkoutsPage />} />
        <Route path="/workouts" element={<WorkoutsPage />} />
        <Route path="/workouts/:id" element={<WorkoutEditorPage />} />
        <Route path="/exercises/:id" element={<ExerciseDetailPage />} />
        <Route path="/strength" element={<StrengthPage />} />
        <Route path="/diet" element={<DietPage />} />
        <Route path="/body" element={<BodyPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>

      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-gray-200 bg-white">
        <div className="mx-auto flex max-w-md">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center py-2 text-xs ${
                  isActive ? 'text-primary' : 'text-gray-400'
                }`
              }
            >
              <span className="text-xl leading-tight">{t.icon}</span>
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
