# FitLog 数据库 Schema 与指标定义

> 本地存储使用 IndexedDB（Dexie.js），表结构按关系型设计描述，便于未来迁移 SQLite/PostgreSQL 加云同步。
> 约定：重量 `kg`（2 位小数）、长度 `cm`、营养 `g`、能量 `kcal`；日期为本地时区 `YYYY-MM-DD` 字符串；时间戳为 ISO 8601 毫秒。
> 所有表含 `userId`（MVP 固定为 `"local"`），为未来多用户/云同步预留。

## 1. 实体与关系

```
User 1─* WorkoutSession 1─* WorkoutSet *─1 Exercise
User 1─* FoodEntry
User 1─1 NutritionTarget (当前生效一条)
User 1─* BodyMetric          (体重/体脂，每天可多条，取当日最新)
User 1─* BodyMeasurement     (维度，part 可自定义)
User 1─* FavoriteFood        (P1 常用食物，表先建)
User 1─* WorkoutTemplate     (P1 训练模板，表先建)
```

## 2. 表定义

### User（预留，MVP 不建 UI）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | string PK | MVP 固定 `"local"` |
| name | string | 昵称 |
| heightCm | number? | 身高，可选 |
| createdAt | number | 创建时间 |

### Exercise（动作库）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | string PK | cuid |
| userId | string | 归属用户 |
| name | string | 动作名，如"杠铃卧推"；userId 内唯一 |
| muscleGroup | string 枚举 | `chest|back|shoulders|legs|arms|core|fullbody|other`（胸/背/肩/腿/手臂/核心/全身/其他） |
| category | string 枚举 | `barbell|dumbbell|machine|cable|bodyweight|other` |
| isCustom | boolean | 用户自定义动作 |
| createdAt | number | |

### WorkoutSession（训练日）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | string PK | cuid |
| userId | string | |
| date | string | `YYYY-MM-DD` 本地日期；索引 |
| title | string? | 如"推日" |
| targetParts | string[] | 训练部位标签，如 `["胸","三头"]` |
| note | string? | 备注 |
| createdAt / updatedAt | number | |

### WorkoutSet（每组记录）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | string PK | cuid |
| userId | string | |
| sessionId | string FK→WorkoutSession | 索引 |
| exerciseId | string FK→Exercise | 索引 |
| weightKg | number | 重量 kg，自重/徒手动作填 0 |
| reps | number | 次数，正整数 |
| rpe | number? | 1–10，可选，0.5 步进 |
| orderIndex | number | 组序号（动作内展示顺序） |
| createdAt | number | |

### FoodEntry（食物记录）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | string PK | cuid |
| userId | string | |
| date | string | `YYYY-MM-DD`；索引 |
| mealType | string 枚举 | `breakfast|lunch|dinner|snack` |
| name | string | 食物名 |
| portion | string? | 份量描述，如"200g"、"1 碗" |
| kcal | number | 热量 |
| carbsG / proteinG / fatG | number | 碳水/蛋白/脂肪 g |
| createdAt | number | |

### NutritionTarget（营养目标）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | string PK | MVP 单条，id=`"local"` |
| userId | string | |
| kcalTarget | number | 每日热量目标 |
| carbsGTarget / proteinGTarget / fatGTarget | number | 三大营养素目标 g |
| updatedAt | number | |

### BodyMetric（体重/体脂）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | string PK | cuid |
| userId | string | |
| date | string | `YYYY-MM-DD`；索引 |
| weightKg | number | 体重 |
| bodyFatPct | number? | 体脂率 %，可选 |
| createdAt | number | 同日多次记录共存，统计取每日最新一条 |

### BodyMeasurement（维度测量）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | string PK | cuid |
| userId | string | |
| date | string | `YYYY-MM-DD`；索引 |
| part | string | 部位：预置 `chest|waist|hip|arm|thigh` + 自定义文本 |
| valueCm | number | 维度 cm |
| note | string? | |
| createdAt | number | |

### FavoriteFood（P1，表先建）
name / portion / kcal / carbsG / proteinG / fatG —— 保存常用食物供复用，不预置任何营养数据。

### WorkoutTemplate（P1，表先建）
name / targetParts / items: `{exerciseId, sets: [{weightKg, reps, rpe?}] }[]`

## 3. 关键指标定义（计算口径）

| 指标 | 定义 | 说明 |
|---|---|---|
| 组容量 | `weightKg × reps` | 单组 |
| 训练容量 | `Σ(weightKg × reps)`（整次训练） | 自重组（weight=0）不计入容量 |
| 总组数 | 训练内 WorkoutSet 条数 | |
| 总次数 | `Σ reps` | |
| 动作容量 | 按动作分组的 `Σ(weight×reps)` | |
| e1RM（Epley） | `weightKg × (1 + reps/30)` | reps=1 时等于重量；取该动作当日所有组的最大 e1RM 作为当日 e1RM |
| 最大重量 | 该动作历史 `max(weightKg)` | 仅 weight>0 的组参与 |
| PR | 某组 e1RM 或重量刷新历史最高 | PR 列表按时间倒序 |
| 肌群容量 | 按 Exercise.muscleGroup 聚合训练容量 | 用于报表分布图 |
| 日营养汇总 | 按日 `Σ kcal/carbs/protein/fat` | 含加餐 |
| 达成率 | `实际摄入 / 目标 × 100%`，上限显示 150% | 剩余量 = 目标 − 实际（可为负） |
| 体重 7 日移动平均 | 第 D 天 = 最近 7 天（D-6..D）内有记录的体重算术平均 | 记录不足 7 天时按已有天数平均，≥1 条才出点 |
| 每周体重变化 | 本周日均 − 上周日均（按 7 日均线再平均） | |
| 周训练统计 | 自然周（周一为一周开始）内：训练次数、总容量、总组数 | |
| 周报营养均值 | 本周有记录天数的日均热量/宏量 | 不按 7 天平摊 |

## 4. 种子数据

- 动作库预置约 30 个常见动作（仅名称/肌群/器械分类，**不含营养数据**）：卧推、上斜哑铃卧推、杠铃划船、引体向上、硬拉、深蹲、腿举、哑铃推肩、侧平举、弯举、三头下压、平板支撑等。
- 一条默认营养目标：2000 kcal / 碳水 200g / 蛋白 150g / 脂肪 67g（用户可在设置中修改）。
- 不预置任何训练/饮食/身体记录。
