"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { searchPeopleAction } from "@/app/actions/people-search";
import type { PersonSearchResult } from "@/lib/people-directory";

/**
 * Portal top bar with a working universal people search (Stage 3). Wires
 * into `searchPeopleAction` (staff-only server action over
 * `lib/people-directory.ts`) — typing opens a typeahead list of people
 * across every role table; selecting one (or pressing Enter) navigates to
 * their canonical person record. Silently renders no results for non-staff
 * roles rather than gating the markup itself.
 */
export default function PortalTopBar({ title }: { title: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PersonSearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const router = useRouter();

  useEffect(() => {
    if (!query.trim()) {
      return;
    }
    const handle = setTimeout(() => {
      startTransition(async () => {
        const rows = await searchPeopleAction(query);
        setResults(rows);
        setActiveIndex(-1);
      });
    }, 150);
    return () => clearTimeout(handle);
  }, [query]);

  const visibleResults = query.trim() ? results : [];

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocumentClick);
    return () => document.removeEventListener("mousedown", onDocumentClick);
  }, []);

  function goTo(personId: string) {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(`/app/people/${personId}`);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!visibleResults.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % visibleResults.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? visibleResults.length - 1 : index - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const target = visibleResults[activeIndex] ?? visibleResults[0];
      if (target) goTo(target.personId);
    }
  }

  return (
    <div className="bow-portal-topbar">
      <span className="bow-portal-topbar__title">{title}</span>
      <div className="bow-portal-topbar__utility">
        <div className="bow-portal-search" ref={containerRef} role="combobox" aria-expanded={open} aria-haspopup="listbox" aria-owns={listId} aria-controls={listId}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <circle cx="7" cy="7" r="4.5" />
            <path d="M13.5 13.5 10.5 10.5" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="bow-portal-search__input"
            placeholder="Search people…"
            aria-label="Search people by name or email"
            aria-autocomplete="list"
            aria-controls={listId}
            aria-activedescendant={activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined}
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onKeyDown={onKeyDown}
          />
          {open && query.trim() && (
            <ul className="bow-portal-search__results" id={listId} role="listbox">
              {isPending && visibleResults.length === 0 && (
                <li className="bow-portal-search__empty" aria-live="polite">Searching…</li>
              )}
              {!isPending && visibleResults.length === 0 && (
                <li className="bow-portal-search__empty">No people match &ldquo;{query}&rdquo;.</li>
              )}
              {visibleResults.map((person, index) => (
                <li
                  key={person.personId}
                  id={`${listId}-option-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  className={"bow-portal-search__result" + (index === activeIndex ? " bow-portal-search__result--active" : "")}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    goTo(person.personId);
                  }}
                >
                  <span className="bow-portal-search__name">{person.name}</span>
                  <span className="bow-portal-search__meta">
                    {person.email ?? "No email"}
                    {person.roles.length > 0 ? ` · ${person.roles.map((role) => role.label).join(", ")}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
