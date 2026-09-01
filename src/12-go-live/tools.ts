import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { Chunk } from "./kb.js";
import { searchPolicy } from "./kb.js";

/** 需要人工确认的工具名 */
export const CONFIRM_REQUIRED = new Set(["send_notice"]);

/** 允许暴露给模型的工具 allowlist */
export const ALLOWED_TOOLS = new Set(["search_policy", "send_notice"]);

export async function confirmDangerousAction(
  name: string,
  argsJson: string,
): Promise<boolean> {
  const rl = readline.createInterface({ input, output });
  console.log("\n⚠️  需要人工确认才会执行：");
  console.log(`工具: ${name}`);
  console.log(`参数: ${argsJson}`);
  const ans = (await rl.question("确认执行？(y/N) ")).trim().toLowerCase();
  rl.close();
  return ans === "y" || ans === "yes";
}

export async function runTool(
  name: string,
  argsJson: string,
  chunks: Chunk[],
): Promise<string> {
  // 第一道闸：不在 allowlist 直接拒绝（即便模型幻觉出工具名）
  if (!ALLOWED_TOOLS.has(name)) {
    return JSON.stringify({
      ok: false,
      error: "tool_not_allowed",
      tip: `工具 ${name} 未授权，请改用已提供的工具或向用户说明`,
    });
  }

  // 第二道闸：危险工具先确认
  if (CONFIRM_REQUIRED.has(name)) {
    const ok = await confirmDangerousAction(name, argsJson);
    if (!ok) {
      return JSON.stringify({
        ok: false,
        error: "user_denied",
        tip: "用户拒绝执行。不要再次调用同一危险操作；向用户说明未发送。",
      });
    }
  }

  try {
    const args = JSON.parse(argsJson || "{}") as Record<string, unknown>;

    if (name === "search_policy") {
      const query = String(args.query ?? "").trim();
      if (!query) {
        return JSON.stringify({
          ok: false,
          hits: [],
          tip: "query 不能为空",
        });
      }
      const hits = searchPolicy(chunks, query, 3);
      if (hits.length === 0) {
        return JSON.stringify({
          ok: false,
          hits: [],
          tip: "无匹配，告知资料不足，禁止编造",
        });
      }
      return JSON.stringify({
        ok: true,
        hits: hits.map((h) => ({
          source: h.source,
          heading: h.heading,
          text: h.text,
        })),
      });
    }

    if (name === "send_notice") {
      const to = String(args.to ?? "");
      const body = String(args.body ?? "");
      // 演示：假装发送成功（真实项目里这里才调邮件/IM API）
      console.log(`\n✅ 已模拟发送通知 → ${to}`);
      console.log(`正文摘要: ${body.slice(0, 80)}${body.length > 80 ? "…" : ""}`);
      return JSON.stringify({
        ok: true,
        to,
        // 日志友好：不回传全文，只回执
        receipt: `notice_sent:${Date.now()}`,
        tip: null,
      });
    }

    return JSON.stringify({ ok: false, error: `未知工具: ${name}` });
  } catch (e) {
    return JSON.stringify({ ok: false, error: String(e) });
  }
}
