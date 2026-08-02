# min-agent

一个基于 TypeScript + DeepSeek API 的最小化 Agent 示例项目，演示 **ReAct** 循环、Function Calling、System Prompt 组装、长期偏好记忆，以及 **Plan-and-Execute（规划 → 执行 → 汇总）** 多 Agent 协作。

## 环境要求

| 项 | 要求 |
| --- | --- |
| Node.js | **≥ 18**（推荐 20 LTS 或更新；`tsx` / `esbuild` 依赖 Node 18+） |
| 包管理器 | npm（项目自带 `package-lock.json`） |
| API | [DeepSeek](https://platform.deepseek.com/) API Key |
| 系统 | Windows / macOS / Linux 均可 |

可选：全局或本地使用 TypeScript 做类型检查（已在 `devDependencies` 中）。

## 目录说明

```
min-agent/
├── src/
│   ├── 02-agent.ts        # 基础版：天气查询 + 摄氏度转华氏度
│   ├── 03-agent.ts        # 进阶版：增加本地笔记搜索等工具
│   ├── 04-agent.ts        # Prompt 版：复用 prompt.ts 组装 System Prompt
│   ├── 05-agent.ts        # 记忆版：交互式 CLI + 长期偏好 + 会话摘要
│   ├── 06-agents/         # 规划执行版（默认启动入口）
│   │   ├── 06-agents.ts   # 入口：创建计划、调度执行、输出最终答复
│   │   ├── planner.ts     # Planner：把目标拆成 2～5 步 JSON 计划
│   │   ├── execute.ts     # Executor：逐步执行，带 Function Calling
│   │   ├── tools.ts       # 执行器工具与本地笔记/草稿写入
│   │   └── plan-store.ts  # 计划持久化与状态管理
│   ├── prompt.ts          # 可配置的 Agent System Prompt 构建器
│   ├── tools.ts           # 05 版工具定义
│   ├── memory.ts          # 会话过长时压缩为摘要
│   └── profile.ts         # 用户长期偏好读写
├── plans/                 # 运行时生成的计划 JSON（plans/plan_*.json）
├── output/                # 执行器输出的草稿（如 draft.md）
├── profile.json           # 05 版用户档案
├── assets/
│   └── gzh.png            # 公众号扫码图
├── package.json
├── tsconfig.json
├── .env.example
├── .env
└── .gitignore
```

各版本大致演进：

1. **02**：最少工具集，理解多步 tool call
2. **03**：更多工具（如 `search_notes`）+ ReAct 思考日志
3. **04**：把「角色 / 完成标准 / 重试 / 输出契约」抽到 `buildSystemPrompt`
4. **05**：模块化拆分（`tools` / `memory` / `profile`），支持多轮对话、长期偏好与上下文压缩
5. **06**：Plan-and-Execute 架构
   - **Planner** 生成结构化计划
   - **Executor** 逐步执行（每步独立 ReAct 工具循环）
   - 计划落盘到 `plans/`，草稿输出到 `output/draft.md`

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
# Windows (PowerShell)
Copy-Item .env.example .env

# macOS / Linux
cp .env.example .env
```

编辑 `.env`，填入真实密钥：

```env
DEEPSEEK_API_KEY=sk-你的密钥
```

> **安全提醒**：`.env` 已加入 `.gitignore`，请勿把密钥写进代码或提交到仓库。若密钥曾泄露，请在 DeepSeek 控制台立即轮换。

### 3. 启动

默认运行 `src/06-agents/06-agents.ts`（规划执行 Agent）：

```bash
npm start
```

不传参数时，会使用内置示例目标（整理笔记、汇总预算、生成周报草稿）。

自定义目标：

```bash
npm start -- 根据笔记整理本周工作要点并保存周报草稿
```

恢复计划（参数已预留，`--resume` 逻辑仍在完善中）：

```bash
npm start -- --resume plan_1785683497584
```

运行其他版本：

```bash
npx tsx src/02-agent.ts
npx tsx src/03-agent.ts
npx tsx src/04-agent.ts
npx tsx src/05-agent.ts
npx tsx src/06-agents/06-agents.ts
```

05 版为交互式 CLI，启动后输入问题；输入 `exit` 或 `quit` 退出。

### 4. 类型检查（可选）

```bash
npm run typecheck
```

## 06 规划执行版能力

06 采用 **Plan-and-Execute** 模式，把「规划」和「执行」拆开：

| 角色 | 模块 | 职责 |
| --- | --- | --- |
| Planner | `planner.ts` | 根据用户目标生成 2～5 步 JSON 计划 |
| Executor | `execute.ts` | 每次只执行一个步骤，可调用工具 |
| Plan Store | `plan-store.ts` | 管理 `pending / running / completed / failed` 状态并落盘 |

执行器可用工具：

| 工具 | 说明 |
| --- | --- |
| `search_notes` | 搜索本地笔记（工作进展、预算、会议等） |
| `sum_numbers` | 对数字数组求和（如汇总预算） |
| `save_draft` | 将 Markdown 草稿写入 `output/draft.md` |

典型流程：

```text
用户目标
  → Planner 生成计划（plans/plan_*.json）
  → Executor 逐步执行（每步内 ReAct + 工具调用）
  → 全部完成后 synthesizeFinalAnswer 汇总
```

控制台会打印每步的 `Action` / `Observation`，便于观察 Agent 行为。

## 05 记忆版能力

05 在单轮脚本之上增加了三类能力：

| 能力 | 模块 | 说明 |
| --- | --- | --- |
| 工具集中管理 | `tools.ts` | 统一声明 `search_notes`、`get_weather`、`celsius_to_fahrenheit`、`add`、`remember_preference`、`get_profile` |
| 长期偏好 | `profile.ts` + `profile.json` | 跨会话保存姓名、城市、风格、稳定事实；写入后会重建 System Prompt |
| 会话摘要 | `memory.ts` | 非 system 消息超过阈值时，把旧轮次压成摘要，并保留最近若干条 |

常用对话示例：

```text
你：我叫 Jovan，住在深圳，回答请尽量简短
你：我家那边天气怎么样？
你：我是谁？偏好是什么？
```

Agent 会通过 `remember_preference` / `get_profile` 读写本地档案，而不是凭空编造。

## 技术栈

- **运行时**：Node.js + ESM（`"type": "module"`）
- **执行**：[`tsx`](https://github.com/privatenumber/tsx) 直接运行 TypeScript
- **模型 SDK**：[`openai`](https://github.com/openai/openai-node)（兼容 DeepSeek OpenAI 风格接口）
- **配置**：[`dotenv`](https://github.com/motdotla/dotenv) 加载 `.env`
- **模型**：代码中默认使用 `deepseek-v4-flash`，`baseURL` 为 `https://api.deepseek.com`

## 工作原理（简要）

1. 用 System Prompt 约束 Agent 角色与完成标准（05 另附「用户长期偏好」system 段）
2. 向模型注册一组 `tools`（Function Calling）
3. 在循环中：模型可返回 `tool_calls` → 本地执行工具 → 把 Observation 写回消息 → 直至得到最终答复或达到 `MAX_STEPS`
4. 多轮交互时：消息过长则调用 `createSessionSummary` 压缩历史；偏好变更则落盘并刷新 system 提示
5. **06 规划执行**：Planner 先拆任务 → Executor 按步骤执行 → 每步结果写入计划 → 最后统一汇总答复

## 常用脚本

| 命令 | 说明 |
| --- | --- |
| `npm start` | 启动默认 Agent（`src/06-agents/06-agents.ts`） |
| `npm run typecheck` | `tsc --noEmit` 类型检查 |

## 许可

ISC

## 关注作者

觉得有帮助的话，欢迎扫码关注公众号，获取更多 AI / Agent 相关内容，项目中的每个 Agent 步骤都有详细文章说明：

<p align="center">
  <img src="assets/gzh.png" alt="公众号二维码" width="280" />
</p>
