import "dotenv/config";
import OpenAI from "openai";
import process from "node:process";
import { type Plan, printPlan, getNextPendingStep, savePlan } from "./plan-store";
import { createPlan, synthesizeFinalAnswer } from "./planner";
import { executeStep } from "./execute";

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});
const model = 'deepseek-v4-flash';

function parseArgs(argv: string[]): { resumeId?: string; goal: string } {
  const resumeIdx = argv.indexOf("--resume");
  if (resumeIdx !== -1) {
    const id = argv[resumeIdx + 1];
    if (!id) {
      console.error("用法: npm start -- --resume <plan-id>");
      process.exit(1);
    }
    return { resumeId: id, goal: "" };
  }
  const goal = argv.join(" ").trim();
  if (!goal) {
    return {
      goal: "根据笔记整理本周工作要点，汇总差旅预算，并生成给老板的周报大纲保存为草稿",
    };
  }
  return { goal };
}

async function runPlan(plan: Plan) {
  printPlan(plan);

  while (true) {
    const step = getNextPendingStep(plan);
    if (!step) break;

    console.log(`\n[Executor] Step ${step.id}/${plan.steps.length}: ${step.title}`);
    step.status = "running";
    savePlan(plan);

    try {
      const result = await executeStep(client, model, plan, step);
      step.status = "completed";
      step.result = result;
      console.log(`  ✓ 本步结果: ${result.slice(0, 160)}${result.length > 160 ? "…" : ""}`);
    } catch (e) {
      step.status = "failed";
      step.result = String(e);
      plan.status = "failed";
      savePlan(plan);
      console.error(`  ✗ 步骤失败: ${e}`);
      process.exit(1);
    }
    savePlan(plan);
  }
  plan.status = "completed";
  savePlan(plan);

  const finalAnswer = await synthesizeFinalAnswer(client, model, plan);
  console.log(`\nFinal Answer:\n${finalAnswer}`);
  printPlan(plan);
}

async function main() {
  if(!process.env.DEEPSEEK_API_KEY) {
    console.error('DEEPSEEK_API_KEY 未设置');
    process.exit(1);
  }
  let plan: Plan;
  const { resumeId, goal } = parseArgs(process.argv.slice(2));
  if (resumeId) {
    // 恢复任务
  } else {
    // 创建新任务
    plan = await createPlan(client, model, goal);
  }
  await runPlan(plan!);
}

main().catch(error => { 
  console.error(error);
  process.exit(1);
});