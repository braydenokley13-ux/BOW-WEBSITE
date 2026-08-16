"use client";

import { useMemo, useState, useId } from "react";
import type { SimulationCard } from "@/lib/simulations-catalog";

/**
 * The public simulation library.
 *
 * Everything BOW has built that a stranger can actually open, in one place.
 * The design problem here is not decoration — it is that 49 cards is more than
 * anyone will read, so the page has to answer "which one should I run on
 * Tuesday?" before it answers "what exists?".
 *
 * That produces three rules the layout follows:
 *
 *   - Flagships are lifted out above the grid, because a teacher arriving cold
 *     needs a shortlist, not a catalogue.
 *   - Every card states role, concept, grade, duration and status without a
 *     click, because those are the five things that decide whether a
 *     simulation fits a class period.
 *   - Filters narrow, never mislead: each option carries its own result count
 *     drawn from the data, so no filter combination leads to an empty grid by
 *     surprise, and the live region announces the count on every change.
 */

type Filters = {
  q: string;
  track: string;
  grade: string;
  duration: string;
  instructor: string;
  availability: string;
};

const EMPTY: Filters = { q: "", track: "", grade: "", duration: "", instructor: "", availability: "" };

const TIER_COPY: Record<string, { label: string; blurb: string; color: string; tint: string }> = {
  flagship: {
    label: "Flagship",
    blurb: "Start here — the strongest decisions and the clearest payoff.",
    color: "var(--bow-orange-solid)",
    tint: "var(--bow-orange-tint)",
  },
  recommended: {
    label: "Recommended",
    blurb: "Solid and classroom-ready.",
    color: "var(--bow-blue)",
    tint: "var(--bow-blue-tint)",
  },
  experimental: {
    label: "Experimental",
    blurb: "Interesting, but rough in places — try it before you teach it.",
    color: "var(--bow-warning-text)",
    tint: "var(--bow-warning-tint)",
  },
};

function matches(sim: SimulationCard, f: Filters): boolean {
  if (f.track && sim.track?.name !== f.track) return false;
  if (f.grade && sim.gradeLabel !== f.grade) return false;
  if (f.duration && sim.durationLabel !== f.duration) return false;
  if (f.instructor && sim.instructorNeed !== f.instructor) return false;
  if (f.availability && sim.availability !== f.availability) return false;
  if (f.q) {
    const needle = f.q.toLowerCase();
    const hay = [
      sim.title,
      sim.summary,
      sim.whatStudentsDo,
      sim.track?.name ?? "",
      ...sim.concepts.map((c) => c.name),
    ]
      .join(" ")
      .toLowerCase();
    if (!hay.includes(needle)) return false;
  }
  return true;
}

/** Options for one facet, counted against everything the OTHER filters allow. */
function optionsFor(
  all: SimulationCard[],
  filters: Filters,
  key: keyof Filters,
  pick: (s: SimulationCard) => string | null | undefined,
) {
  const withoutSelf = { ...filters, [key]: "" } as Filters;
  const pool = all.filter((s) => matches(s, withoutSelf));
  const counts = new Map<string, number>();
  for (const sim of pool) {
    const value = pick(sim);
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
}

export default function SimulationLibraryView({
  simulations,
  labelMeaning,
}: {
  simulations: SimulationCard[];
  labelMeaning: string;
}) {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const searchId = useId();

  const set = (key: keyof Filters, value: string) => setFilters((f) => ({ ...f, [key]: value }));
  const active = Object.values(filters).some(Boolean);

  const shown = useMemo(() => simulations.filter((s) => matches(s, filters)), [simulations, filters]);
  const flagships = useMemo(
    () => simulations.filter((s) => s.tier === "flagship" && s.availability === "available"),
    [simulations],
  );

  const facets = useMemo(
    () => ({
      track: optionsFor(simulations, filters, "track", (s) => s.track?.name),
      grade: optionsFor(simulations, filters, "grade", (s) => s.gradeLabel),
      duration: optionsFor(simulations, filters, "duration", (s) => s.durationLabel),
      instructor: optionsFor(simulations, filters, "instructor", (s) => s.instructorNeed),
    }),
    [simulations, filters],
  );

  const playable = simulations.filter((s) => s.availability === "available").length;

  return (
    <div>
      {/* ---------------------------------------------------------------- */}
      {/* FLAGSHIPS — the shortlist, shown only when the grid is unfiltered  */}
      {/* so it never competes with a search the visitor is actively doing. */}
      {/* ---------------------------------------------------------------- */}
      {flagships.length > 0 && !active ? (
        <section aria-labelledby="flagship-heading" style={{ marginBottom: 56 }}>
          <h2
            id="flagship-heading"
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 12,
              letterSpacing: "0.09em",
              textTransform: "uppercase",
              color: "var(--bow-slate)",
              margin: "0 0 6px",
            }}
          >
            Start here
          </h2>
          <p style={{ margin: "0 0 20px", color: "var(--bow-slate)", fontSize: 15, maxWidth: "62ch" }}>
            {flagships.length} simulations we would put in front of a class first — chosen for the
            strength of the decision students face, not for how polished they look.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
              gap: 16,
            }}
          >
            {flagships.map((sim) => (
              <Card key={sim.id} sim={sim} featured />
            ))}
          </div>
        </section>
      ) : null}

      {/* ---------------------------------------------------------------- */}
      {/* FILTERS                                                           */}
      {/* ---------------------------------------------------------------- */}
      <section aria-labelledby="filter-heading" style={{ marginBottom: 28 }}>
        <h2 id="filter-heading" className="bow-sr-only">
          Filter simulations
        </h2>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 260px", minWidth: 0 }}>
            <Label htmlFor={searchId}>Search</Label>
            <input
              id={searchId}
              type="search"
              value={filters.q}
              onChange={(e) => set("q", e.target.value)}
              placeholder="Salary cap, scarcity, draft…"
              style={{
                width: "100%",
                padding: "11px 14px",
                fontSize: 16, // 16px prevents iOS zoom-on-focus
                fontFamily: "inherit",
                color: "var(--text-primary)",
                background: "var(--surface-raised)",
                border: "1px solid var(--border-rule)",
                borderRadius: 8,
              }}
            />
          </div>

          <Select label="Track" value={filters.track} onChange={(v) => set("track", v)} options={facets.track} allLabel="All tracks" />
          <Select label="Grade" value={filters.grade} onChange={(v) => set("grade", v)} options={facets.grade} allLabel="Any grade" />
          <Select label="Length" value={filters.duration} onChange={(v) => set("duration", v)} options={facets.duration} allLabel="Any length" />
          <Select
            label="Setup"
            value={filters.instructor}
            onChange={(v) => set("instructor", v)}
            options={facets.instructor}
            allLabel="Any setup"
          />
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 14 }}>
          <Chip
            active={filters.availability === ""}
            onClick={() => set("availability", "")}
            label={`Everything (${simulations.length})`}
          />
          <Chip
            active={filters.availability === "available"}
            onClick={() => set("availability", "available")}
            label={`Playable now (${playable})`}
          />
          <Chip
            active={filters.availability === "in-development"}
            onClick={() => set("availability", "in-development")}
            label={`In development (${simulations.length - playable})`}
          />
          {active ? (
            <button
              type="button"
              onClick={() => setFilters(EMPTY)}
              style={{
                marginLeft: "auto",
                background: "none",
                border: "none",
                padding: "8px 4px",
                minHeight: 44,
                color: "var(--text-link)",
                fontFamily: "inherit",
                fontSize: 14,
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Clear filters
            </button>
          ) : null}
        </div>

        <p
          aria-live="polite"
          style={{
            margin: "16px 0 0",
            fontFamily: "var(--font-data)",
            fontSize: 12.5,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: "var(--bow-slate)",
          }}
        >
          {shown.length === simulations.length
            ? `${simulations.length} simulations`
            : `${shown.length} of ${simulations.length} simulations`}
        </p>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* GRID                                                              */}
      {/* ---------------------------------------------------------------- */}
      {shown.length === 0 ? (
        <p
          style={{
            padding: "40px 24px",
            textAlign: "center",
            border: "1px dashed var(--border-rule)",
            borderRadius: 12,
            color: "var(--bow-slate)",
          }}
        >
          Nothing matches those filters yet.{" "}
          <button
            type="button"
            onClick={() => setFilters(EMPTY)}
            style={{ background: "none", border: "none", padding: 0, color: "var(--text-link)", font: "inherit", cursor: "pointer", textDecoration: "underline" }}
          >
            Clear them
          </button>{" "}
          to see all {simulations.length}.
        </p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))",
            gap: 16,
          }}
        >
          {shown.map((sim) => (
            <li key={sim.id} style={{ display: "flex" }}>
              <Card sim={sim} />
            </li>
          ))}
        </ul>
      )}

      <p style={{ marginTop: 40, fontSize: 13.5, color: "var(--bow-slate)", maxWidth: "70ch" }}>
        <strong style={{ color: "var(--text-primary)" }}>Beta</strong> — {labelMeaning} Tier labels
        are BOW&rsquo;s editorial view of where to start, not a claim that a simulation has been
        studied in a classroom.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      style={{
        display: "block",
        marginBottom: 5,
        fontFamily: "var(--font-data)",
        fontSize: 11,
        letterSpacing: "0.07em",
        textTransform: "uppercase",
        color: "var(--bow-slate)",
      }}
    >
      {children}
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, number][];
  allLabel: string;
}) {
  const id = useId();
  return (
    <div style={{ flex: "0 1 auto", minWidth: 150 }}>
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "11px 12px",
          fontSize: 16,
          fontFamily: "inherit",
          color: "var(--text-primary)",
          background: "var(--surface-raised)",
          border: "1px solid var(--border-rule)",
          borderRadius: 8,
        }}
      >
        <option value="">{allLabel}</option>
        {options.map(([opt, count]) => (
          <option key={opt} value={opt}>
            {opt} ({count})
          </option>
        ))}
      </select>
    </div>
  );
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      style={{
        fontFamily: "var(--font-data)",
        fontSize: 12,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        padding: "10px 16px",
        minHeight: 44, // touch target
        borderRadius: 999,
        cursor: "pointer",
        border: `1px solid ${active ? "var(--bow-ink)" : "var(--border-rule)"}`,
        background: active ? "var(--bow-ink)" : "transparent",
        color: active ? "var(--bow-on-ink)" : "var(--text-primary)",
      }}
    >
      {label}
    </button>
  );
}

function Card({ sim, featured = false }: { sim: SimulationCard; featured?: boolean }) {
  const tier = sim.tier ? TIER_COPY[sim.tier] : null;
  const playable = sim.availability === "available" && sim.playUrl;

  const meta = [sim.gradeLabel, sim.durationLabel, sim.instructorNeed].filter(Boolean) as string[];

  return (
    <article
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        background: "var(--surface-raised)",
        border: `1px solid ${featured ? "var(--border-strong)" : "var(--border-rule)"}`,
        borderRadius: 12,
        padding: "20px 20px 18px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        {tier ? (
          <span
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 10.5,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              padding: "4px 9px",
              borderRadius: 4,
              background: tier.tint,
              color: tier.color,
              fontWeight: 600,
            }}
          >
            {tier.label}
          </span>
        ) : null}
        {sim.track?.name ? (
          <span
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 10.5,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--bow-slate)",
            }}
          >
            {sim.track.name}
          </span>
        ) : null}
        {!playable ? (
          <span
            style={{
              marginLeft: "auto",
              fontFamily: "var(--font-data)",
              fontSize: 10.5,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--bow-slate)",
            }}
          >
            In development
          </span>
        ) : null}
      </div>

      <h3 style={{ margin: "0 0 8px", fontSize: featured ? 21 : 19, lineHeight: 1.25, color: "var(--text-primary)" }}>
        {sim.title}
      </h3>

      <p style={{ margin: "0 0 14px", fontSize: 14.5, lineHeight: 1.55, color: "var(--bow-slate)" }}>
        {sim.summary}
      </p>

      {meta.length ? (
        <p
          style={{
            margin: "0 0 14px",
            fontFamily: "var(--font-data)",
            fontSize: 11.5,
            letterSpacing: "0.04em",
            color: "var(--bow-slate)",
          }}
        >
          {meta.join(" · ")}
        </p>
      ) : null}

      {sim.concepts.length ? (
        <ul style={{ listStyle: "none", display: "flex", flexWrap: "wrap", gap: 6, margin: "0 0 18px", padding: 0 }}>
          {sim.concepts.slice(0, 3).map((c) => (
            <li
              key={c.id}
              style={{
                fontSize: 11.5,
                padding: "3px 8px",
                borderRadius: 4,
                background: "var(--bow-paper)",
                color: "var(--bow-slate)",
              }}
            >
              {c.name}
            </li>
          ))}
        </ul>
      ) : null}

      <div style={{ marginTop: "auto" }}>
        {playable ? (
          // The title lives in the aria-label, not on the button face. Put it
          // on the face and a long name wraps the button onto three lines and
          // shoves the arrow to the far edge; drop it entirely and a screen
          // reader announces "Play" forty-one times with no way to tell the
          // links apart. This keeps the row uniform and every link distinct,
          // and it matches what the standalone library already does.
          <a
            href={sim.playUrl as string}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Play ${sim.title} (opens in a new tab)`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              minHeight: 44,
              padding: "0 24px",
              borderRadius: 8,
              background: "var(--bow-ink)",
              color: "var(--bow-on-ink)",
              fontFamily: "var(--font-data)",
              fontSize: 12.5,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Play
            <span aria-hidden="true">→</span>
          </a>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: "var(--bow-slate)", fontStyle: "italic" }}>
            Being built — no link yet.
          </p>
        )}
      </div>
    </article>
  );
}
