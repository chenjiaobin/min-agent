export type chunk = {
  id: string;
  source: string;
  heading: string;
  text: string;
}

export const chunkText = (source: string, text: string) => {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const parts = normalized.split(/\n(?=##\s+)/);
  const chunks: chunk[] = [];

  for (let [index, part] of parts.entries()) {
    part = part.trim();
    if (!part) continue;
    const lines = part.split(/\n/);
    const first = lines[0];
    if (!first) continue;

    let heading = "（全文）";
    let body = part;

    if (first.startsWith("##")) {
      heading = first.replace(/^##\s+/, "").trim();
      body = lines.slice(1).join("\n").trim();
    } else if (first.startsWith("#")) {
      heading = first.replace(/^#\s+/, "").trim();
      body = lines.slice(1).join("\n").trim();
    }

    // 只有标题没有内容，则跳过
    if (!body) continue;

    chunks.push({ id: `${source}_${index}`, source, heading, text: body });
  }

  return chunks;
};

// 给文本打分
function calcuteScore(chunk: chunk, query: string) {
  let qToken = query.toLowerCase().split(/[^a-z0-9\u4e00-\u9fff]+/i).filter(item => item.length > 0);
  if (qToken.length === 0) return 0;
  const heading = chunk.heading.toLowerCase();
  const text = chunk.text.toLowerCase();

  let score = 0;
  for (let q of qToken) {
    if (heading.includes(q)) score += 3;
    // 计算文本中匹配的次数
    const matches = text.split(q).length - 1;
    if (matches > 0) score += matches;
  }

  const q = query.toLowerCase().trim();
  if (q.length > 2 && (heading.includes(q) || text.includes(q))) {
    score += 2;
  } 

  return score;
}

export const searchChunks = (chunk: chunk[], query: string, topK: number) => {
  const rank = chunk
    .map(item => ({ ...item, score: calcuteScore(item, query) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);
  return rank.slice(0, Math.max(1, topK));
}