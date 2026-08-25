import fs from "node:fs";
import path from "node:path";

export type Chunk = { source: string; heading: string; text: string };

export function loadChunks(): Chunk[] {
  const dir = path.join(process.cwd(), "src", "11-obs-eval", "knowledge");
  const chunks: Chunk[] = [];
  if (!fs.existsSync(dir)) return chunks;

  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".md"))) {
    const raw = fs.readFileSync(path.join(dir, file), "utf8").replace(/\r\n/g, "\n");
    const parts = raw.split(/\n(?=##\s+)/);
    for (const part of parts) {
      const lines = part.trim().split("\n");
      if (lines[0]?.startsWith("## ")) {
        const heading = lines[0].replace(/^##\s+/, "").trim();
        const text = lines.slice(1).join("\n").trim();
        if (text) chunks.push({ source: file, heading, text });
      }
    }
  }
  return chunks;
}

export function searchPolicy(chunks: Chunk[], query: string, topK = 3) {
  const q = query.toLowerCase().trim();
  const tokens = q.split(/[^a-z0-9\u4e00-\u9fff]+/i).filter(Boolean);
  return chunks
    .map((c) => {
      const hay = `${c.heading}\n${c.text}`.toLowerCase();
      let score = 0;
      for (const t of tokens) {
        if (c.heading.toLowerCase().includes(t)) score += 3;
        score += hay.split(t).length - 1;
      }
      return { ...c, score };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
