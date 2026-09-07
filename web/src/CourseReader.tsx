import { useEffect, useState } from "react";
import { AgentPanel } from "./AgentPanel";
import { IconBack } from "./Icons";
import { LessonCanvas } from "./LessonCanvas";
import { MarkdownView } from "./MarkdownDoc";
import { api, streamLesson, type CourseDetail, type CourseNode, type LessonDetail } from "./api";

function firstLesson(nodes: CourseNode[]): CourseNode | undefined {
  for (const n of nodes) {
    if (n.contentKind === "lesson") return n;
    const child = firstLesson(n.children);
    if (child) return child;
  }
}

function findLesson(nodes: CourseNode[], pred: (n: CourseNode) => boolean): CourseNode | undefined {
  for (const n of nodes) {
    if (pred(n)) return n;
    const child = findLesson(n.children, pred);
    if (child) return child;
  }
}

function TreeButtons({
  nodes,
  selectedId,
  onSelect,
}: {
  nodes: CourseNode[];
  selectedId?: string;
  onSelect: (n: CourseNode) => void;
}) {
  return (
    <>
      {nodes.map((n) => {
        const muted = n.contentKind === "lesson" && n.status === "not_started" && !n.hasBody;
        const mark = n.contentKind === "lesson" && n.status === "done" ? " ✓" : "";
        return (
          <div key={n.id}>
            <button
              type="button"
              className={`tree-item ${n.id === selectedId ? "active" : ""} ${muted ? "muted" : ""}`}
              onClick={() => onSelect(n)}
            >
              {n.title}
              {mark}
            </button>
            {n.children.length > 0 ? (
              <div className="tree-branch">
                <TreeButtons nodes={n.children} selectedId={selectedId} onSelect={onSelect} />
              </div>
            ) : null}
          </div>
        );
      })}
    </>
  );
}

export function CourseReader({
  courseId,
  onBack,
  onProgress,
}: {
  courseId: string;
  onBack: () => void;
  onProgress: () => void;
}) {
  const [course, setCourse] = useState<CourseDetail>();
  const [lesson, setLesson] = useState<LessonDetail>();
  const [chapter, setChapter] = useState<CourseNode>();
  const [view, setView] = useState<"doc" | "canvas">("doc");
  const [generating, setGenerating] = useState(false);
  const [draftBody, setDraftBody] = useState("");

  async function openNode(node: CourseNode, current?: CourseDetail) {
    const host = current ?? course;
    if (node.contentKind === "chapter") {
      setChapter(node);
      setLesson(undefined);
      setDraftBody("");
      return;
    }
    setChapter(undefined);
    if (node.hasBody) {
      const detail = await api.lesson(node.id);
      setLesson(detail);
      setView("doc");
      setDraftBody("");
      return;
    }
    setGenerating(true);
    setDraftBody("");
    setLesson(undefined);
    const result = await streamLesson(node.id, (t) => setDraftBody((s) => s + t));
    setGenerating(false);
    if (result.lesson) {
      setLesson(result.lesson);
      setView("doc");
    }
    if (host) {
      const next = await api.course(host.item.id);
      setCourse(next);
      onProgress();
    }
  }

  useEffect(() => {
    void api.course(courseId).then(async (detail) => {
      setCourse(detail);
      const start =
        findLesson(detail.tree, (n) => n.contentKind === "lesson" && n.status === "in_progress") ??
        firstLesson(detail.tree);
      if (start) await openNode(start, detail);
    });
  }, [courseId]);

  return (
    <div className="courses learn">
      <aside className="col">
        <div className="col-head split">
          <button type="button" className="text-btn back-btn" onClick={onBack}>
            <IconBack />
            返回书架
          </button>
        </div>
        <div className="col-head">{course?.item.title ?? "目录"}</div>
        {course ? (
          <TreeButtons
            nodes={course.tree}
            selectedId={lesson?.item.id ?? chapter?.id}
            onSelect={(n) => void openNode(n)}
          />
        ) : null}
      </aside>
      <article className="col">
        {chapter ? (
          <div className="reader">
            <h1>{chapter.title}</h1>
            <p className="byline">这一章只负责结构，点下面的课时才会生成正文。</p>
          </div>
        ) : lesson || generating ? (
          <div className="reader">
            <div className="filters">
              <button
                type="button"
                className={view === "doc" ? "active" : ""}
                onClick={() => setView("doc")}
              >
                文档
              </button>
              {lesson?.canvas ? (
                <button
                  type="button"
                  className={view === "canvas" ? "active" : ""}
                  onClick={() => setView("canvas")}
                >
                  Canvas
                </button>
              ) : null}
            </div>
            <h1>{lesson?.item.title ?? "生成这一课"}</h1>
            {lesson ? (
              <div className="byline">
                {[...lesson.item.ancestors.map((a) => a.title), lesson.item.title].join(" / ")}
                {lesson.item.status === "done" ? " · 已完成" : ""}
              </div>
            ) : (
              <div className="byline">正在按课程背景生成，写完会固化。</div>
            )}
            {view === "canvas" && lesson?.canvas ? (
              <LessonCanvas spec={lesson.canvas} />
            ) : (
              <MarkdownView>{lesson?.item.body || draftBody}</MarkdownView>
            )}
            {lesson && !generating ? (
              <button
                type="button"
                className="chip"
                onClick={() =>
                  void api
                    .patchLesson(
                      lesson.item.id,
                      lesson.item.status === "done" ? "in_progress" : "done",
                    )
                    .then((next) => {
                      setLesson(next);
                      if (course) void api.course(course.item.id).then(setCourse);
                      onProgress();
                    })
                }
              >
                {lesson.item.status === "done" ? "标为未完成" : "标为已完成"}
              </button>
            ) : null}
          </div>
        ) : (
          <div className="empty-col">点目录里的课时。第一次点开会生成正文并保存。</div>
        )}
      </article>
      <AgentPanel
        itemId={lesson?.item.id}
        context={
          lesson
            ? `课程「${course?.item.title ?? ""}」· 当前课时「${lesson.item.title}」`
            : "点开课时后，对话跟这一课走。"
        }
        placeholder="基于当前这一课提问…"
        extra={{ surface: view }}
        onDone={() => {
          if (lesson) void api.lesson(lesson.item.id).then(setLesson);
          if (course) void api.course(course.item.id).then(setCourse);
        }}
      />
    </div>
  );
}
