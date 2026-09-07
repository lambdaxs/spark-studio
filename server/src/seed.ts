import { importItem, addLink, findItemByTitle, listCollections } from "./store.js";
import { createWikiPage, wikiCount } from "./wiki.js";
import { createTodo, todoCount, updateTodo } from "./todos.js";
import {
  createDraft,
  draftCount,
  generateVariantFromBase,
  saveVariant,
} from "./drafts.js";
import {
  addBinding,
  applyOutline,
  confirmCourse,
  courseCount,
  createCourse,
  defaultCanvasFor,
  FFT_OUTLINE,
  findCourseNode,
  saveCanvas,
  saveLessonBody,
  setLessonStatus,
} from "./courses.js";

function ts(iso: string) {
  return new Date(iso).getTime();
}

export function seedIfEmpty(isEmpty: boolean) {
  if (!isEmpty) return;

  importItem({
    collectionName: "算法与数学",
    title: "如何理解傅里叶变换",
    author: "张三",
    contentKind: "answer",
    sourceUrl: "https://example.com/fft-intuition",
    originalAt: ts("2024-11-02"),
    groups: ["数学"],
    body: `傅里叶变换不是「把信号变得更高级」，而是换一副眼镜：原来你沿着时间看起伏，现在改成沿着频率看它由哪些纯音叠出来。

周期信号可以拆成一组离散的正弦；非周期信号则变成连续的频谱。FFT 只是这个想法在计算机里的快速算法，不是另一套物理。

## 可操作的直觉

拿一段录音想「里面有没有 50Hz 的哼声」，不要在波形上数格子，去看频谱上那根线在不在。工程里排障、压缩、卷积，走的都是同一条路：时间里难做的，频率里往往是乘法。

这篇适合作为课程「从时间到频率」的入口，而不是公式汇编。`,
  });

  importItem({
    collectionName: "算法与数学",
    title: "证明助手与数学直觉",
    author: "赵六",
    contentKind: "article",
    sourceUrl: "https://example.com/proof-assistants",
    originalAt: ts("2025-01-12"),
    groups: ["数学", "计算机"],
    body: `Lean 或 Coq 不会替你产生洞察，它们只拒绝你含糊的一步。直觉仍然要在纸上或散步时长出来；助手负责把「我觉得显然」钉成可检查的结构。

对工作台来说，收藏这类文章是为了以后生成课程：先问学习者会不会写证明，再决定课时停在直觉还是停在形式化。`,
  });

  importItem({
    collectionName: "认知与哲学",
    title: "为什么物理学家需要哲学",
    author: "王五",
    contentKind: "article",
    sourceUrl: "https://example.com/physics-philosophy",
    originalAt: ts("2023-08-09"),
    groups: ["物理", "哲学"],
    body: `物理学家每天都在用「理论」「模型」「实在」这些词，但不自动等于已经想清楚它们。测量坍缩、多世界、有效场论的适用范围，争论的不是公式对不对，而是这句话到底在主张什么。

## 可证伪性

波普尔那套不能当实验室手册，却能当防呆：如果你的诠释无论看见什么都能自圆其说，它就不再约束下一张图。哲学在这里的用处很具体——逼你写出「什么结果会让我改口」。

把这篇留在收藏里，是因为后面写公众号或做课程时，需要一条「科学陈述如何失败」的底稿，而不是科普奇闻。`,
  });

  importItem({
    collectionName: "工程实践",
    title: "类型系统不是注释",
    author: "李四",
    contentKind: "answer",
    sourceUrl: "https://example.com/types-not-comments",
    originalAt: ts("2025-03-18"),
    groups: ["计算机"],
    body: `类型若只写在文档里，重构时第一件被扔掉的就是它。放进编译器，它变成同事不在时仍会喊停的那种约束。

工作台里的知识条目也一样：分组、收藏夹、课时树如果只是 UI 标签、不能被 Agent 引用，下一周就会漂。类型和知识模型做的是同一件事——让结构可执行。`,
  });

  importItem({
    collectionName: "工程实践",
    title: "本地优先的知识库为什么绑死 SQLite",
    author: "李四",
    contentKind: "article",
    sourceUrl: "https://example.com/local-sqlite",
    originalAt: ts("2025-06-01"),
    groups: ["计算机"],
    body: `单用户工具上 Postgres 是在给自己制造运维。一个文件能复制、能备份、能进 gitignore，已经够支撑收藏、Wiki 和对话记录。

等真的要全文检索再开 FTS；现在先保证导入接口和三栏阅读是同一套条目。`,
  });

  importItem({
    collectionName: "未分类",
    title: "周末读到一半的笔记",
    author: "佚名",
    contentKind: "answer",
    originalAt: ts("2026-02-20"),
    groups: [],
    body: `还没打分组。导入之后应该出现在「未分组」，免得新来的上百篇无处可放。`,
  });
}

export function seedWikiIfEmpty() {
  if (wikiCount() > 0) return;

  const cs = createWikiPage({ title: "计算机", groups: ["计算机"] });
  const algo = createWikiPage({
    title: "算法",
    parentId: cs.id,
    groups: ["计算机"],
  });
  createWikiPage({
    title: "动态规划",
    parentId: algo.id,
    groups: ["计算机"],
    body: `动态规划把大问题拆成互相重叠的子问题，记下答案以免重算。

## 状态转移

先问「这一步的答案由前面哪几步决定」。斐波那契是教科书例子；背包、最短路、编辑距离走的是同一套路：定义状态、写出转移、定边界。

\`\`\`
dp[i] = min(dp[i-1] + cost1, dp[i-2] + cost2)
\`\`\`

从收藏里的算法文章升上来时，保留这一页当课程入口，而不是一上来堆公式。`,
  });
  createWikiPage({
    title: "图论",
    parentId: algo.id,
    groups: ["计算机"],
    body: `图是点和边。遍历用 BFS/DFS，加权最短路再换成 Dijkstra 或更专门的算法。`,
  });
  createWikiPage({
    title: "类型系统",
    parentId: cs.id,
    groups: ["计算机"],
    body: `类型是可执行的注释。和收藏「类型系统不是注释」是同一条线，这里写成可演进的笔记。`,
  });

  const philo = createWikiPage({ title: "哲学", groups: ["哲学"] });
  createWikiPage({
    title: "科学哲学",
    parentId: philo.id,
    groups: ["哲学", "物理"],
    body: `可证伪性不是实验室步骤，但是防呆：诠释若永远不会被下一张图打脸，它就不约束任何测量。`,
  });
}

export function seedTodosIfEmpty() {
  if (todoCount() > 0) return;

  const dp = findItemByTitle("wiki", "动态规划");
  const fft = findItemByTitle("collection_item", "如何理解傅里叶变换");

  const start = new Date();
  start.setHours(12, 0, 0, 0);

  const dpTodo = createTodo({
    title: "为「动态规划」补两道例题",
    body: "背包和编辑距离各写一题，链回 Wiki 页。",
    dueAt: start.getTime(),
    groups: ["计算机"],
  });
  if (dp) addLink(dpTodo.id, dp.id);

  const wikiTodo = createTodo({
    title: "把傅里叶变换那篇收成 Wiki",
    body: "从收藏升一页，挂到计算机 / 算法下面。",
    dueAt: new Date("2026-09-12T12:00:00").getTime(),
    groups: ["数学"],
  });
  if (fft) addLink(wikiTodo.id, fft.id);

  const done = createTodo({
    title: "整理哲学收藏夹分组",
    body: "已打过物理 / 哲学，这条用来看「全部」里的完成态。",
    groups: ["哲学"],
  });
  updateTodo(done.id, { status: "done" });
}

export function ensureDemoTodoState() {
  const done = findItemByTitle("todo", "整理哲学收藏夹分组");
  if (done && done.status !== "done") updateTodo(done.id, { status: "done" });

  const dpTodo = findItemByTitle("todo", "为「动态规划」补两道例题");
  const dp = findItemByTitle("wiki", "动态规划");
  if (dpTodo && dp) addLink(dpTodo.id, dp.id);

  const wikiTodo = findItemByTitle("todo", "把傅里叶变换那篇收成 Wiki");
  const fft = findItemByTitle("collection_item", "如何理解傅里叶变换");
  if (wikiTodo && fft) addLink(wikiTodo.id, fft.id);
}

export function seedDraftsIfEmpty() {
  if (draftCount() > 0) return;

  const philo = findItemByTitle("collection_item", "为什么物理学家需要哲学");
  const fft = findItemByTitle("collection_item", "如何理解傅里叶变换");
  const dp = findItemByTitle("wiki", "动态规划");

  const d1 = createDraft({
    title: "物理学家为什么需要哲学",
    groups: ["物理", "哲学"],
    linkIds: philo ? [philo.id] : [],
    body: `物理学家每天都在用「理论」「模型」「实在」，但不等于已经想清楚。哲学在这里的用处很具体：逼你写出什么结果会让你改口。

可证伪性当不了实验室手册，却能当防呆。如果一种诠释无论看见什么都能自圆其说，它就不约束下一张图。`,
  });
  generateVariantFromBase(d1.item.id, "wechat");
  generateVariantFromBase(d1.item.id, "zhihu");
  saveVariant(d1.item.id, "wechat", { status: "ready" });
  saveVariant(d1.item.id, "zhihu", { status: "ready" });

  const d2 = createDraft({
    title: "FFT 入门给工程师",
    groups: ["数学", "计算机"],
    linkIds: fft ? [fft.id] : [],
    body: `FFT 不是另一种物理，只是傅里叶变换在计算机里的快算法。时间里难做的事，频率里往往变成乘法。

排障时先看频谱上那根 50Hz 的线在不在，而不是在波形上数格子。`,
  });
  generateVariantFromBase(d2.item.id, "xiaohongshu");
  saveVariant(d2.item.id, "xiaohongshu", { status: "ready" });

  createDraft({
    title: "动态规划直觉",
    groups: ["计算机"],
    linkIds: dp ? [dp.id] : [],
    body: `先问这一步由前面哪几步决定。状态、转移、边界写清，例题再补。`,
  });
}

export function seedCoursesIfEmpty() {
  if (courseCount() > 0) return;

  const fftItem = findItemByTitle("collection_item", "如何理解傅里叶变换");
  const dpWiki = findItemByTitle("wiki", "动态规划");
  const algo = listCollections().find((c) => c.name === "算法与数学");

  const fft = createCourse({
    title: "傅里叶直觉",
    groups: ["数学"],
    body: "给工程师的直觉课：换一副眼镜，从时间看到频率。FFT 不是另一种物理。",
  });
  applyOutline(fft.item.id, FFT_OUTLINE);
  if (algo) addBinding(fft.item.id, "collection", algo.id);
  if (fftItem) addBinding(fft.item.id, "item", fftItem.id);
  confirmCourse(fft.item.id);

  const what = findCourseNode(fft.item.id, "傅里叶在干什么");
  if (what) {
    saveLessonBody(
      what.id,
      `傅里叶变换不是把信号变得更高级，而是换一副眼镜：原来你沿着时间看起伏，现在改成沿着频率看它由哪些纯音叠出来。

## 为什么要换

时间里难做的事，频率里往往变成乘法。排障、压缩、卷积，走的都是同一条路。

这一课只要记住一句话：FFT 是这个想法在计算机里的快算法，不是另一套物理。`,
    );
    setLessonStatus(what.id, "done");
  }

  const period = findCourseNode(fft.item.id, "周期信号");
  if (period) {
    saveLessonBody(
      period.id,
      `周期信号可以拆成一组离散的正弦。每一根谱线对应一个纯音，相位告诉你它何时到达波峰。

## 直觉

拿一段录音问「有没有 50Hz 的哼声」，不要在波形上数格子，去看频谱上那根线在不在。

下面 Canvas 把「时间上的起伏」逐步换成「频率上的几根线」。`,
    );
    const canvas = defaultCanvasFor(period.title);
    if (canvas) saveCanvas(period.id, canvas);
    setLessonStatus(period.id, "in_progress");
  }

  const dpCourse = createCourse({
    title: "动态规划入门",
    groups: ["计算机"],
  });
  if (dpWiki) addBinding(dpCourse.item.id, "item", dpWiki.id);
  if (algo) addBinding(dpCourse.item.id, "collection", algo.id);
}
