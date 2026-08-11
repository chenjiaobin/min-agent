import "dotenv/config";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import type { DocChunk } from "./kb.js";
import { buildSystemPrompt } from "./prompt.js";
import { badTools, loadBadChunks, runBadTool } from "./tools-bad.js";
import { goodTools, loadGoodChunks, runGoodTool } from "./tools-good.js";

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});

const MODEL = "deepseek-chat";
const MAX_STEPS = 6;

type Mode = "bad" | "good";

function parseMode(argv: string[]): Mode {
  if (argv.includes("--bad")) return "bad";
  return "good";
}

function runTool(
  mode: Mode,
  name: string,
  argsJson: string,
  chunks: DocChunk[],
): string {
  if (mode === "bad") {
    return runBadTool(name, argsJson, chunks);
  }
  return runGoodTool(name, argsJson, chunks);
}

async function runToolLoop(
  mode: Mode,
  tools: ChatCompletionTool[],
  chunks: DocChunk[],
  messages: ChatCompletionMessageParam[],
): Promise<string> {
  for (let step = 1; step <= MAX_STEPS; step++) {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages,
      tools,
      tool_choice: "auto",
    });

    const msg = response.choices[0]?.message;
    if (!msg) throw new Error("模型没有返回 message");

    const thought = msg.content?.trim();
    console.log(`\n—— Step ${step} ——`);
    console.log(`Thought: ${thought || "(无文字)"}`);
    messages.push(msg);

    const toolCalls = msg.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      return thought || "(空回复)";
    }

    for (const call of toolCalls) {
      if (call.type !== "function") continue;
      const { name, arguments: argsJson } = call.function;
      console.log(`Action: ${name}`);
      console.log(`Action Input: ${argsJson}`);

      let observation: string;
      try {
        observation = runTool(mode, name, argsJson, chunks);
      } catch (e) {
        // 演示烂工具抛错：仍尽量写回 Observation，避免直接崩掉整次会话
        observation = `TOOL_EXCEPTION: ${String(e)}`;
        console.log(`(捕获异常，写入 Observation) ${observation}`);
      }

      console.log(
        `Observation: ${observation.slice(0, 280)}${observation.length > 280 ? "…" : ""}`,
      );

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: observation || "(empty)",
      });
    }
  }
  return `未在 ${MAX_STEPS} 步内完成。`;
}

async function main() {
  if (!process.env.DEEPSEEK_API_KEY) {
    console.error("请先在 .env 中设置 DEEPSEEK_API_KEY");
    process.exit(1);
  }

  const mode = parseMode(process.argv.slice(2));
  const tools = mode === "bad" ? badTools : goodTools;
  const chunks = mode === "bad" ? loadBadChunks() : loadGoodChunks();

  console.log(`工具模式: ${mode === "bad" ? "烂工具 (--bad)" : "好工具 (--good)"}`);
  console.log(`已加载知识块: ${chunks.length}`);
  console.log(chunks);
  console.log("建议同一问题各跑一遍对比。输入 exit 结束。\n");

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPrompt(mode) },
  ];

  const rl = readline.createInterface({ input, output });

  while (true) {
    const goal = (await rl.question("你：")).trim();
    if (!goal) continue;
    if (["exit", "quit", "q"].includes(goal.toLowerCase())) break;

    messages.push({ role: "user", content: goal });
    const answer = await runToolLoop(mode, tools, chunks, messages);
    console.log(`\nFinal Answer:\n${answer}\n`);
  }

  rl.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
