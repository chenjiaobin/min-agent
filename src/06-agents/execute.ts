import OpenAI from "openai";
import { type Plan, type Step } from "./plan-store";
import { buildExecutorMessages, executorTools, runTool } from "./tools";

const CONTEXT_MAX_ROUNDS = 8;

export async function executeStep(client: OpenAI, model: string, plan: Plan, step: Step): Promise<string> {
  const stepDone = plan.steps.filter(s => s.status === "completed" && s.result).map(s => `步骤${s.id}「${s.title}」：${s.result}`).join('\n');
  const messages = buildExecutorMessages(
    plan.goal,
    step.title,
    step.id,
    stepDone,
  );
  for (let round = 0; round < CONTEXT_MAX_ROUNDS; round++) {
    let response = await client.chat.completions.create({
      model,
      messages,
      tools: executorTools,
      tool_choice: "auto",
    });
    const content = response.choices[0].message;
    if (!content) {
      throw new Error("Executor: No content in response");
    }
    messages.push(content);

    let tools = content.tool_calls;
    if (!tools || tools.length === 0) {
      return content.content ?? "（本步未产出文字结果）";
    }
    for (const call of tools) {
      if (call.type !== "function") continue;
      const { name, arguments: argsJson } = call.function;
      console.log(`  Action: ${name}(${argsJson})`);
      const observation = runTool(name, argsJson);
      console.log(`  Observation: ${observation.slice(0, 200)}`);
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: observation,
      });
    }
  }
  return "（本步超出子轮次上限，请缩小步骤或提高 MAX_STEPS_PER_STEP）";
}