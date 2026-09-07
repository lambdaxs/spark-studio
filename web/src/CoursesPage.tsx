import { useEffect, useState } from "react";
import { CourseReader } from "./CourseReader";
import { CourseShelf } from "./CourseShelf";
import { CourseStudio } from "./CourseStudio";
import { api, type CourseRow } from "./api";
import { matchesQuery, useQuery } from "./shell";

type View =
  | { kind: "shelf" }
  | { kind: "studio"; id: string }
  | { kind: "read"; id: string };

export function CoursesPage() {
  const query = useQuery();
  const [books, setBooks] = useState<CourseRow[]>([]);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>({ kind: "shelf" });

  async function refreshBooks() {
    const list = await api.courses();
    setBooks(list);
    setReady(true);
    return list;
  }

  useEffect(() => {
    void refreshBooks();
  }, []);

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
