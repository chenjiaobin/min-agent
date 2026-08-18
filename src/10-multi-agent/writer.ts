import type OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { Blackboard } from "./blackboard.js";
import { log } from "./blackboard.js";

const MODEL = "deepseek-v4-flash";

/** 写手：无搜索工具，只能基于黑板 notes 成稿 */
export async function runWriter(
  client: OpenAI,
  board: Blackboard,
): Promise<void> {
  log(board, "进入写手 Agent");

  const notesText = board.notes
    .map((n, i) => `${i + 1}. [${n.source}] ${n.point}`)
    .join("\n");

  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: [
        "你是写手 Agent。",
        "只能使用用户提供的「黑板 notes」撰写短文，禁止编造 notes 中没有的数字与条款。",
        "你没有搜索工具，也不要假装检索过。",
        "输出结构：正文（200 字以内）→ 依据来源列表。",
        "若 notes 明确资料不足，请直接说明无法成稿及原因。",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `目标：${board.goal}`,
        "",
        "黑板 notes：",
        notesText || "（空）",
        "",
        "请成稿。",
      ].join("\n"),
    },
  ];

  console.log("\n—— 写手（无工具，单次生成）——");
  const response = await client.chat.completions.create({
    model: MODEL,
    messages,
  });

  const draft = response.choices[0]?.message?.content?.trim() || "(空稿)";
  board.draft = draft;
  log(board, `写手完成 draft（${draft.length} 字）`);
  if (response.choices[0]?.message?.content) {
    console.log(`Draft preview: ${draft.slice(0, 180)}…`);
  }
}
