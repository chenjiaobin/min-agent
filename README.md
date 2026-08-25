# min-agent

一个基于 TypeScript + DeepSeek API 的最小化 Agent 示例项目，按步骤演示：

- **ReAct**（思考 → 调用工具 → 观察）
- Function Calling / System Prompt 组装
- 长期偏好记忆与会话摘要
- **Plan-and-Execute**（规划 → 执行 → 汇总）多 Agent 协作
- 本地 Markdown **知识库检索（轻量 RAG）**
- **工具设计对比**（烂工具 vs 好工具）
- **LangGraph** 状态图 Agent（图编排 + 条件边）
- **多 Agent 协作**（研究员检索写黑板 → 写手只读成稿）
- **可观测性与评测**（Trace 落盘 + 用例断言）

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
│   ├── 02-agent.ts              # 基础版：天气查询 + 摄氏度转华氏度
│   ├── 03-agent.ts              # 进阶版：增加本地笔记搜索等工具
│   ├── 04-agent.ts              # Prompt 版：复用 prompt.ts 组装 System Prompt
│   ├── 05-agent.ts              # 记忆版：交互式 CLI + 长期偏好 + 会话摘要
│   ├── 06-agents/               # 规划执行版（Plan-and-Execute）
│   │   ├── 06-agents.ts         # 入口：创建计划、调度执行、输出最终答复
│   │   ├── planner.ts           # Planner：把目标拆成 2～5 步 JSON 计划
│   │   ├── execute.ts           # Executor：逐步执行，带 Function Calling
│   │   ├── tools.ts             # 执行器工具与本地笔记/草稿写入
│   │   └── plan-store.ts        # 计划持久化与状态管理
│   ├── 07-agents/               # 知识库检索版（轻量 RAG）
│   │   ├── 07-agents.ts         # 入口：交互式政策/笔记问答
│   │   ├── knowledge.ts         # 加载 knowledge/*.md 并切块
│   │   ├── chunk.ts             # 按 ## 标题切块 + 关键词检索
│   │   └── knowledge/           # 本地知识库（退款、差旅、系列备忘等）
│   ├── 08-tool-design/          # 工具设计对比版
│   │   ├── agent.ts             # 入口：--bad / --good 切换工具实现
│   │   ├── tools-bad.ts         # 反面教材：含糊描述、空串、抛异常
│   │   ├── tools-good.ts        # 正面示例：清晰说明书、结构化返回、失败 tip
│   │   ├── kb.ts                # 知识块加载与关键词检索
│   │   ├── prompt.ts            # 按模式组装 System Prompt
│   │   └── knowledge/           # 政策文档（退款、差旅）
│   ├── 09-langgraph.ts          # LangGraph 版：状态图编排 ReAct
│   ├── 10-multi-agent/          # 多 Agent 协作版
│   │   ├── agent.ts             # 入口：研究员 → 写手
│   │   ├── blackboard.ts        # 共享黑板（goal / notes / draft / log）
│   │   ├── researcher.ts        # 研究员：search_notes + write_notes
│   │   ├── writer.ts            # 写手：无工具，只读黑板成稿
│   │   ├── kb.ts                # 本地笔记切块与检索
│   │   └── knowledge/           # 差旅报销、入职须知等笔记
│   ├── 11-obs-eval/             # 可观测性 + 评测版（默认启动入口）
│   │   ├── agent.ts             # 单次运行：答一题并保存 Trace
│   │   ├── eval.ts              # 批量评测：跑 cases.json 并断言
│   │   ├── runner.ts            # ReAct 循环 + 埋点
│   │   ├── trace.ts             # Tracer：事件记录与落盘
│   │   ├── kb.ts                # 政策知识库检索
│   │   ├── knowledge/           # 退款政策等
│   │   └── evals/cases.json     # 评测用例（expect / forbid）
│   ├── prompt.ts                # 可配置的 Agent System Prompt 构建器（02～05）
│   ├── tools.ts                 # 05 版工具定义
│   ├── memory.ts                # 会话过长时压缩为摘要
│   └── profile.ts               # 用户长期偏好读写
├── traces/                      # 运行时 Trace JSON（traces/run-*.json，已忽略）
├── plans/                       # 运行时生成的计划 JSON（plans/plan_*.json）
├── output/                      # 执行器输出的草稿（如 draft.md）
├── profile.json                 # 05 版用户档案
├── assets/
│   └── gzh.png                  # 公众号扫码图
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
5. **06**：Plan-and-Execute — Planner 生成计划，Executor 逐步执行并落盘
6. **07**：本地 Markdown 知识库切块 + `search_knowledge` 检索问答
7. **08**：同一知识库下对比「烂工具 / 好工具」，体会工具说明书与返回契约的重要性
8. **09**：用 LangGraph 把手搓循环改成状态图（`llmCall` ↔ `toolNode` + 条件边）
9. **10**：多 Agent 最小协作 — 研究员检索并写入黑板，写手只读 notes 成稿
10. **11**：给 Agent 加 Trace 与评测集，让行为可回放、可回归

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

默认运行 `src/11-obs-eval/agent.ts`（带 Trace 的政策助理）：

```bash
npm start
```

不传参数时使用内置示例目标（退款审核时效）。自定义目标：

```bash
npm start -- 签收后几天内可以无理由退款？请给出依据和来源。
```

跑完后会在 `traces/` 写入一份 `run-*.json`。

批量评测（读 `evals/cases.json`，失败则 exit 1）：

```bash
npm run eval
```

运行其他版本：

```bash
npx tsx src/02-agent.ts
npx tsx src/03-agent.ts
npx tsx src/04-agent.ts
npx tsx src/05-agent.ts
npx tsx src/06-agents/06-agents.ts
npx tsx src/06-agents/06-agents.ts -- 根据笔记整理本周工作要点并保存周报草稿
npx tsx src/07-agents/07-agents.ts
npx tsx src/08-tool-design/agent.ts --good
npx tsx src/08-tool-design/agent.ts --bad
npx tsx src/09-langgraph.ts
npx tsx src/10-multi-agent/agent.ts
npx tsx src/11-obs-eval/agent.ts
npx tsx src/11-obs-eval/eval.ts
```

05 / 07 / 08 为交互式 CLI，启动后输入问题；输入 `exit` 或 `quit` 退出。

### 4. 类型检查（可选）

```bash
npm run typecheck
```

## 11 可观测性与评测版

11 在「会调用 `search_policy` 的政策助理」之上，补上两条工程能力：**Trace（可回放）** 与 **Eval（可回归）**。

```text
goal
  → runner（ReAct + search_policy）
  → Tracer.record(llm / tool / final)
  → traces/run-*.json
  → eval.ts 按 cases.json 断言 PASS/FAIL
```

| 模块 | 职责 |
| --- | --- |
| `trace.ts` | `Tracer`：记录事件、汇总 `toolNames` / `finalAnswer`，落盘 JSON |
| `runner.ts` | 政策问答 ReAct 循环，每步埋点 |
| `agent.ts` | 单次运行入口 |
| `eval.ts` | 批量跑用例并检查 expect / forbid |
| `evals/cases.json` | 评测题：期望调用的工具、答复须包含/禁止出现的片段 |

内置用例示例：

| id | 考查点 |
| --- | --- |
| `refund-sla` | 必须调用 `search_policy`，答复含「工作日」「来源」 |
| `unknown-topic` | 未知话题仍应检索；禁止编造「30天年假」 |
| `must-search` | 无理由退款时效须检索，答复含「7」 |

可直接改 `cases.json` 扩题，不必改评测引擎。

## 10 多 Agent 协作版

10 演示最小多 Agent 流水线：两个角色**不共享对话历史**，只通过黑板传递可验收事实。

```text
用户目标
  → 研究员（可调用 search_notes / write_notes）
  → 黑板 notes[]（source + point）
  → 写手（无工具，只读 notes 成稿）
  → board.draft
```

| 模块 | 职责 |
| --- | --- |
| `blackboard.ts` | 共享状态：`goal`、`notes`、`draft`、`log` |
| `researcher.ts` | 检索本地 `knowledge/*.md`，把带来源的要点写入黑板 |
| `writer.ts` | 禁止搜索、禁止编造；200 字以内正文 + 依据来源 |
| `kb.ts` | 按 `##` 切块 + 关键词检索 |
| `agent.ts` | 顺序编排：研究员跑完再跑写手，最后打印草稿与 board log |

写手看不到研究员的 Thought / Observation，只能看到 `notes`。这避免把整段检索过程塞进第二个模型的上下文。

## 09 LangGraph 版

09 用 [@langchain/langgraph](https://langchain-ai.github.io/langgraphjs/) 把「手搓 while 循环」改成显式状态图，语义与第 03 篇 ReAct 一致，但路由由图边表达。

图结构：

```text
START → llmCall ─┬─(有 tool_calls)→ toolNode → llmCall → …
                 └─(无工具 / 达上限)→ END
```

| 部分 | 说明 |
| --- | --- |
| 状态 | `MessagesAnnotation`：对话消息列表自动追加 |
| `llmCall` | `ChatOpenAI.bindTools` 调模型，打印 Thought / Action |
| `toolNode` | 按 `tool_calls` 执行本地工具，写回 `ToolMessage`（带 `tool_call_id`） |
| `shouldContinue` | 条件边：有工具则进 `toolNode`，否则 `END`；超过 `MAX_STEPS` 强制结束 |
| 工具 | `get_weather`、`celsius_to_fahrenheit`（Zod schema + `tool()`） |

类型守卫请用 `AIMessage.isInstance(msg)`（`isAIMessage` 已弃用）。

DeepSeek 通过 OpenAI 兼容协议接入：`ChatOpenAI` + `baseURL: https://api.deepseek.com`。

## 08 工具设计对比

08 用同一套政策知识库，切换两套工具实现，演示 **工具说明书、参数命名、返回结构、失败处理** 如何影响 Agent 表现。

| 模式 | 启动 | 工具名 | 特点 |
| --- | --- | --- | --- |
| 好工具 | `npx tsx src/08-tool-design/agent.ts --good` | `search_policy` | 描述清晰、结构化 JSON（`ok` / `hits` / `tip`）、空结果给 tip |
| 烂工具 | `npx tsx src/08-tool-design/agent.ts --bad` | `search` | 描述含糊、空结果返回空串、解析失败抛异常 |

## 07 知识库检索版

07 演示轻量 RAG：启动时扫描 `src/07-agents/knowledge/*.md`，按 `##` 标题切块，对话中通过 `search_knowledge` 检索后再回答。

| 模块 | 职责 |
| --- | --- |
| `knowledge.ts` | 加载 Markdown 并切块索引 |
| `chunk.ts` | 按标题切块 + 关键词打分检索 |
| `07-agents.ts` | ReAct 循环 + 交互式问答 |

输出契约：结论 → 依据 → 来源（文件名 + 标题）。可自行往 `knowledge/` 加 `.md` 文件扩展知识库。

## 06 规划执行版

06 采用 **Plan-and-Execute**，把「规划」和「执行」拆开：

| 角色 | 模块 | 职责 |
| --- | --- | --- |
| Planner | `planner.ts` | 根据用户目标生成 2～5 步 JSON 计划 |
| Executor | `execute.ts` | 每次只执行一个步骤，可调用工具 |
| Plan Store | `plan-store.ts` | 管理 `pending / running / completed / failed` 状态并落盘 |

执行器可用工具：`search_notes`、`sum_numbers`、`save_draft`（写入 `output/draft.md`）。

典型流程：

```text
用户目标
  → Planner 生成计划（plans/plan_*.json）
  → Executor 逐步执行（每步内 ReAct + 工具调用）
  → 全部完成后 synthesizeFinalAnswer 汇总
```

## 05 记忆版能力

| 能力 | 模块 | 说明 |
| --- | --- | --- |
| 工具集中管理 | `tools.ts` | 统一声明搜索、天气、换算、偏好读写等工具 |
| 长期偏好 | `profile.ts` + `profile.json` | 跨会话保存姓名、城市、风格等；写入后重建 System Prompt |
| 会话摘要 | `memory.ts` | 消息过长时把旧轮次压成摘要，保留最近若干条 |

## 技术栈

- **运行时**：Node.js + ESM（`"type": "module"`）
- **执行**：[`tsx`](https://github.com/privatenumber/tsx) 直接运行 TypeScript
- **模型 SDK**：[`openai`](https://github.com/openai/openai-node)（02～08 手搓示例）
- **LangChain / LangGraph**：`@langchain/core`、`@langchain/openai`、`@langchain/langgraph`（09）
- **多 Agent**：10 用手搓 OpenAI SDK + 共享黑板（不依赖 LangGraph Supervisor）
- **校验**：[`zod`](https://zod.dev/)（09 工具参数 schema）
- **配置**：[`dotenv`](https://github.com/motdotla/dotenv) 加载 `.env`
- **模型**：默认 `deepseek-v4-flash`；`baseURL` 为 `https://api.deepseek.com`

## 工作原理（简要）

1. 用 System Prompt 约束角色与完成标准
2. 向模型注册 `tools`（Function Calling）
3. 循环：`tool_calls` → 本地执行 → Observation 写回 → 最终答复或达到 `MAX_STEPS`
4. 多轮时：过长则摘要压缩；偏好变更则落盘并刷新 system
5. **06**：Planner 拆任务 → Executor 逐步执行 → 汇总
6. **07 / 08**：先检索本地知识块，再据 Observation 作答；08 额外对比工具契约质量
7. **09**：用 StateGraph 显式表达「决策节点 / 执行节点 / 条件边」，替代手写 while
8. **10**：研究员写黑板 → 写手读黑板；协作靠结构化 notes，而不是拼接两段聊天记录
9. **11**：运行时写入 Trace；评测集断言工具调用与答复内容，形成最小回归闭环

## 常用脚本

| 命令 | 说明 |
| --- | --- |
| `npm start` | 启动默认 Agent（`src/11-obs-eval/agent.ts`），并保存 Trace |
| `npm run eval` | 跑 `11-obs-eval` 评测集，失败非 0 退出 |
| `npm run typecheck` | `tsc --noEmit` 类型检查 |

## 许可

ISC

## 关注作者

觉得有帮助的话，欢迎扫码关注公众号，获取更多 AI / Agent 相关内容，项目中的每个 Agent 步骤都有详细文章说明：

<p align="center">
  <img src="assets/gzh.png" alt="公众号二维码" width="280" />
</p>
