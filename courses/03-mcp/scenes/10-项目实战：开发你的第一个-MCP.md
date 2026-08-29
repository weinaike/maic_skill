---
type: pbl
title: "项目实战：开发你的第一个 MCP"
---

## 讲稿

学完了，该交作业了。这个实战项目只有一个任务：把你科研流程里一个真实的函数，变成一个能用的 MCP。

怎么选题？三个方向任挑：文献批量处理，比如下载、去重、重命名；数据清洗，比如把某个仪器导出的乱格式整理成规整表格；或者绘图，把你反复在写的那段 matplotlib 封装成工具。原则就一条——选你真的会反复用的。

验收口径四条，都在项目页上：第一，跑得通，Server 能起、能接入；第二，被正确选用，Agent 在该用它的时候用它，而不是你求着它用——这一条考的就是描述写得行不行；第三，结果可用，返回的数据干净、够精简；第四，描述达标，接口三件套完整。

别贪大，一个函数就够。做完你会发现，从函数到工具，中间真的只隔一个装饰器加几个类型标注——但好工具和坏工具之间，隔的是这一整节课。下一讲，我们聊 Agent 的上下文管理——工具越接越多之后，怎么不让它"失忆"。

## 内容

```content
{
  "type": "pbl",
  "projectV2": {
    "uiPhase": "hero",
    "title": "开发你的第一个 MCP",
    "description": "从你的科研流程里挑一个真实函数（文献批量处理 / 数据清洗 / 绘图），用 fastmcp 封装成 MCP Server：强类型接口、清晰描述、精简返回，接入课程客户端，让 Agent 成功调用并返回可用结果。",
    "learningObjective": "1. 完成一个可复用的 MCP Server；2. 交付达标的工具描述",
    "gains": [
      "掌握 fastmcp 最小构建路径：装饰器把普通函数变成工具",
      "能设计强类型接口：类型即 schema，枚举约束取值",
      "会写让模型正确选用的工具描述，并保持返回精简",
      "会用 Client 做脚本化验收，问题按排查路径定位"
    ],
    "tags": [
      "MCP",
      "fastmcp",
      "工具开发"
    ],
    "language": "zh-CN",
    "languageDirective": "全程使用中文授课。技术术语如 Agent、MCP、fastmcp、Skill、SubAgent、Claude Code、WorkBuddy 等保留英文，不做翻译。",
    "proficiency": "intermediate",
    "status": "active",
    "createdAt": "2026-08-29T00:00:00.000Z",
    "updatedAt": "2026-08-29T00:00:00.000Z",
    "roles": [
      {
        "id": "role_learner",
        "type": "user",
        "name": "开发者",
        "description": "完成函数选型、封装与验收"
      },
      {
        "id": "role_mentor",
        "type": "mentor",
        "name": "课程导师",
        "description": "对接口设计与描述质量给反馈"
      }
    ],
    "milestones": [
      {
        "id": "ms_select",
        "title": "选定函数并定义接口",
        "description": "挑一个会反复使用的科研函数，写出工具名、参数（类型+必选/可选）、一句描述",
        "status": "active",
        "order": 1,
        "microtasks": [],
        "completionCriteria": "接口三件套（工具名/参数/描述）完成并通过自查"
      },
      {
        "id": "ms_build",
        "title": "实现并接入",
        "description": "用 fastmcp 实现 Server，stdio 启动，按三步接入课程客户端",
        "status": "locked",
        "order": 2,
        "microtasks": [],
        "completionCriteria": "工具列表出现且可试调用"
      },
      {
        "id": "ms_verify",
        "title": "验收与打磨",
        "description": "让 Agent 在真实任务中正确选用该工具；用 Client 写一条脚本化验收",
        "status": "locked",
        "order": 3,
        "microtasks": [],
        "completionCriteria": "四条验收口径全部达成：跑通/被正确选用/结果可用/描述达标"
      }
    ],
    "submissions": [],
    "evaluations": [],
    "threads": [
      {
        "agentId": "role_learner",
        "messages": []
      },
      {
        "agentId": "role_mentor",
        "messages": []
      }
    ],
    "engagementEvents": []
  }
}
```
