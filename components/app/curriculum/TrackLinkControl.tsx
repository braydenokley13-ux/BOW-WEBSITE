"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ds";
import { linkCourseToTrack } from "@/app/actions/curriculum";
import type { AuthoredTrack } from "@/lib/curriculum-courses";

/**
 * Which authored lessons this course runs.
 *
 * An explicit choice from a list of tracks that actually exist. Nothing here
 * matches on titles: a course and a set of authored lessons are two different
 * things, and deciding they are the same thing is a judgment, not a string
 * comparison.
 */
export default function TrackLinkControl({
  curriculumId,
  currentTrackId,
  tracks,
}: {
  curriculumId: string;
  currentTrackId: string | null;
  tracks: AuthoredTrack[];
}) {
  const router = useRouter();
  const [value, setValue] = useState(currentTrackId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const available = tracks.filter((track) => !track.claimedByCourseId || track.claimedByCourseId === curriculumId);

  const save = async () => {
    setBusy(true);
    setError(null);
    const result = await linkCourseToTrack(curriculumId, value || null);
    setBusy(false);
    if (result.ok) {
      setSaved(true);
      router.refresh();
    } else {
      setError(result.error ?? "That could not be saved.");
    }
  };

  return (
    <div>
      <label htmlFor="track-link" className="ops-label">
        Lessons this course runs
      </label>
      <select
        id="track-link"
        className="bow-input"
        style={{ marginTop: 6, maxWidth: 420 }}
        value={value}
        disabled={busy}
        onChange={(event) => {
          setValue(event.target.value);
          setSaved(false);
        }}
      >
        <option value="">No authored lessons yet</option>
        {available.map((track) => (
          <option key={track.id} value={track.id}>
            {track.title} — {track.lessonCount} lesson{track.lessonCount === 1 ? "" : "s"}
          </option>
        ))}
      </select>

      {tracks.length === 0 ? (
        <p style={{ margin: "8px 0 0", fontSize: 12.5, lineHeight: 1.55, color: "var(--bow-slate)" }}>
          Nothing has been authored in Studio yet, so there is nothing to point this course at.
        </p>
      ) : null}

      <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <Button size="sm" variant="secondary" disabled={busy || value === (currentTrackId ?? "")} onClick={save}>
          {busy ? "Saving…" : "Save"}
        </Button>
        {saved ? (
          <span role="status" style={{ fontSize: 13, color: "var(--bow-positive)" }}>
            Saved.
          </span>
        ) : null}
      </div>

      {error ? (
        <p role="alert" style={{ margin: "8px 0 0", fontSize: 13, color: "var(--bow-negative)" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
