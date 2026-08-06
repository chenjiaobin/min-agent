import "dotenv/config";
import { OpenAI } from "openai";
import process from "node:process";
import { loadKnowledgeBase } from "./knowledge";
import readline from "node:readline/promises";
import { searchChunks, type chunk } from "./chunk";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";

const MAX_STEPS = 10;
const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});

const tools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_knowledge",
      description:
        "从本地知识库检索相关笔记片段。回答产品政策、差旅标准、写作备忘等问题前必须调用。返回 Top-K 块及来源。",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "检索问句或关键词，尽量具体",
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

function runSearch(chunk: chunk[], argsJson: string) {
  let { query, topK } = JSON.parse(argsJson);
  if (!query) return JSON.stringify({ error: 'query is required' });
  topK = Math.min(5, Math.max(1, topK || 3));
  const hits = searchChunks(chunk, query, topK);
  if (hits.length === 0) return JSON.stringify({ hits: [], tip: "无匹配，可换关键词" });
  return JSON.stringify({
    hits: hits.map((h: { source: any; heading: any; score: any; text: any; id: any; }) => {
      return {
        source: h.source,
        heading: h.heading,
        score: h.score,
        text: h.text,
        id: h.id,
      }
    })
  });
}


async function runTool(chunk: chunk[], messages: ChatCompletionMessageParam[]) {
  for (let i = 0; i < MAX_STEPS; i++) {
    let response = await client.chat.completions.create({
      model: "deepseek-v4-flash",
      messages,
      tools,
      tool_choice: "auto",
    });

    const msg = response.choices[0]?.message;
    if (!msg) throw new Error('No response from the model');

    messages.push(msg);
    let toolCalls = msg.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      return msg.content;
    };

    for (let toolCall of toolCalls) {
      if (toolCall.type !== 'function') continue;
      let { name, arguments: args } = toolCall.function;
      const observation =
        name === "search_knowledge"
          ? runSearch(chunk, args)
          : JSON.stringify({ error: `未知工具: ${name}` });
      messages.push({
        role: 'tool',
        content: observation,
        tool_call_id: toolCall.id,
      })
    }
  }
  return '没有在规定的步数内完成任务';
}

async function main() {
  let messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `
        # 角色
        你是基于本地知识库回答问题的助手。

        # 工具策略
        - 涉及政策、标准、系列备忘等事实问题，必须先调用 search_knowledge。
        - 禁止编造知识库中不存在的数字、时限与条款。
        - 若检索结果 hits 为空或明显不相关：明确说资料不足，并建议换个问法。

        # 思考与行动
        - 调工具前用 1～2 句中文说明检索意图。
        - 行动必须通过 tool_calls。

        # 输出契约
        - 简洁中文。
        - 结构：结论 → 依据（引用片段要点）→ 来源（文件名 + 标题）。
        - 有多条依据时分别标明来源。
      `.trim()
    }
  ]

  const chunk = loadKnowledgeBase();
  console.log('--chunks--', chunk);

  // 创建readline接口，支持多轮对话
  let rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  while (true) {
    const goal = await rl.question('\n你：');
    if ([
      'exit',
      'quit',
      'bye',
      'q',
      'e',
      'quit()',
      'exit()',
    ].includes(goal.toLowerCase())) break;
    if (!goal) continue;
    messages.push({
      role: 'user',
      content: goal,
    })

    const content = await runTool(chunk, messages);
    console.log('\nfinal answer:', content);
  }
  rl.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
})