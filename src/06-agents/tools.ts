import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import path from "node:path";
import fs from "node:fs";
import process from "node:process";

export const executorTools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_notes",
      description:
        "在本地笔记中按关键词搜索。用于查找本周工作、预算、会议等待办与进展。",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "搜索关键词" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "sum_numbers",
      description: "对一组数字求和，用于汇总预算等。",
      parameters: {
        type: "object",
        properties: {
          numbers: {
            type: "array",
            items: { type: "number" },
            description: "要求和的数字列表",
          },
        },
        required: ["numbers"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_draft",
      description: "将 Markdown 周报草稿保存到 output/draft.md",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string", description: "Markdown 正文" },
        },
        required: ["content"],
      },
    },
  },
];

const NOTES: { title: string; body: string }[] = [
  {
    title: "周一进展",
    body: "完成 Agent 系列第 05 篇记忆章节；与产品对齐周报模板。",
  },
  {
    title: "出差杭州",
    body: "周三至周四在杭州客户现场；餐饮预算 800 元，高铁交通 450 元。",
  },
  {
    title: "周五会议",
    body: "下午评审 Plan-and-Execute 方案，待补充下周排期。",
  },
  {
    title: "预算备忘",
    body: "本月差旅餐饮合计 800，交通 450，需写入周报。",
  },
];

export function buildExecutorMessages(
  goal: string,
  stepTitle: string,
  stepId: number,
  doneContext: string,
): ChatCompletionMessageParam[] {
  return [
    {
      role: "system",
      content: [
        `你是步骤执行器。总目标：${goal}`,
        `当前只需完成：步骤 ${stepId}「${stepTitle}」`,
        "已完成步骤摘要：",
        doneContext || "（无）",
        "",
        "规则：",
        "- 需要事实或计算时必须调用工具",
        "- 禁止编造笔记内容",
        "- 完成本步后，用一段简洁中文总结本步 result",
        "- 不要执行后续步骤的任务",
      ].join("\n"),
    },
    {
      role: "user",
      content: `请完成步骤 ${stepId}：${stepTitle}`,
    },
  ];
}

export function runTool(name: string, argsJson: string): string {
  try {
    const args = JSON.parse(argsJson || "{}") as Record<string, unknown>;
    switch (name) {
      case "search_notes": {
        const q = String(args.query ?? "").toLowerCase();
        const hits = NOTES.filter(
          (n) =>
            n.title.toLowerCase().includes(q) ||
            n.body.toLowerCase().includes(q),
        );
        return JSON.stringify({ hits, count: hits.length });
      }
      case "sum_numbers": {
        const nums = (args.numbers as number[]) ?? [];
        const sum = nums.reduce((a, b) => a + b, 0);
        return JSON.stringify({ numbers: nums, sum });
      }
      case "save_draft": {
        const content = String(args.content ?? "");
        const outDir = path.join(process.cwd(), "output");
        fs.mkdirSync(outDir, { recursive: true });
        const file = path.join(outDir, "draft.md");
        fs.writeFileSync(file, content, "utf8");
        return JSON.stringify({ ok: true, path: file, bytes: content.length });
      }
      default:
        return JSON.stringify({ error: `未知工具: ${name}` });
    }
  } catch (e) {
    return JSON.stringify({ error: String(e) });
  }
}