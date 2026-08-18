/**
 * 第 10 篇：多 Agent 最小协作
 * 编排：研究员（可搜索 → 写黑板）→ 写手（只读黑板 → 成稿）
 */
import "dotenv/config";
import OpenAI from "openai";
import { createBoard } from "./blackboard.js";
import { runResearcher } from "./researcher.js";
import { runWriter } from "./writer.js";

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});

async function main() {
  if (!process.env.DEEPSEEK_API_KEY) {
    console.error("请先在 .env 中设置 DEEPSEEK_API_KEY");
    process.exit(1);
  }

  const goal =
    process.argv.slice(2).join(" ") ||
    "根据笔记，写一段 200 字以内的「杭州差旅报销要点」说明，给新同事看。";

  const board = createBoard(goal);
  console.log(`Goal: ${goal}`);
  console.log("编排: 研究员 → 写手（共享黑板）\n");

  await runResearcher(client, board);
  console.log("\n当前黑板 notes:");
  for (const n of board.notes) {
    console.log(`- [${n.source}] ${n.point}`);
  }

  await runWriter(client, board);

  console.log("\n======== Final Draft ========");
  console.log(board.draft);
  console.log("\n======== Board Log ========");
  for (const line of board.log) console.log(`- ${line}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
