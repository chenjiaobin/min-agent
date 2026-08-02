import path from "node:path";
import fs from "node:fs";
import process from "node:process";
export type PlanStatus = 'running' | 'completed' | 'failed';
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed';

export type Step = {
  id: number;
  title: string;
  status: StepStatus;
  result: string;
}
export type Plan = { 
  id: string;
  goal: string;
  status: PlanStatus;
  steps: Step[];
  createdAt: Date;
  updatedAt: Date;
}

const PLAN_DIR = path.join(process.cwd(), "plans");

export function savePlan(plan: Plan) {
  if (!fs.existsSync(PLAN_DIR)) {
    fs.mkdirSync(PLAN_DIR, { recursive: true });
  }
  plan.updatedAt = new Date();
  const planFile = path.join(PLAN_DIR, `${plan.id}.json`);
  fs.writeFileSync(planFile, JSON.stringify(plan, null, 2), 'utf-8');
}

export function loadPlan(id: string): Plan | null {
  const planFile = path.join(PLAN_DIR, `${id}.json`);
  if (!fs.existsSync(planFile)) {
    return null;
  }
  const plan = JSON.parse(fs.readFileSync(planFile, 'utf-8')) as Plan;
  return plan;
}

export function listPlans(): string[] {
  if (!fs.existsSync(PLAN_DIR)) return [];
  return fs
    .readdirSync(PLAN_DIR)
    .filter((f: string) => f.endsWith(".json"))
    .map((f: string) => f.replace(/\.json$/, ""));
}

export function getNextPendingStep(plan: Plan): Step | null {
  return plan.steps.find((s) => s.status === "pending") ?? null;
}

export function printPlan(plan: Plan) {
  console.log(`\n计划 ${plan.id} | ${plan.status}`);
  console.log(`目标: ${plan.goal}\n`);
  for (const step of plan.steps) {
    const mark =
      step.status === "completed"
        ? "✓"
        : step.status === "running"
          ? "→"
          : step.status === "failed"
            ? "✗"
            : step.status === "pending"
              ? "⏳"
              : " ";
    console.log(`  ${mark} ${step.id}. [${step.status}] ${step.title}`);
    if (step.result) {
      console.log(`      → ${step.result.slice(0, 120)}${step.result.length > 120 ? "…" : ""}`);
    }
  }
}