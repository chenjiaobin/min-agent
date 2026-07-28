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
];

// ---------- 真正执行工具（你的代码） ----------

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

function runTool(name: string, args: string) {
    const argsObj = JSON.parse(args);
    switch (name) {
        case "get_weather":
            return getWeather(argsObj.city);
        case "celsius_to_fahrenheit":
            return celsiusToFahrenheit(argsObj.celsius);
        default:
            return JSON.stringify({ error: `不支持的工具: ${name}` });
    }
}

// ---------- 执行主逻辑 ----------

async function main(prompt: string) {
    const messages: ChatCompletionMessageParam[] = [
        { role: "system", content: SYSTEM_PROMPT },
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
        console.log('大模型单次回复内容：', msg);
        if (!msg) throw new Error("No content");
        messages.push(msg);
        const toolCalls = msg.tool_calls;
        if (!toolCalls || toolCalls.length === 0) {
            console.log('最终回复:', msg.content ?? "(空回复)");
            return msg.content ?? "(空回复)";
        }
        for (const tool of toolCalls) {
            if (tool.type !== "function") continue;
            const { name, arguments: args } = tool.function;
            console.log(`调用工具: ${name}(${args})`);
            const result = runTool(name, args);
            console.log('工具调用结果：', result);
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

main("今天湖南的天气怎么样？并把温度转换成华氏度");
