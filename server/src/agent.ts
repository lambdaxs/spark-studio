import { Agent, CursorAgentError } from "@cursor/sdk";
import { workspaceRoot } from "./db.js";
import {
  applyChatArtifacts,
  boundMaterialText,
  coursePromptContext,
  defaultCanvasFor,
  getCourse,
  getLesson,
  heuristicLessonBody,
  parseAgentArtifacts,
  saveCanvas,
  saveLessonBody,
} from "./courses.js";
import {
  addMessage,
  getItem,
  getOrCreateConversation,
  setConversationAgent,
  type ItemDetail,
} from "./store.js";

type LiveAgent = Awaited<ReturnType<typeof Agent.create>>;

const live = new Map<string, LiveAgent>();

function apiKey() {
  return process.env.CURSOR_API_KEY?.trim() || "";
}

function contextPrompt(
  item: ItemDetail,
  userText: string,
  extra?: { surface?: string },
) {
  const groups = item.groups.map((g) => g.name).join("、") || "无";
  let header: string;
  if (item.type === "wiki") {
    const path = [...item.ancestors.map((a) => a.title), item.title].join(" / ");
    header = `你在「个人知识工作台」里，用户正在看 Wiki 页「${path}」。基于这一页讨论、补全或改写。不要去改工作区里的代码，除非用户明确要求动代码。

分组：${groups}

正文：
${item.body}`;
  } else if (item.type === "todo") {
    const links = item.links.map((l) => `${l.title}（${l.type}）`).join("、") || "无";
    const due = item.dueAt ? new Date(item.dueAt).toISOString().slice(0, 10) : "无";
    header = `你在「个人知识工作台」里，用户正在看一条待办。帮助拆解、改写备注或建议下一步。不要去改工作区里的代码，除非用户明确要求动代码。

标题：${item.title}
状态：${item.status === "done" ? "已完成" : "未完成"}
截止日期：${due}
分组：${groups}
链接：${links}

备注：
${item.body}`;
  } else if (item.type === "draft") {
    const tab =
      extra?.surface === "wechat"
        ? "公众号变体"
        : extra?.surface === "xiaohongshu"
          ? "小红书变体"
          : extra?.surface === "zhihu"
            ? "知乎专栏变体"
            : "底稿";
    header = `你在「个人知识工作台」的出稿模块。用户正在看这篇稿的「${tab}」。帮助改写、压缩或按平台调整语气。不要登录任何平台，不要去改工作区代码，除非用户明确要求。

底稿标题：${item.title}
分组：${groups}
链接：${item.links.map((l) => l.title).join("、") || "无"}

底稿正文：
${item.body}`;
  } else if (item.type === "course") {
    header = `你在「个人知识工作台」里，正在设计一门课。这是一次独立的课程设计对话，不是某一课时的学习聊天。

先拷问用户：要学什么、已有什么基础、深度和范围、想用在哪。不要一上来就出完整大纲。材料足够之后，给出可嵌套大纲。大纲、思维导图、确认后的目录是同一棵树。

当你给出或修改大纲时，在回复末尾附上 fenced block：
\`\`\`outline
[{"title":"章或课时标题","children":[{"title":"子课时"}]}]
\`\`\`
只有叶子会在学习时生成正文。章只负责结构。
若要写下设计备忘，另附：
\`\`\`brief
……
\`\`\`
不要去改工作区代码，除非用户明确要求。

${coursePromptContext(item)}`;
  } else if (item.type === "course_node") {
    const canvasHint =
      extra?.surface === "canvas"
        ? "用户正在看 Canvas 视图。优先补或改逐步演示。"
        : "用户正在看文档视图。解释这一课；若适合用分步动画，再给 canvas。";
    header = `你在「个人知识工作台」里，用户正在学一课时。上下文是这门课的背景 + 当前课时。正文已经固化的不要擅自整篇重写；用户明确要求重写时，用 \`\`\`lesson 包住新正文。补 canvas 时用：
\`\`\`canvas
{"kind":"steps","title":"演示标题","steps":[{"title":"第一步","body":"说明","figure":"wave"}]}
\`\`\`
figure 只能是 wave / spectrum / transform / tree / none。不要跑任意 HTML/JS。不要去改工作区代码。

${canvasHint}

${coursePromptContext(item)}

当前课时：${item.title}
学习状态：${item.status ?? "not_started"}
已有正文：
${item.body || "（尚未生成）"}`;
  } else {
    header = `你在「个人知识工作台」里，用户正在阅读一篇收藏。请基于这篇讨论、提炼、拆大纲或改写。不要去改工作区里的代码，除非用户明确要求动代码。

收藏夹：${item.collectionName ?? "无"}
标题：${item.title}
作者：${item.author ?? "未知"}
分组：${groups}
原文：${item.sourceUrl ?? "无"}

正文：
${item.body}`;
  }
  return `${header}

用户：
${userText}`;
}

async function acquire(itemId: string, storedId: string | null): Promise<LiveAgent> {
  const cached = live.get(itemId);
  if (cached) return cached;

  const key = apiKey();
  const opts = {
    apiKey: key,
    model: { id: "composer-2.5" as const },
    local: { cwd: workspaceRoot },
  };

  const agent =
    storedId != null && storedId.length > 0
      ? await Agent.resume(storedId, opts)
      : await Agent.create(opts);

  live.set(itemId, agent);
  return agent;
}

export async function streamItemChat(
  itemId: string,
  userText: string,
  onDelta: (text: string) => Promise<void> | void,
  extra?: { surface?: string },
) {
  if (!apiKey()) {
    throw new Error("UNCONFIGURED_API_KEY");
  }

  const item = getItem(itemId);
  if (!item) throw new Error("NOT_FOUND");
  if (item.type === "course" && item.status === "ready") {
    throw new Error("COURSE_LOCKED");
  }

  const conv = getOrCreateConversation(itemId);
  addMessage(conv.id, "user", userText);

  let agent: LiveAgent;
  try {
    agent = await acquire(itemId, conv.cursorAgentId);
  } catch (err) {
    if (err instanceof CursorAgentError) {
      throw new Error(`AGENT_START:${err.message}`);
    }
    throw err;
  }

  if (!conv.cursorAgentId) {
    setConversationAgent(conv.id, agent.agentId);
  }

  let assembled = "";
  try {
    const run = await agent.send(contextPrompt(item, userText, extra));
    for await (const event of run.stream()) {
      if (event.type === "assistant") {
        for (const block of event.message.content) {
          if (block.type === "text" && block.text) {
            assembled += block.text;
            await onDelta(block.text);
          }
        }
      }
    }
    const result = await run.wait();
    if (result.status === "error" && !assembled) {
      throw new Error("AGENT_RUN_FAILED");
    }
    if (result.result && !assembled) {
      assembled = result.result;
      await onDelta(result.result);
    }
  } catch (err) {
    live.delete(itemId);
    if (err instanceof CursorAgentError) {
      throw new Error(`AGENT_START:${err.message}`);
    }
    throw err;
  }

  const text = assembled.trim();
  if (text) {
    addMessage(conv.id, "assistant", text);
    applyChatArtifacts(itemId, text);
  }
  return text;
}

function stripLessonFences(text: string) {
  return text
    .replace(/```canvas[\s\S]*?```/gi, "")
    .replace(/```outline[\s\S]*?```/gi, "")
    .replace(/```brief[\s\S]*?```/gi, "")
    .replace(/```lesson\s*([\s\S]*?)```/gi, "$1")
    .trim();
}

export async function streamLessonBody(
  lessonId: string,
  onDelta: (text: string) => Promise<void> | void,
) {
  const lesson = getLesson(lessonId);
  if (!lesson) throw new Error("NOT_FOUND");
  if (lesson.item.contentKind === "chapter" || lesson.item.body.trim()) {
    return lesson;
  }
  const course = getCourse(lesson.courseId);
  if (!course) throw new Error("NOT_FOUND");

  const finishHeuristic = async () => {
    const body = heuristicLessonBody(lesson.item, course);
    const canvas = defaultCanvasFor(lesson.item.title);
    await onDelta(body);
    saveLessonBody(lessonId, body);
    if (canvas) saveCanvas(lessonId, canvas);
    return getLesson(lessonId);
  };

  if (!apiKey()) {
    return finishHeuristic();
  }

  const prompt = `请为下面这一课时写一篇中文讲义（Markdown），一次性写完，之后会固化存储。不要重写整门课。适合动画的课可在文末附 canvas JSON。

${coursePromptContext(lesson.item)}

当前课时：${[...lesson.item.ancestors.map((a) => a.title), lesson.item.title].join(" / ")}

绑定材料：
${boundMaterialText(lesson.courseId, 3000)}

要求：先讲直觉，再给一个小例子，最后三句带走的话。不要发明登录或发布流程。`;

  const opts = {
    apiKey: apiKey(),
    model: { id: "composer-2.5" as const },
    local: { cwd: workspaceRoot },
  };

  let assembled = "";
  let agent: LiveAgent | undefined;
  try {
    agent = await Agent.create(opts);
    const run = await agent.send(prompt);
    for await (const event of run.stream()) {
      if (event.type === "assistant") {
        for (const block of event.message.content) {
          if (block.type === "text" && block.text) {
            assembled += block.text;
            await onDelta(block.text);
          }
        }
      }
    }
    const result = await run.wait();
    if (result.result && !assembled) {
      assembled = result.result;
      await onDelta(result.result);
    }
  } catch {
    if (!assembled) return finishHeuristic();
  } finally {
    if (agent) await agent[Symbol.asyncDispose]();
  }

  const art = parseAgentArtifacts(assembled);
  const body = stripLessonFences(assembled) || art.lesson || "";
  const canvas = art.canvas ?? defaultCanvasFor(lesson.item.title);
  if (canvas) saveCanvas(lessonId, canvas);
  if (body.trim()) saveLessonBody(lessonId, body);
  else return finishHeuristic();
  return getLesson(lessonId);
}

export async function disposeAgents() {
  for (const agent of live.values()) {
    await agent[Symbol.asyncDispose]();
  }
  live.clear();
}
