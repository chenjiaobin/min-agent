import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import { runAgent } from "./runner.js";
import type { RunTrace } from "./trace.js";

type EvalCase = {
  id: string;
  goal: string;
  expect?: {
    tools?: string[];
    answerIncludes?: string[];
  };
  forbid?: {
    answerIncludes?: string[];
  };
};

type Check = { name: string; pass: boolean; detail: string };

function loadCases(): EvalCase[] {
  const file = path.join(process.cwd(), "src", "11-obs-eval", "evals", "cases.json");
  return JSON.parse(fs.readFileSync(file, "utf8")) as EvalCase[];
}

function evaluate(c: EvalCase, trace: RunTrace): Check[] {
  const checks: Check[] = [];
  const answer = trace.finalAnswer;

  for (const tool of c.expect?.tools ?? []) {
    const pass = trace.toolNames.includes(tool);
    checks.push({
      name: `called:${tool}`,
      pass,
      detail: pass ? "ok" : `实际工具: ${trace.toolNames.join(",") || "(无)"}`,
    });
  }

  for (const token of c.expect?.answerIncludes ?? []) {
    const pass = answer.includes(token);
    checks.push({
      name: `includes:${token}`,
      pass,
      detail: pass ? "ok" : "最终答复未包含期望片段",
    });
  }

  for (const token of c.forbid?.answerIncludes ?? []) {
    const pass = !answer.includes(token);
    checks.push({
      name: `forbid:${token}`,
      pass,
      detail: pass ? "ok" : "最终答复出现了禁止虚构内容",
    });
  }

  return checks;
}

async function main() {
  if (!process.env.DEEPSEEK_API_KEY) {
    console.error("请先在 .env 中设置 DEEPSEEK_API_KEY");
    process.exit(1);
  }

  const client = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: "https://api.deepseek.com",
  });

  const cases = loadCases();
  let failed = 0;

  console.log(`评测 ${cases.length} 道题\n`);

  for (const c of cases) {
    const tracer = await runAgent(client, c.goal);
    const file = tracer.save();
    const checks = evaluate(c, tracer.toJSON());
    const ok = checks.every((x) => x.pass);
    if (!ok) failed += 1;

    console.log(`${ok ? "PASS" : "FAIL"}  ${c.id}`);
    for (const ch of checks) {
      console.log(`  ${ch.pass ? "✓" : "✗"} ${ch.name}  ${ch.detail}`);
    }
    console.log(`  trace: ${file}\n`);
  }

  console.log(`合计失败 ${failed}/${cases.length}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
