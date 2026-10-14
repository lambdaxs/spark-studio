import { useEffect, useState } from "react";
import { CourseReader } from "./CourseReader";
import { CourseShelf } from "./CourseShelf";
import { CourseStudio } from "./CourseStudio";
import { api, UnauthorizedError, type CourseRow } from "./api";
import { failureDetail } from "./feedback";
import { matchesQuery, useQuery, useShell } from "./shell";

type View =
  | { kind: "shelf" }
  | { kind: "studio"; id: string }
  | { kind: "read"; id: string };

export function CoursesPage() {
  const query = useQuery();
  const { pending, consumePending } = useShell();
  const [books, setBooks] = useState<CourseRow[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>({ kind: "shelf" });

  async function refreshBooks() {
    try {
      const list = await api.courses();
      setBooks(list);
      setError("");
      setReady(true);
      return list;
    } catch (err) {
      if (!(err instanceof UnauthorizedError)) setError(failureDetail(err));
      setReady(true);
      return [];
    }
  }

  useEffect(() => {
    void refreshBooks();
  }, []);

  useEffect(() => {
    if (pending?.module !== "courses") return;
    setView(
      pending.courseView === "studio"
        ? { kind: "studio", id: pending.id }
        : { kind: "read", id: pending.id },
    );
    consumePending();
  }, [pending]);

  const visible = books.filter((b) => matchesQuery(query, b.title, b.subtitle));

  if (view.kind === "studio") {
    return (
      <CourseStudio
        courseId={view.id}
        onBack={() => {
          void refreshBooks();
          setView({ kind: "shelf" });
        }}
        onOpenBook={(id) => {
          void refreshBooks();
          setView({ kind: "read", id });
        }}
        onSwitch={(id) => setView({ kind: "studio", id })}
      />
    );
  }

  if (view.kind === "read") {
    return (
      <CourseReader
        courseId={view.id}
        onBack={() => {
          void refreshBooks();
          setView({ kind: "shelf" });
        }}
        onProgress={() => void refreshBooks()}
      />
    );
  }

  return (
    <CourseShelf
      books={visible}
      loaded={ready}
      error={error}
      onRetry={() => void refreshBooks()}
      emptyTitle={query.trim() && books.length > 0 && visible.length === 0 ? "没有匹配的书" : undefined}
      emptyDetail={query.trim() && books.length > 0 && visible.length === 0 ? "换个词，或清空顶栏搜索。" : undefined}
      onOpen={(id) => setView({ kind: "read", id })}
      onWrite={() => {
        void api.createCourse().then((created) => setView({ kind: "studio", id: created.item.id }));
      }}
      onDelete={(id) => {
        void api.trashItem(id).then(() => refreshBooks());
      }}
    />
  );
}
