"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ds";
import type { LibrarySimulation, NamedRef } from "@/lib/simulation-library";

/* ============================================================
 * The public simulation catalog, filterable.
 *
 * A teacher arrives with a constraint, not a browse intent: one 45-minute
 * period, Grade 7, football if possible. Every facet below exists to answer a
 * constraint like that, and the counts beside each option are computed against
 * the OTHER selections so a filter never silently leads to an empty page.
 *
 * The one rule this component must never break: a Launch button appears only
 * for a simulation that has somewhere to go. Records BOW is still building
 * carry no launch action at all — not a disabled button, which still reads as
 * a promise. `lib/simulation-library.ts` guarantees the shape; this file only
 * has to respect it.
 * ============================================================ */

const DURATION_NAMES: Record<string, string> = {
  "under-20": "Under 20 min",
  "20-45": "20–45 min",
  "45-90": "45–90 min",
  "multi-session": "Multiple sessions",
};

const AVAILABILITY_NAMES: Record<string, string> = {
  available: "Play now",
  "in-development": "In development",
};

type Facet = {
  key: string;
  label: string;
  get: (s: LibrarySimulation) => [string, string][];
};

const FACETS: Facet[] = [
  { key: "track", label: "Program", get: (s) => (s.track ? [[s.track.id, s.track.name]] : []) },
  { key: "subject", label: "Subject", get: (s) => [[s.subject.id, s.subject.name]] },
  { key: "context", label: "Sport & setting", get: (s) => s.contexts.map((c: NamedRef) => [c.id, c.name]) },
  { key: "concept", label: "Concept", get: (s) => s.concepts.map((c: NamedRef) => [c.id, c.name]) },
  { key: "grade", label: "Grade", get: (s) => s.gradeBands.map((g) => [g, `Grade ${g}`]) },
  {
    key: "duration",
    label: "Duration",
    get: (s) => (s.durationBucket ? [[s.durationBucket, DURATION_NAMES[s.durationBucket] ?? s.durationBucket]] : []),
  },
  {
    key: "format",
    label: "Format",
    get: (s) => [
      ...s.format.setting.map((f: NamedRef): [string, string] => [f.id, f.name]),
      ...s.format.grouping.map((f: NamedRef): [string, string] => [`g:${f.id}`, f.name]),
    ],
  },
  {
    key: "availability",
    label: "Availability",
    get: (s) => [[s.availability, AVAILABILITY_NAMES[s.availability] ?? s.availability]],
  },
];

const MONO: React.CSSProperties = {
  fontFamily: "var(--font-data)",
  fontSize: 10.5,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

export default function SimulationLibrary({ simulations }: { simulations: LibrarySimulation[] }) {
  const [selected, setSelected] = useState<Record<string, Set<string>>>(
    () => Object.fromEntries(FACETS.map((f) => [f.key, new Set<string>()])),
  );
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const normalizedQuery = query.trim().toLowerCase();

  /** `skipKey` lets a facet's own counts ignore its own selections. */
  const matches = useMemo(
    () => (sim: LibrarySimulation, skipKey: string | null) => {
      if (normalizedQuery) {
        const hay = [
          sim.title, sim.summary, sim.whatStudentsDo,
          sim.concepts.map((c) => c.name).join(" "),
          sim.contexts.map((c) => c.name).join(" "),
        ].join(" ").toLowerCase();
        if (!hay.includes(normalizedQuery)) return false;
      }
      for (const facet of FACETS) {
        if (facet.key === skipKey) continue;
        const want = selected[facet.key];
        if (!want || want.size === 0) continue;
        const have = facet.get(sim).map(([id]) => id);
        if (!have.some((id) => want.has(id))) return false;
      }
      return true;
    },
    [selected, normalizedQuery],
  );

  const shown = useMemo(() => simulations.filter((s) => matches(s, null)), [simulations, matches]);
  const anyFacetSelected = FACETS.some((f) => (selected[f.key]?.size ?? 0) > 0);

  const toggle = (key: string, id: string) => {
    setSelected((prev) => {
      const next = new Set(prev[key]);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, [key]: next };
    });
  };

  const clearAll = () => {
    setSelected(Object.fromEntries(FACETS.map((f) => [f.key, new Set<string>()])));
    setQuery("");
  };

  return (
    <div className="bow-simlib">
      <div className="bow-simlib__layout">
        <form
          className="bow-simlib__filters"
          aria-label="Filter simulations"
          onSubmit={(e) => e.preventDefault()}
        >
          <h2 style={{ ...MONO, color: "var(--bow-slate)", margin: "0 0 14px", fontWeight: 500 }}>Filter</h2>

          <button
            type="button"
            className="bow-simlib__filters-toggle"
            aria-expanded={filtersOpen}
            aria-controls="bow-simlib-filters-body"
            onClick={() => setFiltersOpen((v) => !v)}
          >
            {filtersOpen ? "Hide filters" : "Show filters"}
          </button>

          <div id="bow-simlib-filters-body" className="bow-simlib__filters-body" data-open={filtersOpen}>
            <label className="bow-simlib__sr" htmlFor="bow-simlib-search">Search simulations</label>
            <input
              id="bow-simlib-search"
              className="bow-simlib__search"
              type="search"
              placeholder="Search…"
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />

            {FACETS.map((facet) => {
              const values = new Map<string, string>();
              for (const sim of simulations) {
                for (const [id, name] of facet.get(sim)) if (!values.has(id)) values.set(id, name);
              }
              // A filter that cannot change the result is noise, not a feature.
              if (values.size < 2) return null;

              const counts = new Map<string, number>();
              for (const sim of simulations) {
                if (!matches(sim, facet.key)) continue;
                for (const [id] of facet.get(sim)) counts.set(id, (counts.get(id) ?? 0) + 1);
              }

              const entries = [...values].sort(
                (a, b) => (counts.get(b[0]) ?? 0) - (counts.get(a[0]) ?? 0) || a[1].localeCompare(b[1]),
              );

              return (
                <fieldset key={facet.key} className="bow-simlib__facet">
                  <legend style={{ ...MONO, color: "var(--bow-slate)", fontWeight: 500 }}>{facet.label}</legend>
                  {entries.map(([id, name]) => {
                    const count = counts.get(id) ?? 0;
                    const checked = selected[facet.key]?.has(id) ?? false;
                    return (
                      <label
                        key={id}
                        className="bow-simlib__opt"
                        style={count === 0 && !checked ? { opacity: 0.45 } : undefined}
                      >
                        <input type="checkbox" checked={checked} onChange={() => toggle(facet.key, id)} />
                        <span>{name}</span>
                        <span className="bow-simlib__opt-n">{count}</span>
                      </label>
                    );
                  })}
                </fieldset>
              );
            })}

            <button type="button" className="bow-simlib__clear" onClick={clearAll}>
              Clear all filters
            </button>
          </div>
        </form>

        <div>
          <p className="bow-simlib__count" role="status" aria-live="polite">
            {shown.length === simulations.length
              ? `${simulations.length} simulations`
              : `${shown.length} of ${simulations.length} simulations`}
          </p>

          {shown.length > 0 ? (
            <div className="bow-simlib__grid">
              {shown.map((sim) => (
                <SimulationCard key={sim.id} sim={sim} />
              ))}
            </div>
          ) : (
            <div className="bow-simlib__empty">
              <h3 className="bow-headline" style={{ margin: "0 0 10px" }}>Nothing matches that</h3>
              <p style={{ margin: "0 auto 20px", maxWidth: "44ch", color: "var(--bow-slate)" }}>
                {normalizedQuery && !anyFacetSelected
                  ? `Nothing here matches “${query.trim()}”. Try a shorter word, or a concept like “salary cap” or “opportunity cost”.`
                  : normalizedQuery
                    ? `Nothing matches “${query.trim()}” together with the filters you have selected. Try clearing one.`
                    : "No simulation matches every filter you have selected. Try removing one — grade band and duration are the two most likely to be missing from a record."}
              </p>
              <Button variant="secondary" size="sm" onClick={clearAll}>Clear all filters</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SimulationCard({ sim }: { sim: LibrarySimulation }) {
  const playable = sim.availability === "available" && Boolean(sim.playUrl);
  const meta: [string, string | null][] = [
    ["Audience", sim.gradeLabel ?? sim.track?.name ?? null],
    ["Time", sim.durationLabel],
    ["Instructor", sim.instructorNeed],
    [
      "Format",
      [sim.format.setting[0]?.name, sim.format.grouping.map((g) => g.name).join(", ")]
        .filter(Boolean).join(" · ") || null,
    ],
    ["Practises", sim.concepts.slice(0, 3).map((c) => c.name).join(", ") || null],
  ];

  return (
    <article className="bow-simlib__card">
      <div className="bow-simlib__card-top">
        <p className="bow-simlib__card-track">{sim.track ? sim.track.name : sim.subject.name}</p>
        <span className={`bow-simlib__badge bow-simlib__badge--${playable ? "beta" : "wip"}`}>
          {playable ? "Beta" : "In development"}
        </span>
      </div>

      <h3 className="bow-simlib__card-title">{sim.title}</h3>
      <p className="bow-simlib__card-summary">{sim.summary}</p>

      <p className="bow-simlib__card-do">
        <b>What students do</b>
        {sim.whatStudentsDo}
      </p>

      <ul className="bow-simlib__meta">
        {meta.filter(([, v]) => Boolean(v)).map(([k, v]) => (
          <li key={k}>
            <span className="bow-simlib__meta-k">{k}</span>
            <span>{v}</span>
          </li>
        ))}
      </ul>

      {sim.contexts.length > 0 && (
        <div className="bow-simlib__chips">
          {sim.contexts.map((c) => (
            <span key={c.id} className="bow-simlib__chip">{c.name}</span>
          ))}
        </div>
      )}

      <div className="bow-simlib__actions">
        {playable ? (
          <a
            className="bow-button bow-button-ink bow-button-sm"
            href={sim.playUrl!}
            target="_blank"
            rel="noopener"
            aria-label={`Launch ${sim.title} (opens in a new tab)`}
          >
            Launch
          </a>
        ) : (
          /* Deliberately not a disabled button. A greyed-out control still reads
             as a promise; plain text does not. */
          <span className="bow-simlib__not-open">Not open yet</span>
        )}
        {sim.educatorResources.map((r) => (
          <a
            key={r.url}
            className="bow-button bow-button-secondary bow-button-sm"
            href={r.url}
            target="_blank"
            rel="noopener"
          >
            {r.kind === "facilitator-guide" ? "Teacher guide" : r.label}
          </a>
        ))}
      </div>
    </article>
  );
}
