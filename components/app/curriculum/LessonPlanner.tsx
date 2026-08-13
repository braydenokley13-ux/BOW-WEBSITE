"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button } from "@/components/ds";
import {
  addCourseLesson,
  addCourseResource,
  moveCourseLesson,
  removeCourseLesson,
  removeCourseResource,
  updateCourseLesson,
} from "@/app/actions/curriculum";
import {
  inferResourceKind,
  RESOURCE_KIND_LABEL,
  RESOURCE_KINDS,
  type CourseResource,
  type ResourceKind,
} from "@/lib/curriculum-resources-shared";
import type { CourseLesson } from "@/lib/curriculum-courses";

/**
 * The instructor-led lesson plan: a numbered list of lessons, each with a
 * title, an optional teaching note, and links to the material.
 *
 * This is deliberately not an editor. There is no rich text, no blocks, no
 * slide builder — the Slides already exist in Google Drive and the simulation
 * already exists in BOW. This organises them and launches them. Building a
 * second authoring system here would mean two places to keep a lesson current.
 */
export default function LessonPlanner({
  curriculumId,
  lessons,
  courseResources,
}: {
  curriculumId: string;
  lessons: CourseLesson[];
  courseResources: CourseResource[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingLesson, setAddingLesson] = useState(false);
  const [title, setTitle] = useState("");

  const run = async (work: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(true);
    setError(null);
    const result = await work();
    setBusy(false);
    if (result.ok) {
      setTitle("");
      setAddingLesson(false);
      router.refresh();
    } else {
      setError(result.error ?? "That could not be saved.");
    }
  };

  const ownLessons = lessons.filter((lesson) => lesson.source === "instructor_led");

  return (
    <div>
      {error ? (
        <p role="alert" style={{ margin: "0 0 10px", fontSize: 13, color: "var(--bow-negative)" }}>
          {error}
        </p>
      ) : null}

      {lessons.map((lesson) => (
        <LessonRow
          key={lesson.id}
          curriculumId={curriculumId}
          lesson={lesson}
          busy={busy}
          canReorder={lesson.source === "instructor_led" && ownLessons.length > 1}
          run={run}
        />
      ))}

      {addingLesson ? (
        <div style={{ marginTop: 14, padding: 14, border: "1px solid var(--border-rule)", borderRadius: "var(--radius-card)", background: "var(--bow-white)" }}>
          <label htmlFor="new-lesson-title" className="ops-label">
            Lesson {ownLessons.length + 1}
          </label>
          <input
            id="new-lesson-title"
            className="bow-input"
            style={{ marginTop: 6 }}
            maxLength={200}
            placeholder="Salary cap"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button size="sm" variant="primary" disabled={busy || title.trim().length < 2} onClick={() => run(() => addCourseLesson(curriculumId, { title }))}>
              {busy ? "Saving…" : "Add lesson"}
            </Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => setAddingLesson(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 14 }}>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => setAddingLesson(true)}>
            Add a lesson
          </Button>
        </div>
      )}

      <div style={{ marginTop: 28 }}>
        <span className="ops-label">Material for the whole course</span>
        <p style={{ margin: "6px 0 10px", fontSize: 12.5, lineHeight: 1.55, color: "var(--bow-slate)" }}>
          Anything an instructor needs on any day — the course guide, the standing Drive folder.
        </p>
        <ResourceList resources={courseResources} busy={busy} run={run} />
        <ResourceForm curriculumId={curriculumId} busy={busy} run={run} />
      </div>
    </div>
  );
}

function LessonRow({
  curriculumId,
  lesson,
  busy,
  canReorder,
  run,
}: {
  curriculumId: string;
  lesson: CourseLesson;
  busy: boolean;
  canReorder: boolean;
  run: (work: () => Promise<{ ok: boolean; error?: string }>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(lesson.title);
  const [note, setNote] = useState(lesson.teachingNote ?? "");
  const authored = lesson.source === "learn";

  return (
    <div style={{ padding: "14px 0", borderTop: "1px solid var(--border-rule)" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <span style={{ flex: "none", width: 26, fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)" }}>
          {String(lesson.position).padStart(2, "0")}
        </span>
        <span style={{ flex: "1 1 200px", minWidth: 0, fontSize: 14.5, color: "var(--bow-ink)" }}>{lesson.title}</span>
        {authored ? <Badge status="info">Self-paced</Badge> : null}
        {canReorder ? (
          <>
            <button type="button" className="bow-tiny" disabled={busy} onClick={() => run(() => moveCourseLesson(lesson.id, "up"))} aria-label={`Move ${lesson.title} up`}>
              ↑
            </button>
            <button type="button" className="bow-tiny" disabled={busy} onClick={() => run(() => moveCourseLesson(lesson.id, "down"))} aria-label={`Move ${lesson.title} down`}>
              ↓
            </button>
          </>
        ) : null}
        {!authored ? (
          <button type="button" className="bow-tiny" disabled={busy} onClick={() => setEditing((value) => !value)}>
            {editing ? "Done" : "Edit"}
          </button>
        ) : null}
      </div>

      {lesson.teachingNote && !editing ? (
        <p style={{ margin: "6px 0 0 38px", fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap", color: "var(--bow-slate)" }}>
          {lesson.teachingNote}
        </p>
      ) : null}

      <div style={{ marginLeft: 38 }}>
        <ResourceList resources={lesson.resources} busy={busy} run={run} />
        <ResourceForm
          curriculumId={curriculumId}
          busy={busy}
          run={run}
          lessonId={authored ? null : lesson.id}
          learnLessonId={authored ? lesson.id : null}
        />
      </div>

      {editing ? (
        <div style={{ marginLeft: 38, marginTop: 12 }}>
          <label htmlFor={`lesson-title-${lesson.id}`} className="ops-label">
            Title
          </label>
          <input
            id={`lesson-title-${lesson.id}`}
            className="bow-input"
            style={{ marginTop: 6 }}
            maxLength={200}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <label htmlFor={`lesson-note-${lesson.id}`} className="ops-label" style={{ display: "block", marginTop: 12 }}>
            Teaching note (optional)
          </label>
          <textarea
            id={`lesson-note-${lesson.id}`}
            className="bow-input"
            style={{ marginTop: 6 }}
            rows={3}
            maxLength={4000}
            placeholder="What this session has to land, and anything that catches people out."
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy || title.trim().length < 2}
              onClick={() => run(() => updateCourseLesson(lesson.id, { title, teachingNote: note }))}
            >
              Save lesson
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => removeCourseLesson(lesson.id))}>
              Remove lesson
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ResourceList({
  resources,
  busy,
  run,
}: {
  resources: CourseResource[];
  busy: boolean;
  run: (work: () => Promise<{ ok: boolean; error?: string }>) => Promise<void>;
}) {
  if (resources.length === 0) return null;
  return (
    <div className="bow-materials">
      {resources.map((resource) => (
        <span key={resource.id} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <a className="bow-materials__item" href={resource.url} target="_blank" rel="noreferrer noopener">
            <span className="bow-materials__kind">{RESOURCE_KIND_LABEL[resource.kind]}</span>
            <span className="bow-materials__label">{resource.label}</span>
          </a>
          <button
            type="button"
            className="bow-tiny"
            disabled={busy}
            aria-label={`Remove ${resource.label}`}
            onClick={() => run(() => removeCourseResource(resource.id))}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}

function ResourceForm({
  curriculumId,
  busy,
  run,
  lessonId = null,
  learnLessonId = null,
}: {
  curriculumId: string;
  busy: boolean;
  run: (work: () => Promise<{ ok: boolean; error?: string }>) => Promise<void>;
  lessonId?: string | null;
  learnLessonId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [kind, setKind] = useState<ResourceKind | "">("");

  // The URL usually says what it is. The guess is shown as the default and
  // stays changeable, because a confident wrong answer is worse than none.
  const guessed = url.trim() ? inferResourceKind(url) : null;

  if (!open) {
    return (
      <div style={{ marginTop: 8 }}>
        <button type="button" className="bow-tiny" disabled={busy} onClick={() => setOpen(true)}>
          + Add material
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 10, padding: 12, border: "1px solid var(--border-rule)", borderRadius: "var(--radius-control)", background: "var(--bow-white)" }}>
      <label htmlFor={`res-label-${lessonId ?? learnLessonId ?? "course"}`} className="ops-label">
        What is it
      </label>
      <input
        id={`res-label-${lessonId ?? learnLessonId ?? "course"}`}
        className="bow-input"
        style={{ marginTop: 6 }}
        maxLength={160}
        placeholder="Salary cap slides"
        value={label}
        onChange={(event) => setLabel(event.target.value)}
      />
      <label htmlFor={`res-url-${lessonId ?? learnLessonId ?? "course"}`} className="ops-label" style={{ display: "block", marginTop: 10 }}>
        Link
      </label>
      <input
        id={`res-url-${lessonId ?? learnLessonId ?? "course"}`}
        className="bow-input"
        style={{ marginTop: 6 }}
        maxLength={2000}
        placeholder="https://docs.google.com/presentation/… or /simulation"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
      />
      <label htmlFor={`res-kind-${lessonId ?? learnLessonId ?? "course"}`} className="ops-label" style={{ display: "block", marginTop: 10 }}>
        Type
      </label>
      <select
        id={`res-kind-${lessonId ?? learnLessonId ?? "course"}`}
        className="bow-input"
        style={{ marginTop: 6, maxWidth: 240 }}
        value={kind || guessed || ""}
        onChange={(event) => setKind(event.target.value as ResourceKind)}
      >
        {RESOURCE_KINDS.map((option) => (
          <option key={option} value={option}>
            {RESOURCE_KIND_LABEL[option]}
          </option>
        ))}
      </select>

      <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button
          size="sm"
          variant="primary"
          disabled={busy || label.trim().length < 2 || url.trim().length < 2}
          onClick={() =>
            run(async () => {
              const result = await addCourseResource(curriculumId, {
                label,
                url,
                kind: kind || guessed || undefined,
                lessonId,
                learnLessonId,
              });
              if (result.ok) {
                setLabel("");
                setUrl("");
                setKind("");
                setOpen(false);
              }
              return result;
            })
          }
        >
          {busy ? "Saving…" : "Add material"}
        </Button>
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
