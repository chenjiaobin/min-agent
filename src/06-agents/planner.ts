import { type Plan } from "./plan-store";
import OpenAI from "openai";
import { savePlan } from "./plan-store";

// JSON 模式，用于解析规划器输出
const PLAN_SCHEMA = `{
  "steps": [
    { "id": 1, "title": "步骤标题，动词开头，可判定是否完成" }
  ]
}`;

export async function createPlan(client: OpenAI, model: string, goal: string): Promise<Plan> {
  const response = await client.chat.completions.create({
    model: model,
    messages: [
      {
        role: 'system', content: `
        你是任务规划器。把用户目标拆成 2～5 个有先后顺序的步骤。
        可用工具（供规划参考，此阶段不要假装调用）：
        - search_notes：在本地笔记中按关键词搜索
        - sum_numbers：对数字数组求和
        - save_draft：把 Markdown 草稿写入 output/draft.md

        输出 JSON，格式：${PLAN_SCHEMA}
        要求：
        - 每步具体、可执行、动词开头
        - 前几步负责收集与计算，最后一步负责生成周报大纲并保存草稿
      ` },
      { role: 'user', content: goal },
    ],
  });
  const content = response.choices[0].message.content || "{}";
  let parsed: { steps: { id: number, title: string }[] }
  try {
    parsed = JSON.parse(content) as { steps: { id: number, title: string }[] };
  } catch (error) {
    throw new Error('Invalid plan created');
  }
  if (!parsed.steps || parsed.steps.length === 0) {
    throw new Error('Invalid plan created: no steps');
  }
  const plan: Plan = {
    id: 'plan_' + Date.now(),
    goal: goal,
    status: 'running',
    steps: parsed.steps.map((step, i) => ({
      id: step.id ?? i + 1,
      title: step.title,
      status: 'pending',
      result: '',
    })),
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  savePlan(plan);
  return Promise.resolve(plan);
}

export async function synthesizeFinalAnswer(
  client: OpenAI,
  model: string,
  plan: Plan,
): Promise<string> {
  const summary = plan.steps
    .map((s) => `步骤${s.id}「${s.title}」\n结果：${s.result ?? "（无）"}`)
    .join("\n\n");

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content:
          "你是总结助手。根据各步骤结果，用简洁中文给出最终答复，并说明草稿是否已保存。",
      },
      {
        role: "user",
        content: `总目标：${plan.goal}\n\n各步结果：\n${summary}`,
      },
    ],
  });

  return response.choices[0]?.message?.content?.trim() || "（汇总失败）";
}