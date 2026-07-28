import "dotenv/config";
import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";

const SYSTEM_PROMPT = `
你是一个天气助手，负责查询天气和温度转换
`;
const MAX_STEPS = 10;
const MODEL_NAME = "deepseek-v4-flash";

const openai = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: "https://api.deepseek.com",
});

// ---------- 定义工具 ----------
const tools: ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "search_notes",
            description: "在本地笔记里按关键词搜索，返回匹配片段",
            parameters: {
            type: "object",
            properties: {
                query: { type: "string", description: "搜索关键词" },
            },
            required: ["query"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_weather",
            description: "查询某城市当前天气",
            parameters: {
                type: "object",
                properties: {
                    city: {
                        type: "string",
                        description: "城市名称，例如：北京、上海、广州、深圳",
                    },
                },
                required: ["city"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "celsius_to_fahrenheit",
            description: "把摄氏度转换成华氏度",
            parameters: {
                type: "object",
                properties: {
                    celsius: {
                        type: "number",
                        description: "摄氏温度",
                    },
                },
                required: ["celsius"],
            },
        },
    },
    {
    type: "function",
        function: {
            name: "add",
            description: "计算两个数的和",
            parameters: {
            type: "object",
            properties: {
                a: { type: "number" },
                b: { type: "number" },
            },
            required: ["a", "b"],
            },
        },
    },
];

// ---------- 真正执行工具（你的代码） ----------

/** 假装本地笔记库 */
const NOTES: { title: string; body: string }[] = [
    { title: "出差清单", body: "下周去杭州，记得带伞和充电宝。" },
    { title: "预算", body: "差旅餐饮预算合计 800 元，交通另计 450 元。" },
    { title: "会议", body: "周五下午和客户评审 Agent 方案。" },
  ];
  
function searchNotes(query: string): string {
    const q = query.toLowerCase();
    const hits = NOTES.filter(
        (n) =>
        n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q),
    );
    if (hits.length === 0) {
        return JSON.stringify({ hits: [], tip: "无匹配，可换关键词" });
    }
    return JSON.stringify({ hits });
}

function getWeather(city: string) {
    // 调用天气API，这里暂时写假数据
    const weather: Record<string, { temp_c: string; condition: string }> = {
        "深圳": { temp_c: "27", condition: "高温" },
        "广州": { temp_c: "28", condition: "多云" },
        "北京": { temp_c: "26", condition: "晴天" },
        "上海": { temp_c: "25", condition: "小雨" },
    };
    const hit = weather[city];
    if (!hit) {
        return JSON.stringify({ error: `暂无${city}的天气信息` });
    }
    return JSON.stringify({ city, ...hit });
}

function celsiusToFahrenheit(celsius: number) {
    return JSON.stringify({ celsius, fahrenheit: (celsius * 9) / 5 + 32 });
}

function add(a: number, b: number): string {
    return JSON.stringify({ a, b, sum: a + b });
}

function runTool(name: string, args: string) {
    const argsObj = JSON.parse(args);
    switch (name) {
        case "search_notes":
            return searchNotes(argsObj.query);
        case "get_weather":
            return getWeather(argsObj.city);
        case "celsius_to_fahrenheit":
            return celsiusToFahrenheit(argsObj.celsius);
        case "add":
            return add(argsObj.a, argsObj.b);
        default:
            return JSON.stringify({ error: `不支持的工具: ${name}` });
    }
}


/** 侦探日志：把 ReAct 三件套打成人话 */
function logThought(step: number, text: string | null | undefined) {
    const t = text?.trim();
    console.log(`\n—— Step ${step} ——`);
    console.log(`Thought: ${t && t.length > 0 ? t : "(模型未输出文字，直接行动)"}`);
}

function logAction(name: string, argsJson: string) {
    console.log(`Action:  ${name}`);
    console.log(`Action Input: ${argsJson}`);
}

function logObservation(result: string) {
    console.log(`Observation: ${result}`);
}

// ---------- 执行主逻辑 ----------

async function main(prompt: string) {
    const messages: ChatCompletionMessageParam[] = [
        {
            role: "system",
            content: [
                "你是 ReAct 风格助手：边想边调用工具，禁止编造笔记内容和天气数字。",
                "每次准备调用工具时，先在 content 里用 1～2 句中文写清：当前已知什么、为什么要调这个工具。",
                "工具结果会以 Observation 形式返回；信息足够后给出最终中文答复，不再调用工具。",
            ].join("\n"),
        },
        { role: "user", content: prompt },
    ];
    for (let i = 0; i < MAX_STEPS; i++) {
        const response = await openai.chat.completions.create({
            model: MODEL_NAME,
            messages,
            tools,
            tool_choice: "auto",
        });
        const msg = response.choices[0]?.message;
        if (!msg) throw new Error("No content");
        logThought(i, msg.content);
        messages.push(msg);
        const toolCalls = msg.tool_calls;
        if (!toolCalls || toolCalls.length === 0) {
            console.log('最终回复:', msg.content ?? "(空回复)");
            return msg.content ?? "(空回复)";
        }
        for (const tool of toolCalls) {
            if (tool.type !== "function") continue;
            const { name, arguments: args } = tool.function;
            logAction(name, args);
            const result = runTool(name, args);
            logObservation(result);
            messages.push({
                role: "tool",
                content: result,
                tool_call_id: tool.id,
            });
        }
    }
    console.log('最终回复:', "(超出最大步数)");
    return "(超出最大步数)";
}

main("根据我的笔记，下周去杭州要不要带伞？差旅餐饮加交通预算一共多少？");
