import path from "node:path";
import process from "node:process";
import fs from "node:fs";
import { chunkText, type chunk } from "./chunk";

const DIRECTORY = path.join(process.cwd(), "src", "07-agents", "knowledge");

export const loadKnowledgeBase = () => {
  if (!fs.existsSync(DIRECTORY)) {
    console.warn(`[rag] 知识库目录不存在: ${DIRECTORY}`);
    return [];
  }
  const files = fs.readdirSync(DIRECTORY).filter((file: string) => file.endsWith(".md"));

  const chunks: chunk[] = [];
  for (const file of files) {
    const content = fs.readFileSync(path.join(DIRECTORY, file), "utf-8");
    const _chunks = chunkText(file, content);
    chunks.push(..._chunks);
  }

  console.log(
    `[rag] 已索引 ${files.length} 个文件，共 ${chunks.length} 个块`,
  );
  return chunks;
}