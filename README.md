# FitLog 健身记录

个人健身记录 Web App（移动端优先 PWA）：记录训练、饮食宏量、体重与身体维度，自动统计训练容量、e1RM 力量趋势、营养达成率与体重变化。

## 启动

```bash
npm install
npm run dev        # 开发：http://localhost:5173
npm test           # 运行单元测试（核心计算模块）
npm run build      # 类型检查 + 生产构建
npm run preview    # 预览生产构建（含 PWA）
```

手机访问：确保手机与电脑同一局域网，用 `npm run dev` 输出的 Network 地址在手机浏览器打开。

## 功能（MVP / P0）

- **训练**：按日期记录训练（部位/备注），动作库（预置 30+）或自定义动作，逐组记录重量/次数/RPE；自动计算总容量 Σ(重量×次数)、总组数、总次数、各动作容量；动作详情页有 e1RM（Epley）趋势、最大重量、PR 历史。
- **饮食**：按早/中/晚/加餐手动录入食物（名称/份量/热量/碳水/蛋白/脂肪，不做营养估算）；每日汇总与目标达成率、剩余量；目标可自定义。
- **身体**：体重/体脂录入，体重 7 日移动平均趋势与本周变化；维度（胸/腰/臀/臂/腿）录入与单项趋势。
- **导出**：训练/饮食/身体三类 CSV（UTF-8 BOM，Excel 可直接打开），在"设置"页。
- **PWA**：可安装到手机主屏，离线可用；数据全部存本机 IndexedDB，不上传。

## 技术栈

React 18 + TypeScript + Vite + Tailwind CSS + Dexie.js (IndexedDB) + Recharts + vite-plugin-pwa + Vitest。

## 目录结构

```
docs/          PRD、数据 Schema 与指标定义、技术方案
src/db/        Dexie 表定义与种子数据（动作库、默认营养目标）
src/core/      纯计算模块：容量、e1RM、PR、营养汇总、7日均线、周变化（含单测）
src/features/  workouts / diet / body / settings 页面
src/utils/     日期（本地时区）、CSV
```

## 数据与单位约定

- 重量 kg、长度 cm、能量 kcal、营养素 g；日期为本地时区 `YYYY-MM-DD`。
- 训练容量 = Σ(重量×次数)，自重动作（重量=0）不计容量；e1RM = 重量×(1+次数/30)。
- 所有表含 `userId` 字段（当前固定 `"local"`），为未来云同步预留。
- 指标口径详见 [docs/SCHEMA.md](docs/SCHEMA.md)。

## 测试

`src/core/metrics.test.ts` 覆盖容量、e1RM、PR 判定、营养汇总、7 日移动平均、周变化等核心口径（19 个用例）。
