import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
// 会话摘要

export const createSessionSummary = async (
  client: OpenAI,
  model: string,
  messages: ChatCompletionMessageParam[],
  opts: { maxRest: number, keepRecent: number }
): Promise<ChatCompletionMessageParam[]> => {
  if (opts.maxRest <= 0) return messages;
  const systemPrompt = messages.filter(item => item.role === 'system');
  const otherPrompts = messages.filter(item => item.role !== 'system');
  if (otherPrompts.length <= opts.maxRest) return messages;

  const recentPrompts = otherPrompts.slice(-opts.keepRecent);
  const oldPrompts = otherPrompts.slice(0, -opts.keepRecent);

  const transcript = oldPrompts.map(item => {
    if (item.role === 'tool') return `Observation: ${item.content}`;
    if (typeof item.content === 'string' && item.content.trim()) return `${item.role}: ${item.content}`;
    if (item.role === 'assistant' && item.tool_calls) {
      let t = item.tool_calls.map(tool => tool.type === 'function' ? tool.function.name : '?').join(', ');
      return `Assistant used tools: ${t}`;
    }
  }).filter(Boolean).join('\n');

  const summary = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: '你是会话摘要生成器，请根据会话内容生成会话摘要。将对话总结为简洁中文要点：用户目标、已确认事实、不要发明新事实。' },
      { role: 'user', content: transcript || '(无)' }
    ]
  });

  const summaryContent = summary.choices[0].message.content || '（无摘要）';

  return [
    ...systemPrompt,
    { role: 'system', content: `【会话摘要】${summaryContent}` },
    ...recentPrompts,
  ]
};