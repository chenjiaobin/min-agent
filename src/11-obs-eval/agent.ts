import "dotenv/config";
import OpenAI from "openai";
import { runAgent } from "./runner.js";

async function main() {
  if (!process.env.DEEPSEEK_API_KEY) {
    console.error("请先在 .env 中设置 DEEPSEEK_API_KEY");
    process.exit(1);
  }

  const client = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: "https://api.deepseek.com",
  });

  const goal =
    process.argv.slice(2).join(" ") ||
    "退款审核大概要几天？请给出依据和来源。";

  const tracer = await runAgent(client, goal);
  const file = tracer.save();
  const t = tracer.toJSON();

  console.log(`Goal: ${t.goal}`);
  console.log(`Steps: ${t.steps}  tools: ${t.toolNames.join(", ") || "(无)"}`);
  console.log(`Trace: ${file}`);
  console.log(`\nFinal Answer:\n${t.finalAnswer}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
