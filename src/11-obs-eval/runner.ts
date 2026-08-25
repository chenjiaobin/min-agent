import type OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import { loadChunks, searchPolicy, type Chunk } from "./kb.js";
import { Tracer } from "./trace.js";

const MODEL = "deepseek-v4-flash";
const MAX_STEPS = 6;

const tools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_policy",
      description:
        "检索内部政策。用于退款时效、售后规则。无命中返回 hits:[] 与 tip，禁止编造。",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "关键词或短问句" },
        },
        required: ["query"],
      },
    },
  },
];

function runTool(name: string, argsJson: string, chunks: Chunk[]): string {
  try {
    const args = JSON.parse(argsJson || "{}") as { query?: string };
    if (name !== "search_policy") {
      return JSON.stringify({ ok: false, error: `未知工具: ${name}` });
    }
    const query = String(args.query ?? "").trim();
    if (!query) {
      return JSON.stringify({
        ok: false,
        hits: [],
        error: "query 为空",
        tip: "请提供关键词后重试",
      });
    }
    const hits = searchPolicy(chunks, query, 3);
    if (hits.length === 0) {
      return JSON.stringify({
        ok: false,
        hits: [],
        tip: "无匹配。请换词，或告知用户资料不足，禁止编造数字。",
      });
    }
    return JSON.stringify({
      ok: true,
      hits: hits.map((h) => ({
        source: h.source,
        heading: h.heading,
        text: h.text,
      })),
    });
  } catch (e) {
    return JSON.stringify({ ok: false, error: String(e) });
  }
}

export async function runAgent(
  client: OpenAI,
  goal: string,
): Promise<Tracer> {
  const tracer = new Tracer(goal);
  const chunks = loadChunks();

  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: [
        "你是政策助理。制度问题必须先调用 search_policy。",
        "禁止编造政策数字。资料不足须明确说明。",
        "最终答复结构：结论 → 依据 → 来源（文件名+标题）。",
      ].join("\n"),
    },
    { role: "user", content: goal },
  ];

  for (let step = 1; step <= MAX_STEPS; step++) {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages,
      tools,
      tool_choice: "auto",
    });
    const msg = response.choices[0]?.message;
    if (!msg) throw new Error("模型无返回");

    tracer.record(
      "llm",
      `step-${step}`,
      { hasToolCalls: Boolean(msg.tool_calls?.length) },
      msg.content,
    );
    messages.push(msg);

    const toolCalls = msg.tool_calls;
    if (!toolCalls?.length) {
      const answer = msg.content?.trim() || "(空回复)";
      tracer.record("final", "answer", goal, answer, { steps: step });
      return tracer;
    }

    for (const call of toolCalls) {
      if (call.type !== "function") continue;
      const observation = runTool(
        call.function.name,
        call.function.arguments,
        chunks,
      );
      tracer.record(
        "tool",
        call.function.name,
        call.function.arguments,
        observation,
      );
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: observation,
      });
    }
  }

  tracer.hitMaxSteps = true;
  tracer.record("final", "answer", goal, `未在 ${MAX_STEPS} 步内完成`, {
    hitMaxSteps: true,
  });
  return tracer;
}
