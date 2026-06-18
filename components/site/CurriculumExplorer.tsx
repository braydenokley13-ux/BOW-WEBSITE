"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { Badge, Button } from "@/components/ds";
import {
  type Lesson,
  type LessonStatus,
  LESSON_STATUS_META,
  FLAGSHIP_LESSON_IDS,
  FEATURED_LESSON_ID,
  moduleLabel,
} from "@/lib/lessons";

interface FilterState {
  track: string;
  module: string;
  concept: string;
  grade: string;
  status: string;
  experience: string;
}

const DEFAULT_FILTERS: FilterState = {
  track: "all",
  module: "all",
  concept: "all",
  grade: "all",
  status: "all",
  experience: "all",
};

type FilterKey = keyof FilterState;

const STATUS_ORDER: LessonStatus[] = ["available", "pilot", "coming-soon", "in-development"];

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function simInfo(l: Lesson): { label: string; tone: string } {
  return l.simulationStatus === "available"
    ? { label: "Simulation Available", tone: "var(--bow-positive)" }
    : { label: "Simulation Coming Soon", tone: "var(--bow-slate)" };
}

function podInfo(l: Lesson): { label: string; tone: string } {
  return l.podcastEpisode
    ? { label: `Podcast · ${l.podcastEpisode}`, tone: "var(--bow-positive)" }
    : { label: "Podcast Not Yet Connected", tone: "var(--bow-slate)" };
}

interface CurriculumExplorerProps {
  lessons: Lesson[];
}

export default function CurriculumExplorer({ lessons }: CurriculumExplorerProps) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [search, setSearch] = useState("");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);

  // Responsive layout switch at 1024px (matches prototype's vw >= 1024 logic).
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const setFilter = (key: FilterKey, value: string) =>
    setFilters((prev) => ({ ...prev, [key]: value }));
  const clearAllFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setSearch("");
  };

  // ---- filtered results ----
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = lessons.filter((l) => {
      if (filters.track !== "all" && l.track !== filters.track) return false;
      if (filters.module !== "all" && String(l.moduleNumber) !== String(filters.module)) return false;
      if (filters.concept !== "all" && !l.concepts.includes(filters.concept)) return false;
      if (filters.grade !== "all" && l.gradeBand !== filters.grade) return false;
      if (filters.status !== "all" && l.status !== filters.status) return false;
      if (filters.experience !== "all" && l.experienceType !== filters.experience) return false;
      if (q) {
        const hay = [l.title, l.summary, l.centralQuestion, l.role, l.moduleTitle, l.experienceType, l.concepts.join(" ")]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    // flagships sort to the top
    return result
      .slice()
      .sort(
        (a, b) =>
          (FLAGSHIP_LESSON_IDS.includes(b.id) ? 1 : 0) - (FLAGSHIP_LESSON_IDS.includes(a.id) ? 1 : 0),
      );
  }, [lessons, filters, search]);

  const featured = useMemo(() => filtered.find((l) => l.id === FEATURED_LESSON_ID) || null, [filtered]);
  const gridSource = featured ? filtered.filter((l) => l.id !== featured.id) : filtered;

  // ---- filter option lists (derived from data) ----
  const conceptList = useMemo(() => uniq(lessons.flatMap((l) => l.concepts)).sort(), [lessons]);
  const gradeList = useMemo(() => uniq(lessons.map((l) => l.gradeBand)), [lessons]);
  const statusList = useMemo(
    () => STATUS_ORDER.filter((s) => lessons.some((l) => l.status === s)),
    [lessons],
  );
  const expList = useMemo(() => uniq(lessons.map((l) => l.experienceType)).sort(), [lessons]);

  const modTrack = filters.track !== "all" ? filters.track : null;
  const moduleNums = useMemo(() => {
    if (!modTrack) return [];
    const modLessons = lessons.filter((l) => l.track === modTrack);
    return uniq(modLessons.map((l) => l.moduleNumber)).sort((a, b) => a - b);
  }, [lessons, modTrack]);

  interface Opt {
    value: string;
    label: string;
  }

  const opt = (value: string, label: string): Opt => ({ value, label });
  const trackOptions: Opt[] = [opt("all", "All Tracks"), opt("101", "Track 101"), opt("201", "Track 201")];
  const conceptOptions: Opt[] = [opt("all", "All Concepts"), ...conceptList.map((c) => opt(c, c))];
  const gradeOptions: Opt[] = [opt("all", "All Grades"), ...gradeList.map((g) => opt(g, g))];
  const statusOptions: Opt[] = [opt("all", "All Statuses"), ...statusList.map((s) => opt(s, LESSON_STATUS_META[s].label))];
  const experienceOptions: Opt[] = [opt("all", "All Types"), ...expList.map((e) => opt(e, e))];
  const moduleOptions: Opt[] = modTrack
    ? [
        opt("all", "All Modules"),
        ...moduleNums.map((n) => {
          const ml = lessons.find((l) => l.track === modTrack && l.moduleNumber === n);
          return opt(String(n), `M${n} · ${ml ? ml.moduleTitle : ""}`);
        }),
      ]
    : [];

  interface FilterGroup {
    key: FilterKey;
    label: string;
    options: Opt[];
    ready: boolean;
    note: string;
  }

  const filterGroups: FilterGroup[] = [
    { key: "track", label: "Track", options: trackOptions, ready: true, note: "" },
    { key: "module", label: "Module", options: moduleOptions, ready: !!modTrack, note: modTrack ? "" : "Select a track to filter by module." },
    { key: "concept", label: "Concept", options: conceptOptions, ready: true, note: "" },
    { key: "grade", label: "Grade Band", options: gradeOptions, ready: true, note: "" },
    { key: "status", label: "Status", options: statusOptions, ready: true, note: "" },
    { key: "experience", label: "Experience", options: experienceOptions, ready: true, note: "" },
  ];

  // ---- active filter chips ----
  interface ChipDef {
    key: FilterKey;
    label: string;
  }
  const chipDefs: ChipDef[] = [];
  if (filters.track !== "all") chipDefs.push({ key: "track", label: `Track ${filters.track}` });
  if (filters.module !== "all") chipDefs.push({ key: "module", label: `Module ${String(filters.module).padStart(2, "0")}` });
  if (filters.concept !== "all") chipDefs.push({ key: "concept", label: filters.concept });
  if (filters.grade !== "all") chipDefs.push({ key: "grade", label: filters.grade });
  if (filters.status !== "all")
    chipDefs.push({ key: "status", label: LESSON_STATUS_META[filters.status as LessonStatus]?.label ?? filters.status });
  if (filters.experience !== "all") chipDefs.push({ key: "experience", label: filters.experience });

  const searchActive = !!search.trim();
  const activeFilterCount = chipDefs.length + (searchActive ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0;

  // ---- empty-state suggestion ----
  let emptySuggestion: { label: string; on: () => void } | null = null;
  if (filtered.length === 0) {
    if (filters.status !== "all" && filters.status !== "available")
      emptySuggestion = { label: "Show available lessons instead", on: () => setFilter("status", "available") };
    else if (filters.concept !== "all")
      emptySuggestion = { label: "Clear the concept filter", on: () => setFilter("concept", "all") };
  }

  const filtersVisible = isDesktop || mobileFiltersOpen;
  const showFilterToggle = !isDesktop;
  const explorerGridCols = isDesktop ? "260px minmax(0,1fr)" : "1fr";
  const countLabel = `${filtered.length}${filtered.length === 1 ? " lesson" : " lessons"}`;

  return (
    <section style={{ background: "var(--bow-paper)", padding: "clamp(28px,4vw,52px) clamp(18px,4vw,40px) clamp(48px,7vw,96px)" }}>
      <div
        className="bow-container-wide"
        style={{ display: "grid", gridTemplateColumns: explorerGridCols, gap: "clamp(20px,3vw,40px)", alignItems: "start" }}
      >
        {/* FILTERS */}
        <aside style={{ position: "relative" }}>
          {showFilterToggle && (
            <button
              type="button"
              onClick={() => setMobileFiltersOpen((v) => !v)}
              aria-expanded={mobileFiltersOpen}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                background: "#fff",
                border: "1px solid var(--border-rule)",
                padding: "14px 18px",
                cursor: "pointer",
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 14,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: "var(--bow-ink)",
                marginBottom: 14,
              }}
            >
              <span>{mobileFiltersOpen ? "Hide Filters" : "Filter Lessons"}</span>
              <span
                style={{
                  fontFamily: "var(--font-data)",
                  fontSize: 12,
                  background: "var(--bow-blue)",
                  color: "#fff",
                  minWidth: 22,
                  height: 22,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 999,
                  padding: "0 6px",
                }}
              >
                {activeFilterCount}
              </span>
            </button>
          )}

          {filtersVisible && (
            <div style={{ background: "#fff", border: "1px solid var(--border-rule)", padding: "clamp(18px,2vw,24px)" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 18 }}>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 16, textTransform: "uppercase", letterSpacing: "0.02em" }}>
                  Filter Cases
                </span>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    style={{
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      fontFamily: "var(--font-display)",
                      fontWeight: 700,
                      fontSize: 12,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      color: "var(--bow-blue)",
                      padding: 0,
                    }}
                  >
                    Clear all
                  </button>
                )}
              </div>
              {filterGroups.map((g) => (
                <div key={g.key} style={{ marginBottom: 20, borderTop: "1px solid var(--border-rule)", paddingTop: 16 }}>
                  <div
                    style={{
                      fontFamily: "var(--font-data)",
                      fontWeight: 600,
                      fontSize: 11,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "var(--bow-slate)",
                      marginBottom: 10,
                    }}
                  >
                    {g.label}
                  </div>
                  {g.ready ? (
                    <div role="group" aria-label={g.label} style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                      {g.options.map((o) => {
                        const active = String(filters[g.key]) === String(o.value);
                        return (
                          <button
                            key={o.value}
                            type="button"
                            onClick={() => setFilter(g.key, o.value)}
                            aria-pressed={active}
                            style={{
                              fontFamily: "var(--font-interface)",
                              fontWeight: 600,
                              fontSize: 12.5,
                              padding: "6px 11px",
                              borderRadius: "var(--radius-pill)",
                              cursor: "pointer",
                              background: active ? "var(--bow-blue)" : "#fff",
                              color: active ? "#fff" : "var(--bow-ink)",
                              border: `1px solid ${active ? "var(--bow-blue)" : "var(--border-rule)"}`,
                            }}
                          >
                            {o.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : g.note ? (
                    <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 13, lineHeight: 1.45, color: "var(--bow-slate)" }}>
                      {g.note}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* RESULTS */}
        <div style={{ minWidth: 0 }}>
          {/* toolbar */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search a case, decision, role, or concept…"
                aria-label="Search lessons"
                style={{
                  width: "100%",
                  background: "#fff",
                  border: "1px solid var(--border-rule)",
                  padding: "13px 40px 13px 16px",
                  fontFamily: "var(--font-interface)",
                  fontSize: 15,
                  color: "var(--bow-ink)",
                  borderRadius: "var(--radius-control)",
                }}
              />
              {searchActive && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 20,
                    lineHeight: 1,
                    color: "var(--bow-slate)",
                    padding: "4px 8px",
                  }}
                >
                  ×
                </button>
              )}
            </div>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 13, letterSpacing: "0.04em", color: "var(--bow-slate)", whiteSpace: "nowrap" }}>
              {countLabel}
            </span>
          </div>

          {/* active chips */}
          {hasActiveFilters && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 22 }}>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
                Active:
              </span>
              {chipDefs.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => setFilter(chip.key, "all")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    background: "var(--bow-blue-tint)",
                    color: "var(--bow-blue)",
                    border: "1px solid transparent",
                    padding: "5px 10px",
                    borderRadius: "var(--radius-pill)",
                    cursor: "pointer",
                    fontFamily: "var(--font-interface)",
                    fontWeight: 600,
                    fontSize: 12.5,
                  }}
                >
                  <span>{chip.label}</span>
                  <span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1 }}>
                    ×
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={clearAllFilters}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: 12,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  color: "var(--bow-slate)",
                }}
              >
                Reset
              </button>
            </div>
          )}

          {/* featured case */}
          {featured && <FeaturedCard lesson={featured} />}

          {/* empty state */}
          {filtered.length === 0 && (
            <div style={{ border: "1px dashed var(--border-rule)", background: "#fff", padding: "clamp(32px,5vw,56px)", textAlign: "center" }}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 22, textTransform: "uppercase", letterSpacing: "0.01em", color: "var(--bow-ink)" }}>
                No cases match these filters
              </span>
              <p style={{ margin: "12px auto 0", fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.6, color: "var(--bow-slate)", maxWidth: 420 }}>
                Try removing a filter, or take a different angle into the case library.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", marginTop: 22 }}>
                <Button variant="primary" size="md" onClick={clearAllFilters}>
                  Clear Filters
                </Button>
                {emptySuggestion && (
                  <Button variant="secondary" size="md" onClick={emptySuggestion.on}>
                    {emptySuggestion.label}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* results grid */}
          {filtered.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "clamp(14px,1.8vw,20px)" }}>
              {gridSource.map((l) => (
                <ResultCard key={l.id} lesson={l} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function FeaturedCard({ lesson }: { lesson: Lesson }) {
  const s = LESSON_STATUS_META[lesson.status];
  return (
    <Link
      href={`/lessons/${lesson.slug}`}
      aria-label={`Open lesson: ${lesson.title} — ${s.label}`}
      style={{
        position: "relative",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: 0,
        border: "1px solid var(--bow-ink)",
        background: "var(--bow-ink)",
        color: "#fff",
        cursor: "pointer",
        marginBottom: 26,
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "clamp(26px,3.4vw,44px)", position: "relative", overflow: "hidden", borderRight: "1px solid var(--bow-dark-border)" }}>
        <span style={{ position: "absolute", right: 10, top: -16, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(90px,12vw,150px)", lineHeight: 0.8, color: "rgba(255,255,255,0.07)" }}>
          {lesson.bigNum}
        </span>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-orange)", position: "relative" }}>
          Flagship Case · {lesson.trackLabel}
        </span>
        <p style={{ margin: "14px 0 0", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(24px,3vw,40px)", lineHeight: 1.06, letterSpacing: "-0.012em", position: "relative", textWrap: "pretty" }}>
          {lesson.centralQuestion}
        </p>
        <span style={{ display: "block", marginTop: 12, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.04em", textTransform: "uppercase", color: "#6f8bff", position: "relative" }}>
          {lesson.title} →
        </span>
      </div>
      <div style={{ padding: "clamp(22px,2.6vw,32px)", display: "flex", flexDirection: "column", gap: 16, background: "var(--bow-dark-surface)" }}>
        <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.55, color: "#c8cad0" }}>{lesson.summary}</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {lesson.concepts.slice(0, 4).map((c) => (
            <span key={c} style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.04em", textTransform: "uppercase", color: "#c8cad0", border: "1px solid var(--bow-dark-border)", padding: "5px 9px" }}>
              {c}
            </span>
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: "auto", fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase", color: "#9a9da6" }}>
          <span>{moduleLabel(lesson)}</span>
          <span>{lesson.duration}</span>
          <span>{lesson.gradeBand}</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <Badge status={s.badge}>{s.label}</Badge>
        </div>
      </div>
    </Link>
  );
}

function ResultCard({ lesson }: { lesson: Lesson }) {
  const s = LESSON_STATUS_META[lesson.status];
  const si = simInfo(lesson);
  const pi = podInfo(lesson);
  const metaRow: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontFamily: "var(--font-data)",
    fontSize: 11,
    letterSpacing: "0.03em",
    textTransform: "uppercase",
  };
  return (
    <Link
      href={`/lessons/${lesson.slug}`}
      aria-label={`Open lesson: ${lesson.title} — ${s.label}`}
      className="bow-card"
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        background: "#fff",
        border: "1px solid var(--border-rule)",
        padding: "22px 20px",
        cursor: "pointer",
        overflow: "hidden",
        color: "var(--bow-ink)",
      }}
    >
      <span style={{ position: "absolute", right: 6, top: -14, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 76, lineHeight: 0.8, color: "rgba(10,10,11,0.05)", pointerEvents: "none" }}>
        {lesson.bigNum}
      </span>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, position: "relative" }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-blue)" }}>
          {lesson.trackLabel}
        </span>
        <Badge status={s.badge}>{s.label}</Badge>
      </div>
      <p style={{ margin: 0, fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(18px,1.7vw,22px)", lineHeight: 1.18, letterSpacing: "-0.005em", position: "relative", textWrap: "pretty" }}>
        {lesson.centralQuestion}
      </p>
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12.5, letterSpacing: "0.03em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
        {lesson.title}
      </span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {lesson.concepts.slice(0, 3).map((c) => (
          <span key={c} style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.03em", textTransform: "uppercase", color: "var(--bow-ink)", background: "var(--bow-paper)", border: "1px solid var(--border-rule)", padding: "4px 8px" }}>
            {c}
          </span>
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.03em", color: "var(--bow-slate)", borderTop: "1px solid var(--border-rule)", paddingTop: 12, marginTop: "auto" }}>
        <span>{lesson.experienceType}</span>
        <span>{lesson.duration}</span>
        <span>{lesson.gradeBand}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ ...metaRow, color: si.tone }}>{si.label}</span>
        <span style={{ ...metaRow, color: pi.tone }}>{pi.label}</span>
      </div>
    </Link>
  );
}
