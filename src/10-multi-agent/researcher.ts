import type OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import type { Blackboard } from "./blackboard.js";
import { log } from "./blackboard.js";
import { loadChunks, searchNotes, type Chunk } from "./kb.js";

const MAX_STEPS = 6;
const MODEL = "deepseek-v4-flash";

const tools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_notes",
      description:
        "检索本地笔记。用于差旅标准、报销材料等问题。关键词宜短，如「杭州」「报销」。",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "检索关键词" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_notes",
      description:
        "把已确认的要点写入共享黑板。每条必须包含 source（文件名）与 point（一句话事实）。完成调研后必须调用。",
      parameters: {
        type: "object",
        properties: {
          notes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                source: { type: "string" },
                point: { type: "string" },
              },
              required: ["source", "point"],
            },
          },
        },
        required: ["notes"],
      },
    },
  },
];

function runTool(
  name: string,
  argsJson: string,
  board: Blackboard,
  chunks: Chunk[],
): string {
  try {
    const args = JSON.parse(argsJson || "{}") as Record<string, unknown>;
    if (name === "search_notes") {
      const query = String(args.query ?? "");
      const hits = searchNotes(chunks, query, 3);
      if (hits.length === 0) {
        return JSON.stringify({
          ok: false,
          hits: [],
          tip: "无命中，换词再搜或 write_notes 写入「未找到」说明",
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
    }
    if (name === "write_notes") {
      const notes = (args.notes as { source: string; point: string }[]) ?? [];
      board.notes.push(...notes);
      log(board, `研究员写入 ${notes.length} 条 notes（累计 ${board.notes.length}）`);
      return JSON.stringify({ ok: true, total: board.notes.length });
    }
    return JSON.stringify({ ok: false, error: `未知工具: ${name}` });
  } catch (e) {
    return JSON.stringify({ ok: false, error: String(e) });
  }
}

/** 研究员：可搜索，负责往黑板写 notes */
export async function runResearcher(
  client: OpenAI,
  board: Blackboard,
): Promise<void> {
  log(board, "进入研究员 Agent");

  // 知识库在本轮调研内不变，进入时加载一次即可
  const chunks = loadChunks();

  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: [
        "你是研究员 Agent。",
        "职责：针对用户目标检索笔记，并把可引用要点写入黑板。",
        "必须使用 search_notes 取证；完成时调用 write_notes。",
        "不要撰写给用户的最终长文；要点要短、带 source。",
        "若确实搜不到，write_notes 写一条 point 说明资料不足。",
      ].join("\n"),
    },
    {
      role: "user",
      content: `目标：${board.goal}\n请调研并写入黑板 notes。`,
    },
  ];

  for (let step = 1; step <= MAX_STEPS; step++) {
    console.log(`\n—— 研究员 Step ${step} ——`);
    const response = await client.chat.completions.create({
      model: MODEL,
      messages,
      tools,
      tool_choice: "auto",
    });
    const msg = response.choices[0]?.message;
    if (!msg) throw new Error("研究员无返回");

    if (msg.content?.trim()) console.log(`Thought: ${msg.content.trim()}`);
    messages.push(msg);

    const toolCalls = msg.tool_calls;
    if (!toolCalls?.length) {
      // 若模型直接结束但还没写 notes，补一次提醒意义不大；交给编排检查
      break;
    }

    for (const call of toolCalls) {
      if (call.type !== "function") continue;
      console.log(`Action: ${call.function.name}(${call.function.arguments})`);
      const observation = runTool(
        call.function.name,
        call.function.arguments,
        board,
        chunks,
      );
      console.log(`Observation: ${observation.slice(0, 240)}`);
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: observation,
      });
    }
  }

  if (board.notes.length === 0) {
    board.notes.push({
      source: "(system)",
      point: "研究员未写入有效 notes，请写手告知资料不足。",
    });
    log(board, "研究员未调用 write_notes，已写入兜底说明");
  }
}
