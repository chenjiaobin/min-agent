import fs from "node:fs";
import path from "node:path";

export type TraceEvent = {
  ts: string;
  runId: string;
  kind: "llm" | "tool" | "final";
  name: string;
  input?: unknown;
  output?: unknown;
  extra?: Record<string, unknown>;
};

export type RunTrace = {
  runId: string;
  goal: string;
  events: TraceEvent[];
  toolNames: string[];
  finalAnswer: string;
  steps: number;
  hitMaxSteps: boolean;
};

export function newRunId(): string {
  return `run-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export class Tracer {
  readonly runId: string;
  readonly goal: string;
  readonly events: TraceEvent[] = [];
  readonly toolNames: string[] = [];
  steps = 0;
  hitMaxSteps = false;
  finalAnswer = "";

  constructor(goal: string, runId = newRunId()) {
    this.goal = goal;
    this.runId = runId;
  }

  record(
    kind: TraceEvent["kind"],
    name: string,
    input?: unknown,
    output?: unknown,
    extra?: Record<string, unknown>,
  ): void {
    this.events.push({
      ts: new Date().toISOString(),
      runId: this.runId,
      kind,
      name,
      input,
      output,
      extra,
    });
    if (kind === "tool") this.toolNames.push(name);
    if (kind === "llm") this.steps += 1;
    if (kind === "final") this.finalAnswer = String(output ?? "");
  }

  toJSON(): RunTrace {
    return {
      runId: this.runId,
      goal: this.goal,
      events: this.events,
      toolNames: this.toolNames,
      finalAnswer: this.finalAnswer,
      steps: this.steps,
      hitMaxSteps: this.hitMaxSteps,
    };
  }

  save(dir = path.join(process.cwd(), "traces")): string {
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${this.runId}.json`);
    fs.writeFileSync(file, JSON.stringify(this.toJSON(), null, 2), "utf8");
    return file;
  }
}
