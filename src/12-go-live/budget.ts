export class BudgetError extends Error {
  constructor(public code: "max_steps" | "max_tool_calls") {
    super(code);
    this.name = "BudgetError";
  }
}

export type Budget = {
  maxSteps: number;
  maxToolCalls: number;
  usedSteps: number;
  usedToolCalls: number;
};

export function createBudget(
  maxSteps = 6,
  maxToolCalls = 4,
): Budget {
  return { maxSteps, maxToolCalls, usedSteps: 0, usedToolCalls: 0 };
}

export function assertCanLlm(b: Budget): void {
  if (b.usedSteps >= b.maxSteps) throw new BudgetError("max_steps");
}

export function assertCanTool(b: Budget): void {
  if (b.usedToolCalls >= b.maxToolCalls) {
    throw new BudgetError("max_tool_calls");
  }
}

export function markLlm(b: Budget): void {
  b.usedSteps += 1;
}

export function markTool(b: Budget): void {
  b.usedToolCalls += 1;
}
