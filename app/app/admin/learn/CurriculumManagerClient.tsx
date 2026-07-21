"use client";

/* ============================================================
 * app/app/admin/learn/CurriculumManagerClient.tsx — client island for the
 * curriculum manager: track/module/lesson tree, create/duplicate/template/
 * archive actions. The server page (page.tsx) does the initial data fetch;
 * this component owns interaction and re-fetches after mutations.
 * ============================================================ */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge, Button } from "@/components/ds";
import {
  archiveLesson,
  createFromTemplate,
  createLesson,
  createModule,
  createTrack,
  duplicateLesson,
  type CurriculumTree,
} from "@/app/actions/learn-author";
import { deriveLessonStatusChip, type LessonStatusTone } from "@/components/learn/builder/statusChip";

type BadgeTone = "positive" | "warning" | "negative" | "info" | "neutral" | "locked";
const TONE_MAP: Record<LessonStatusTone, BadgeTone> = {
  neutral: "neutral",
  positive: "positive",
  warning: "warning",
  info: "info",
};

export default function CurriculumManagerClient({ tree }: { tree: CurriculumTree }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newTrackTitle, setNewTrackTitle] = useState("");
  const [newModuleTitle, setNewModuleTitle] = useState<Record<string, string>>({});
  const [newLessonTitle, setNewLessonTitle] = useState<Record<string, string>>({});

  function refresh() {
    router.refresh();
  }

  async function handleCreateTrack() {
    if (!newTrackTitle.trim()) return;
    await createTrack({ title: newTrackTitle.trim() });
    setNewTrackTitle("");
    refresh();
  }

  async function handleCreateModule(trackId: string) {
    const title = newModuleTitle[trackId]?.trim();
    if (!title) return;
    await createModule({ trackId, title });
    setNewModuleTitle((prev) => ({ ...prev, [trackId]: "" }));
    refresh();
  }

  async function handleCreateLesson(moduleId: string) {
    const title = newLessonTitle[moduleId]?.trim();
    if (!title) return;
    const result = await createLesson({ moduleId, title });
    setNewLessonTitle((prev) => ({ ...prev, [moduleId]: "" }));
    if (result.ok) {
      router.push(`/app/admin/learn/lesson/${result.id}`);
    } else {
      refresh();
    }
  }

  async function handleDuplicate(lessonId: string) {
    startTransition(async () => {
      await duplicateLesson(lessonId);
      refresh();
    });
  }

  async function handleNewFromTemplate(templateId: string, moduleId: string, templateTitle: string) {
    startTransition(async () => {
      const result = await createFromTemplate(templateId, moduleId, `${templateTitle} (from template)`);
      if (result.ok) router.push(`/app/admin/learn/lesson/${result.id}`);
    });
  }

  async function handleArchive(lessonId: string) {
    startTransition(async () => {
      await archiveLesson(lessonId);
      refresh();
    });
  }

  const templates = tree.lessons.filter((l) => l.isTemplate);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          placeholder="New track title"
          value={newTrackTitle}
          onChange={(e) => setNewTrackTitle(e.target.value)}
          style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #d7d7db", fontSize: 14 }}
        />
        <Button variant="primary" size="sm" onClick={handleCreateTrack}>
          + New Track
        </Button>
      </div>

      {tree.tracks.map((track) => {
        const modules = tree.modules.filter((m) => m.trackId === track.id);
        return (
          <div key={track.id} style={{ border: "1px solid #e4e4e7", borderRadius: 10, padding: 16 }}>
            <h3 style={{ margin: "0 0 12px" }}>{track.title}</h3>
            {modules.map((mod) => {
              const lessons = tree.lessons.filter((l) => l.moduleId === mod.id && l.lifecycle !== "archived");
              return (
                <div key={mod.id} style={{ marginLeft: 12, marginBottom: 16, paddingLeft: 12, borderLeft: "2px solid #eee" }}>
                  <h4 style={{ margin: "0 0 8px" }}>{mod.title}</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
                    {lessons.map((lesson) => {
                      const draftAhead = Boolean(
                        lesson.publishedVersionId &&
                          lesson.draftUpdatedAt &&
                          lesson.publishedAt &&
                          lesson.draftUpdatedAt > lesson.publishedAt,
                      );
                      const chip = deriveLessonStatusChip({
                        lifecycle: lesson.lifecycle,
                        publishedVersionId: lesson.publishedVersionId,
                        publishedVersion: lesson.publishedVersion,
                        draftAheadOfPublished: draftAhead,
                      });
                      return (
                        <div key={lesson.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <a href={`/app/admin/learn/lesson/${lesson.id}`} style={{ fontSize: 14 }}>
                            {lesson.title}
                          </a>
                          <Badge status={TONE_MAP[chip.tone]}>{chip.label}</Badge>
                          {lesson.isTemplate && <Badge status="info">Template</Badge>}
                          <Button variant="ghost" size="sm" onClick={() => handleDuplicate(lesson.id)} disabled={isPending}>
                            Duplicate
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleArchive(lesson.id)} disabled={isPending}>
                            Archive
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      placeholder="New lesson title"
                      value={newLessonTitle[mod.id] ?? ""}
                      onChange={(e) => setNewLessonTitle((prev) => ({ ...prev, [mod.id]: e.target.value }))}
                      style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #d7d7db", fontSize: 13 }}
                    />
                    <Button variant="secondary" size="sm" onClick={() => handleCreateLesson(mod.id)}>
                      + New Lesson
                    </Button>
                    {templates.length > 0 && (
                      <select
                        style={{ fontSize: 13 }}
                        defaultValue=""
                        onChange={(e) => {
                          const t = templates.find((tt) => tt.id === e.target.value);
                          if (t) handleNewFromTemplate(t.id, mod.id, t.title);
                          e.target.value = "";
                        }}
                      >
                        <option value="">New from template…</option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.title}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              );
            })}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input
                placeholder="New module title"
                value={newModuleTitle[track.id] ?? ""}
                onChange={(e) => setNewModuleTitle((prev) => ({ ...prev, [track.id]: e.target.value }))}
                style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #d7d7db", fontSize: 13 }}
              />
              <Button variant="secondary" size="sm" onClick={() => handleCreateModule(track.id)}>
                + New Module
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
