import "dotenv/config";
import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import { buildSystemPrompt } from "./prompt.js";
import { tools } from "./tools.js"; // 导入工具
import { createSessionSummary } from "./memory.js"; // 导入会话摘要
import process from "node:process";
import readline from "node:readline/promises";
import { loadProfile, Profile, generateProfileDescription, rememberPreference } from "./profile.js";

const SYSTEM_PROMPT = `
你是一个天气助手，负责查询天气和温度转换
`;
const MAX_STEPS = 10;
const MODEL_NAME = "deepseek-v4-flash";
const MAX_REST_BEFORE_COMPACT = 20;
const KEEP_RECENT = 8;

const openai = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: "https://api.deepseek.com",
});


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

function runTool(name: string, args: string, profile: { current: Profile }) {
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
        case "remember_preference":
            profile.current = rememberPreference(profile.current, {
                name: argsObj.name ? String(argsObj.name) : undefined,
                city: argsObj.city ? String(argsObj.city) : undefined,
                style: argsObj.style ? String(argsObj.style) : undefined,
                fact: argsObj.fact ? String(argsObj.fact) : undefined,
            });
            return JSON.stringify({
                success: true,
                profile: profile.current,
            });
        case "get_profile":
            return JSON.stringify({
                success: true,
                profile: profile.current,
            });
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

async function runToolLoop(messages: ChatCompletionMessageParam[], profile: { current: Profile }) {
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
            const result = runTool(name, args, profile);
            logObservation(result);

            // 偏好变更后，重新构建系统提示
            if (name === 'remember_preference') {
                const rest = messages.filter(m => m.role !== 'system');
                messages.length = 0;
                messages.push(...rebuildSystemPrompt(profile.current));
                messages.push(...rest);
            }

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

function rebuildSystemPrompt(profile: Profile): ChatCompletionMessageParam[] {
    return [
        {
            role: 'system',
            content: `
                    # 角色
                    你是带记忆的个人助理 Agent。你会使用工具查询天气、读写用户长期偏好。

                    # 目标与完成标准
                    - 完成用户当前问题；涉及「我是谁/我家在哪/我的偏好」时以长期偏好为准。
                    - 信息不足时先查 get_profile 或向用户澄清。

                    # 工具使用策略
                    - 用户明确说出姓名、城市、风格、稳定事实时，调用 remember_preference 写入。
                    - 需要确认已存偏好时调用 get_profile。
                    - 问天气时调用 get_weather；若用户说「我家/我们这边」且已知 homeCity，用该城市。
                    - 禁止编造偏好与天气。

                    # 思考与行动（ReAct）
                    - 调工具前用 1～2 句中文说明理由。
                    - 行动必须通过 tool_calls。

                    # 输出契约
                    - 简洁中文；若用户 style 有要求则遵守。
                    - 结构：结论 → 简短依据。
                    `.trim(),
        },
        {
            role: 'system',
            content: generateProfileDescription(profile)
        }
    ]
}

async function main() {
    if (!process.env.DEEPSEEK_API_KEY) {
        console.error('DEEPSEEK_API_KEY 未设置');
        process.exit(1);
    }

    const profile = { current: loadProfile() };

    let message: ChatCompletionMessageParam[] = rebuildSystemPrompt(profile.current)

    console.log('记忆Agent已启动。输入exit / quit退出。');

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    while (true) {
        const goal = await rl.question('\n你：');
        if (goal.toLowerCase() === 'exit' || goal.toLowerCase() === 'quit') {
            break;
        }
        message.push({
            role: 'user',
            content: goal,
        });
        const result = await runToolLoop(message, profile);

        message = await createSessionSummary(openai, MODEL_NAME, message, { maxRest: MAX_REST_BEFORE_COMPACT, keepRecent: KEEP_RECENT });
    }
    rl.close();
}

main().catch(err => {
    console.error('程序错误:', err);
    process.exit(1);
});
