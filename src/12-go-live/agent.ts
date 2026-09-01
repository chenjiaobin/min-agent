/**
 * 第 12 篇：上线清单 Demo
 * - 工具 allowlist
 * - 危险工具人工确认
 * - 步数 / 工具次数预算 + 降级收尾
 */
import "dotenv/config";
import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import {
  assertCanLlm,
  assertCanTool,
  BudgetError,
  createBudget,
  markLlm,
  markTool,
} from "./budget.js";
import { loadChunks } from "./kb.js";
import { runTool } from "./tools.js";

const MODEL = "deepseek-v4-flash";

const tools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_policy",
      description:
        "检索内部政策（只读）。用于退款时效等。无命中则勿编造。",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_notice",
      description:
        "向指定邮箱发送通知（会改外部世界，需用户确认）。仅在用户明确要求通知时使用。",
      parameters: {
        type: "object",
        properties: {
          to: {
            type: "string",
            description: "收件人，如 all@company.com",
          },
          body: { type: "string", description: "通知正文" },
        },
        required: ["to", "body"],
      },
    },
  },
];

async function runGoLiveAgent(goal: string): Promise<string> {
  const client = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: "https://api.deepseek.com",
  });

  const budget = createBudget(6, 4);
  const chunks = loadChunks();

  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: [
        "你是带上线刹车的政策助理。",
        "查政策用 search_policy；只有用户明确要求发通知时才用 send_notice。",
        "若工具返回 user_denied / tool_not_allowed / 预算类错误：向用户说明，不要强行重试危险操作。",
        "禁止编造政策数字。最终用简洁中文答复。",
      ].join("\n"),
    },
    { role: "user", content: goal },
  ];

  while (true) {
    try {
      assertCanLlm(budget);
    } catch (e) {
      if (e instanceof BudgetError) {
        return `已触发预算限制（${e.code}）。请缩小目标后重试；以上为未完成状态的安全收尾。`;
      }
      throw e;
    }

    markLlm(budget);
    console.log(
      `\n—— LLM step ${budget.usedSteps}/${budget.maxSteps}（工具 ${budget.usedToolCalls}/${budget.maxToolCalls}）——`,
    );

    const response = await client.chat.completions.create({
      model: MODEL,
      messages,
      tools,
      tool_choice: "auto",
    });

    const msg = response.choices[0]?.message;
    if (!msg) throw new Error("模型无返回");

    if (msg.content?.trim()) console.log(`Thought: ${msg.content.trim()}`);
    messages.push(msg);

    const toolCalls = msg.tool_calls;
    if (!toolCalls?.length) {
      return msg.content?.trim() || "(空回复)";
    }

    for (const call of toolCalls) {
      if (call.type !== "function") continue;

      try {
        assertCanTool(budget);
      } catch (e) {
        if (e instanceof BudgetError) {
          const observation = JSON.stringify({
            ok: false,
            error: e.code,
            tip: "工具调用预算已用尽，请基于已有信息作答或请用户缩小目标，不要继续调工具",
          });
          console.log(`Budget block: ${observation}`);
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: observation,
          });
          continue;
        }
        throw e;
      }

      markTool(budget);
      console.log(`Action: ${call.function.name}(${call.function.arguments})`);
      const observation = await runTool(
        call.function.name,
        call.function.arguments,
        chunks,
      );
      console.log(
        `Observation: ${observation.slice(0, 240)}${observation.length > 240 ? "…" : ""}`,
      );
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: observation,
      });
    }
  }
}

async function main() {
  if (!process.env.DEEPSEEK_API_KEY) {
    console.error("请先在 .env 中设置 DEEPSEEK_API_KEY");
    process.exit(1);
  }

  const goal =
    process.argv.slice(2).join(" ") ||
    "把退款时效发通知给 all@company.com";

  console.log(`Goal: ${goal}`);
  console.log("刹车: allowlist + 危险确认 + 预算降级\n");

  const answer = await runGoLiveAgent(goal);
  console.log(`\nFinal Answer:\n${answer}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
