# min-agent

一个基于 TypeScript + DeepSeek API 的最小化 Agent 示例项目，演示 **ReAct（思考 → 调用工具 → 观察）** 循环、Function Calling，以及可复用的 System Prompt 组装。

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
│   ├── 02-agent.ts   # 基础版：天气查询 + 摄氏度转华氏度
│   ├── 03-agent.ts   # 进阶版：在 02 基础上增加本地笔记搜索等工具（默认启动入口）
│   ├── 04-agent.ts   # 最新版：复用 prompt.ts 组装 System Prompt
│   └── prompt.ts     # 可配置的 Agent System Prompt 构建器
├── assets/
│   └── gzh.png       # 公众号扫码图
├── package.json      # 依赖与脚本
├── tsconfig.json     # TypeScript 配置（strict）
├── .env.example      # 环境变量模板（可提交）
├── .env              # 本地密钥（已被 .gitignore 忽略，勿提交）
└── .gitignore
```

各版本大致演进：

1. **02**：最少工具集，理解多步 tool call
2. **03**：更多工具（如 `search_notes`）
3. **04**：把「角色 / 完成标准 / 重试 / 输出契约」抽到 `buildSystemPrompt`

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

默认运行 `src/03-agent.ts`：

```bash
npm start
```

运行其他版本：

```bash
npx tsx src/02-agent.ts
npx tsx src/04-agent.ts
```

### 4. 类型检查（可选）

```bash
npm run typecheck
```

## 技术栈

- **运行时**：Node.js + ESM（`"type": "module"`）
- **执行**：[`tsx`](https://github.com/privatenumber/tsx) 直接运行 TypeScript
- **模型 SDK**：[`openai`](https://github.com/openai/openai-node)（兼容 DeepSeek OpenAI 风格接口）
- **配置**：[`dotenv`](https://github.com/motdotla/dotenv) 加载 `.env`
- **模型**：代码中默认使用 `deepseek-v4-flash`，`baseURL` 为 `https://api.deepseek.com`

## 工作原理（简要）

1. 用 System Prompt 约束 Agent 角色与完成标准
2. 向模型注册一组 `tools`（Function Calling）
3. 在循环中：模型可返回 `tool_calls` → 本地执行工具 → 把 Observation 写回消息 → 直至得到最终答复或达到 `MAX_STEPS`

## 常用脚本

| 命令 | 说明 |
| --- | --- |
| `npm start` | 启动默认 Agent（`src/03-agent.ts`） |
| `npm run typecheck` | `tsc --noEmit` 类型检查 |

## 许可

ISC

## 关注作者

觉得有帮助的话，欢迎扫码关注公众号，获取更多 AI / Agent 相关内容，项目中的每个Agent步骤都有详细文章说明：

<p align="center">
  <img src="assets/gzh.png" alt="公众号二维码" width="280" />
</p>
