---
type: pbl
title: "Project: Build Your First MCP"
---

## 讲稿

You've learned it — now it's time to hand in your homework. This project has exactly one task: take a real function from your research workflow and turn it into a working MCP.

How do you pick? Three directions, take your pick. Literature batch processing, like downloading, deduplication, renaming. Data cleaning, like turning an instrument's messy export into a tidy table. Or plotting: wrap that matplotlib snippet you keep rewriting into a tool. The rule is one line — choose something you will genuinely reuse.

There are four acceptance criteria, all on the project page. First, it runs: the Server starts and connects. Second, it gets chosen correctly — the Agent uses the tool when it should, not because you begged. That criterion is really testing your description.

Third, usable results: the returned data is clean and lean. Fourth, a description up to standard, with the full interface trio in place.

Don't overreach — one function is enough. When you finish, you'll see it: from function to tool, there's really just a decorator and a few type annotations in between. But between a good tool and a bad one lies this entire lecture. Next time, we talk context management — as the tools pile up, how do you keep the Agent from losing its memory?

## 内容

```content
{
  "type": "pbl",
  "projectV2": {
    "uiPhase": "hero",
    "title": "Build Your First MCP",
    "description": "Pick a real function from your research workflow (batch literature processing / data cleaning / plotting) and wrap it as an MCP Server with fastmcp: strongly typed interface, clear descriptions, lean returns. Plug it into the course client and have the Agent call it successfully with usable results.",
    "learningObjective": "1. Ship a reusable MCP Server; 2. Deliver tool descriptions that meet the bar",
    "gains": [
      "Master the minimal fastmcp build path: a decorator turns a plain function into a tool",
      "Design strongly typed interfaces: types are the schema, enums constrain the values",
      "Write tool descriptions the model picks correctly, and keep returns lean",
      "Run scripted acceptance checks with the Client, and locate problems along the debugging path"
    ],
    "tags": [
      "MCP",
      "fastmcp",
      "Tool Development"
    ],
    "language": "en",
    "languageDirective": "Teach in English throughout. Keep technical proper nouns such as Agent, MCP, fastmcp, Skill, SubAgent, Claude Code, and WorkBuddy in English, untranslated.",
    "proficiency": "intermediate",
    "status": "active",
    "createdAt": "2026-08-29T00:00:00.000Z",
    "updatedAt": "2026-08-29T00:00:00.000Z",
    "roles": [
      {
        "id": "role_learner",
        "type": "user",
        "name": "Developer",
        "description": "Pick the function, wrap it, and run acceptance"
      },
      {
        "id": "role_mentor",
        "type": "mentor",
        "name": "Course Mentor",
        "description": "Give feedback on interface design and description quality"
      }
    ],
    "milestones": [
      {
        "id": "ms_select",
        "title": "Pick the Function and Define the Interface",
        "description": "Choose a research function you will reuse; write the tool name, parameters (type + required/optional), and a one-line description",
        "status": "active",
        "order": 1,
        "microtasks": [],
        "completionCriteria": "The interface trio (tool name / parameters / description) is complete and self-checked"
      },
      {
        "id": "ms_build",
        "title": "Implement and Connect",
        "description": "Implement the Server with fastmcp, launch it over stdio, and plug it into the course client in three steps",
        "status": "locked",
        "order": 2,
        "microtasks": [],
        "completionCriteria": "The tool appears in the tool list and can be test-called"
      },
      {
        "id": "ms_verify",
        "title": "Acceptance and Polish",
        "description": "Have the Agent pick the tool correctly in a real task; write one scripted acceptance check with the Client",
        "status": "locked",
        "order": 3,
        "microtasks": [],
        "completionCriteria": "All four acceptance criteria met: runs end to end / chosen correctly / usable results / passing description"
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
