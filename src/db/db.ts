import Dexie, { type Table } from 'dexie'

// 所有表含 userId，MVP 固定 "local"，为未来多用户/云同步预留
export const CURRENT_USER_ID = 'local'

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'legs'
  | 'arms'
  | 'core'
  | 'fullbody'
  | 'other'

export type ExerciseCategory =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'bodyweight'
  | 'other'

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface User {
  id: string
  name: string
  heightCm?: number
  createdAt: number
}

export interface Exercise {
  id?: number
  userId: string
  name: string
  muscleGroup: MuscleGroup
  category: ExerciseCategory
  isCustom: boolean
  createdAt: number
}

export interface WorkoutSession {
  id?: number
  userId: string
  date: string // YYYY-MM-DD 本地日期
  title?: string
  targetParts: string[]
  note?: string
  createdAt: number
  updatedAt: number
}

export interface WorkoutSet {
  id?: number
  userId: string
  sessionId: number
  exerciseId: number
  weightKg: number
  reps: number
  rpe?: number
  orderIndex: number
  createdAt: number
}

export interface FoodEntry {
  id?: number
  userId: string
  date: string
  mealType: MealType
  name: string
  portion?: string
  kcal: number
  carbsG: number
  proteinG: number
  fatG: number
  createdAt: number
}

export interface NutritionTarget {
  id?: number
  userId: string
  kcalTarget: number
  carbsGTarget: number
  proteinGTarget: number
  fatGTarget: number
  updatedAt: number
}

export interface BodyMetric {
  id?: number
  userId: string
  date: string
  weightKg: number
  bodyFatPct?: number
  createdAt: number
}

export interface BodyMeasurement {
  id?: number
  userId: string
  date: string
  part: string // chest|waist|hip|arm|thigh 或自定义
  valueCm: number
  note?: string
  createdAt: number
}

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: '胸',
  back: '背',
  shoulders: '肩',
  legs: '腿',
  arms: '手臂',
  core: '核心',
  fullbody: '全身',
  other: '其他',
}

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '加餐',
}

export class FitLogDB extends Dexie {
  exercises!: Table<Exercise, number>
  workoutSessions!: Table<WorkoutSession, number>
  workoutSets!: Table<WorkoutSet, number>
  foodEntries!: Table<FoodEntry, number>
  nutritionTargets!: Table<NutritionTarget, number>
  bodyMetrics!: Table<BodyMetric, number>
  bodyMeasurements!: Table<BodyMeasurement, number>

  constructor() {
    super('fitlog')
    this.version(1).stores({
      exercises: '++id, userId, name, muscleGroup, [userId+name]',
      workoutSessions: '++id, userId, date, [userId+date]',
      workoutSets: '++id, userId, sessionId, exerciseId, [sessionId+exerciseId]',
      foodEntries: '++id, userId, date, [userId+date], [userId+date+mealType]',
      nutritionTargets: '++id, userId',
      bodyMetrics: '++id, userId, date, [userId+date]',
      bodyMeasurements: '++id, userId, date, part, [userId+date+part]',
    })
  }
}

export const db = new FitLogDB()

// 预置动作库：仅名称/肌群/器械分类，不含任何营养数据
const SEED_EXERCISES: Array<Pick<Exercise, 'name' | 'muscleGroup' | 'category'>> = [
  { name: '杠铃卧推', muscleGroup: 'chest', category: 'barbell' },
  { name: '上斜哑铃卧推', muscleGroup: 'chest', category: 'dumbbell' },
  { name: '哑铃飞鸟', muscleGroup: 'chest', category: 'dumbbell' },
  { name: '双杠臂屈伸', muscleGroup: 'chest', category: 'bodyweight' },
  { name: '杠铃划船', muscleGroup: 'back', category: 'barbell' },
  { name: '引体向上', muscleGroup: 'back', category: 'bodyweight' },
  { name: '高位下拉', muscleGroup: 'back', category: 'cable' },
  { name: '坐姿划船', muscleGroup: 'back', category: 'machine' },
  { name: '硬拉', muscleGroup: 'back', category: 'barbell' },
  { name: '面拉', muscleGroup: 'back', category: 'cable' },
  { name: '杠铃推举', muscleGroup: 'shoulders', category: 'barbell' },
  { name: '哑铃推肩', muscleGroup: 'shoulders', category: 'dumbbell' },
  { name: '侧平举', muscleGroup: 'shoulders', category: 'dumbbell' },
  { name: '后束飞鸟', muscleGroup: 'shoulders', category: 'dumbbell' },
  { name: '杠铃深蹲', muscleGroup: 'legs', category: 'barbell' },
  { name: '腿举', muscleGroup: 'legs', category: 'machine' },
  { name: '保加利亚分腿蹲', muscleGroup: 'legs', category: 'dumbbell' },
  { name: '罗马尼亚硬拉', muscleGroup: 'legs', category: 'barbell' },
  { name: '腿弯举', muscleGroup: 'legs', category: 'machine' },
  { name: '腿屈伸', muscleGroup: 'legs', category: 'machine' },
  { name: '站姿提踵', muscleGroup: 'legs', category: 'machine' },
  { name: '杠铃弯举', muscleGroup: 'arms', category: 'barbell' },
  { name: '哑铃锤式弯举', muscleGroup: 'arms', category: 'dumbbell' },
  { name: '三头下压', muscleGroup: 'arms', category: 'cable' },
  { name: '仰卧臂屈伸', muscleGroup: 'arms', category: 'barbell' },
  { name: '平板支撑', muscleGroup: 'core', category: 'bodyweight' },
  { name: '卷腹', muscleGroup: 'core', category: 'bodyweight' },
  { name: '悬垂举腿', muscleGroup: 'core', category: 'bodyweight' },
  { name: '农夫行走', muscleGroup: 'fullbody', category: 'dumbbell' },
  { name: '壶铃摆荡', muscleGroup: 'fullbody', category: 'other' },
]

export async function seedIfEmpty(): Promise<void> {
  await db.transaction('rw', db.exercises, db.nutritionTargets, async () => {
    const exerciseCount = await db.exercises.count()
    if (exerciseCount === 0) {
      const now = Date.now()
      await db.exercises.bulkAdd(
        SEED_EXERCISES.map((e) => ({
          ...e,
          userId: CURRENT_USER_ID,
          isCustom: false,
          createdAt: now,
        })),
      )
    }
    const target = await db.nutritionTargets.where('userId').equals(CURRENT_USER_ID).first()
    if (!target) {
      await db.nutritionTargets.add({
        userId: CURRENT_USER_ID,
        kcalTarget: 2000,
        carbsGTarget: 200,
        proteinGTarget: 150,
        fatGTarget: 67,
        updatedAt: Date.now(),
      })
    }
  })
}
