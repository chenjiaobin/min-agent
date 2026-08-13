import "dotenv/config";
import process from "node:process";
import { StateGraph, MessagesAnnotation, END, START } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, AIMessage, ToolMessage, HumanMessage } from "@langchain/core/messages";
import { z } from "zod"; // 运行时类型检查
import { tool } from "@langchain/core/tools";

const MAX_STEPS = 8;

// DeepSeek 走 OpenAI 兼容协议：换 baseURL + apiKey 即可
const model = new ChatOpenAI({
  model: "deepseek-v4-flash",
  apiKey: process.env.DEEPSEEK_API_KEY,
  configuration: {
    baseURL: "https://api.deepseek.com",
  },
  temperature: 0,
});

/**
 * 工具 = 实现函数 + 说明书（name / description / schema）
 * schema 用 Zod 描述参数，框架会转成模型能看懂的 JSON Schema
 */

const getWeather = tool(
  async ({ city }: { city: string }) => { 
    const list: Record<string, string> = {
      "北京": "晴天，27度",
      "上海": "多云，26度",
      "广州": "小雨，25度",
      "深圳": "晴天，28度",
      "成都": "多云，22度",
      "重庆": "小雨，20度",
      "西安": "晴天，25度",
      "武汉": "多云，23度",
      "南京": "小雨，21度",
    }
    const weather = list[city];
    return JSON.stringify({
      ok: Boolean(weather),
      weather: weather || '暂无该城市天气',
      city,
      tip: weather ? 'null' : '可换北京/上海/广州/深圳/成都/重庆/西安/武汉/南京试试，或告知用户资料不足，禁止编造',
    });
  },
  {
    name: 'get_weather',
    description: '查询城市当前天气（演示假数据）。回答天气前必须调用；以返回 JSON 为准，禁止编造。',
    schema: z.object({
      city: z.string().describe('城市名称，例如“北京”'),
    })
  }
)

const celsiusToFahrenheit = tool(
  async ({ celsius }: { celsius: number }) => {
    return JSON.stringify({
      ok: true,
      fahrenheit: (celsius * 9 / 5) + 32,
      celsius,
    });
  },
  {
    name: 'celsius_to_fahrenheit',
    description: '将摄氏度转换为华氏度。回答前必须调用；以返回 JSON 为准，禁止编造。',
    schema: z.object({
      celsius: z.number().describe('摄氏度，例如 20'),
    })
  }
)

const tools = [getWeather, celsiusToFahrenheit];
// 按名字查找工具，供 toolNode调度
const toolsByName: Record<string, typeof tools[number]> = {
  [getWeather.name]: getWeather,
  [celsiusToFahrenheit.name]: celsiusToFahrenheit,
};

// 绑定工具，LLM 就能直接调用
const modelWithTools = model.bindTools(tools);

/**
 * 节点 1：调用 LLM（对应手搓里的 chat.completions.create）
 * 返回值里的 messages 会被 MessagesAnnotation 追加进状态
 */
async function llmCall(state: typeof MessagesAnnotation.State) {
  const response = await modelWithTools.invoke([
    new SystemMessage(
      [
        "你是会使用工具的助手。",
        "查询天气必须调用 get_weather；换算华氏度必须调用 celsius_to_fahrenheit。",
        "禁止编造天气数字。完成后用简洁中文回答。",
      ].join(""),
    ),
    ...state.messages, // 带上完整对话历史（含之前的 ToolMessage）
  ]);

  // 打印 ReAct 风格日志，方便对照第 03 篇
  if (AIMessage.isInstance(response)) {
    const text = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    if (text?.trim()) console.log(`Thought: ${text.trim()}`);
    for (const call of response.tool_calls || []) {
      console.log(`Calling ${call.name} with args: ${JSON.stringify(call.args)}`);
    }
  }

  return { messages: [response] };
}

/**
 * 节点 2：执行工具（对应手搓里的 runTool + role:"tool"）
 * 必须用 tool_call_id 把结果关联回模型的那次调用
 */
async function toolNode(state: typeof MessagesAnnotation.State) {
  const last = state.messages.at(-1);
  if (!last || !AIMessage.isInstance(last) || !last.tool_calls?.length) return { messages: [] };

  const outs: ToolMessage[] = [];
  for (const call of last.tool_calls || []) {
    const tool = toolsByName[call.name];
    if (!tool) {
      outs.push(new ToolMessage({
        tool_call_id: call.id ?? call.name,
        content: `工具 ${call.name} 不存在`,
      }));
      continue;
    }

    const raw = await (tool as { invoke: (input: unknown) => Promise<string> }).invoke(call.args);
    const content = typeof raw === 'string' ? raw : JSON.stringify(raw);
    outs.push(new ToolMessage({
      tool_call_id: call.id ?? call.name,
      content,
    }));
  }
  
  return { messages: outs };
}

/** 统计已产生多少轮 AI 回复，用来近似步数上限 */
function llmRounds(state: typeof MessagesAnnotation.State): number {
  return state.messages.filter((m) => AIMessage.isInstance(m)).length;
}

/**
 * 条件边：决定 llmCall 之后去 toolNode 还是 END
 * 对应手搓：if (!tool_calls) break; else 继续循环
 */
function shouldContinue(
  state: typeof MessagesAnnotation.State,
): "toolNode" | typeof END {
  if (llmRounds(state) >= MAX_STEPS) {
    console.log(`达到 MAX_STEPS=${MAX_STEPS}，强制结束`);
    return END;
  }
  const last = state.messages.at(-1);
  if (last && AIMessage.isInstance(last) && last.tool_calls?.length) {
    return "toolNode";
  }
  return END;
}

/**
 * 组装状态图并编译成可 invoke 的 Agent
 *
 *   START → llmCall ─┬─(有工具)→ toolNode → llmCall → …
 *                    └─(无工具)→ END
 */
const agent = new StateGraph(MessagesAnnotation)
  .addNode("llmCall", llmCall) // 决策节点
  .addNode("toolNode", toolNode) // 执行节点
  .addEdge(START, "llmCall") // 入口：先问模型
  .addConditionalEdges("llmCall", shouldContinue, ["toolNode", END]) // 条件分支
  .addEdge("toolNode", "llmCall") // 工具结果回来后再问模型
  .compile();

async function main() {
  if (!process.env.DEEPSEEK_API_KEY) {
      console.error('DEEPSEEK_API_KEY 未设置');
      process.exit(1);
  }
  const goal = process.argv.slice(2).join(' ') || '深圳现在天气怎么样？顺便告诉我气温对应的华氏度';

  const result = await agent.invoke({ messages: [new HumanMessage(goal)] });
  
  // 取最后一条 AI 消息作为最终答复
  const last = result.messages.at(-1);
  const finalText =
    last && AIMessage.isInstance(last)
      ? typeof last.content === "string"
        ? last.content
        : JSON.stringify(last.content)
      : String(last?.content ?? "");

  console.log(`\nFinal Answer:\n${finalText}`);
}

main().catch(err => {
  console.log(err);
  process.exit(1);
});