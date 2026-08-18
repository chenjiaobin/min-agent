/**
 * 共享黑板：多 Agent 之间传递「可验收事实」，而不是整段私聊历史。
 */
export type NoteItem = {
  source: string;
  point: string;
};

export type Blackboard = {
  goal: string;
  notes: NoteItem[];
  draft: string | null;
  log: string[];
};

export function createBoard(goal: string): Blackboard {
  return { goal, notes: [], draft: null, log: [] };
}

export function log(board: Blackboard, message: string): void {
  board.log.push(message);
  console.log(`[board] ${message}`);
}
