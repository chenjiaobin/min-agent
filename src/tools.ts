import type { ChatCompletionTool } from "openai/resources/chat/completions";

// ---------- 定义工具 ----------
export const tools: ChatCompletionTool[] = [
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
    {
        type: "function",
        function: {
            name: "remember_preference",
            description: "将用户的长期偏好写入本地档案。用于姓名、常驻城市、回答风格、稳定事实。",
            parameters: {
                type: "object",
                properties: {
                    name: { type: "string", description: "用户姓名" },
                    city: { type: "string", description: "用户城市" },
                    style: { type: "string", description: "用户风格" },
                    fact: { type: "string", description: "用户事实" },
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_profile",
            description: "读取用户长期偏好档案",
            parameters: { type: "object", properties: {} },
        },
    },
];