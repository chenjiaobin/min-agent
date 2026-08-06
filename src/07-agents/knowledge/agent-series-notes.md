# Agent 系列写作备忘

## 更新节奏

《AI Agent 开发：从 0 到 1》计划共 12 篇，目标节奏为 **每周 1～2 篇**。前四篇偏基础循环与 Prompt，第五篇起进入记忆、规划、检索等工程能力。

配套代码仓库：https://github.com/chenjiaobin/min-agent

## 技术栈约定

- 语言：TypeScript（Node.js）
- 模型：DeepSeek（OpenAI 兼容 API）
- 原则：先手搓 Tool Loop，再引入框架

## 第 07 篇焦点

本篇示例知识库用于演示 RAG：分块、关键词召回、强制引用出处。不在本阶段引入向量数据库。
