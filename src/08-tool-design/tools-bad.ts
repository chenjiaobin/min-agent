import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { keywordSearch, loadChunks, type DocChunk } from "./kb.js";

/** 反面教材：含糊描述、空串、抛异常 */
export const badTools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search",
      description: "搜索",
      parameters: {
        type: "object",
        properties: {
          q: { type: "string" },
        },
      },
    },
  },
];

export function runBadTool(
  name: string,
  argsJson: string,
  chunks: DocChunk[],
): string {
  if (name !== "search") {
    throw new Error(`unknown tool ${name}`);
  }

  let q = "";
  try {
    const args = JSON.parse(argsJson || "{}") as { q?: string };
    q = String(args.q ?? "");
  } catch {
    // 解析失败直接抛——Executor 若未捕获，循环会断
    throw new Error("bad json");
  }

  if (!q.trim()) {
    // 空结果返回空串：模型很难解读
    return "";
  }

  const hits = keywordSearch(chunks, q, 3);
  if (hits.length === 0) return "";

  // 无结构、无来源，模型只能「感觉上」引用
  return hits.map((h) => h.text).join("\n---\n");
}

export function loadBadChunks(): DocChunk[] {
  return loadChunks();
}
