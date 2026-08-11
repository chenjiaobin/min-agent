import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { keywordSearch, loadChunks, type DocChunk } from "./kb.js";

/** 正面示例：说明书清晰、结构化返回、失败带 tip */
export const goodTools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_policy",
      description:
        "检索内部政策文档片段。用于退款时效、差旅标准等制度问题。关键词宜短且具体，如「退款审核」「到账」。无命中返回 hits:[] 与 tip，请换词再搜或向用户说明资料不足，禁止编造。",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "检索关键词或短问句",
          },
          topK: {
            type: "number",
            description: "返回条数，默认 3，最大 5",
          },
        },
        required: ["query"],
      },
    },
  },
];

export function runGoodTool(
  name: string,
  argsJson: string,
  chunks: DocChunk[],
): string {
  if (name !== "search_policy") {
    return JSON.stringify({
      ok: false,
      error: `未知工具: ${name}`,
      tip: "仅可使用 search_policy",
    });
  }

  try {
    const args = JSON.parse(argsJson || "{}") as {
      query?: string;
      topK?: number;
    };
    const query = String(args.query ?? "").trim();
    if (!query) {
      return JSON.stringify({
        ok: false,
        hits: [],
        error: "query 不能为空",
        tip: "请提供具体关键词后再调用 search_policy",
      });
    }

    const topK = Math.min(5, Math.max(1, Number(args.topK) || 3));
    const hits = keywordSearch(chunks, query, topK);

    if (hits.length === 0) {
      return JSON.stringify({
        ok: false,
        hits: [],
        tip: "无匹配片段，请换更短的关键词（如「退款」「审核」），或告知用户资料不足，禁止编造",
      });
    }

    return JSON.stringify({
      ok: true,
      hits: hits.map((h) => ({
        source: h.source,
        heading: h.heading,
        text: h.text,
        score: h.score,
      })),
      tip: null,
    });
  } catch (e) {
    return JSON.stringify({
      ok: false,
      error: String(e),
      tip: "arguments 需为合法 JSON，请修正后重试",
    });
  }
}

export function loadGoodChunks(): DocChunk[] {
  return loadChunks();
}
