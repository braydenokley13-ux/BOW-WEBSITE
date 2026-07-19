"use client";

import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import {
  searchGrowthEntities,
  type GrowthSearchKind,
} from "@/app/actions/growth";
import type { GrowthOption } from "@/lib/growth";

interface Props {
  id: string;
  name: string;
  kind: GrowthSearchKind;
  placeholder: string;
  required?: boolean;
}

export default function GrowthEntityPicker({
  id,
  name,
  kind,
  placeholder,
  required = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const requestSequence = useRef(0);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<GrowthOption | null>(null);
  const [results, setResults] = useState<GrowthOption[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listboxId = `${id}-results`;

  useEffect(() => {
    inputRef.current?.setCustomValidity(required && !selected ? "Choose one record from the search results." : "");
  }, [required, selected]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    document.getElementById(`${listboxId}-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, listboxId, open]);

  useEffect(() => {
    if (!open || selected) return;
    if (query.trim().length < 2) return;
    const sequence = ++requestSequence.current;
    const timeout = window.setTimeout(() => {
      void searchGrowthEntities({ kind, query }).then((response) => {
        if (requestSequence.current !== sequence) return;
        setLoading(false);
        if (!response.ok) {
          setResults([]);
          setActiveIndex(-1);
          setError(response.error ?? "Search is unavailable.");
          return;
        }
        setResults(response.options);
        setActiveIndex(response.options.length > 0 ? 0 : -1);
      }).catch(() => {
        if (requestSequence.current !== sequence) return;
        setLoading(false);
        setResults([]);
        setActiveIndex(-1);
        setError("Search is unavailable. Try again.");
      });
    }, 180);
    return () => {
      window.clearTimeout(timeout);
      if (requestSequence.current === sequence) requestSequence.current += 1;
    };
  }, [kind, open, query, selected]);

  const choose = (option: GrowthOption) => {
    requestSequence.current += 1;
    setSelected(option);
    setQuery(option.label);
    setResults([]);
    setActiveIndex(-1);
    setOpen(false);
    setLoading(false);
    setError(null);
    inputRef.current?.setCustomValidity("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      requestSequence.current += 1;
      setOpen(false);
      setLoading(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => results.length === 0 ? -1 : index >= results.length - 1 ? 0 : index + 1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => results.length === 0 ? -1 : index <= 0 ? results.length - 1 : index - 1);
      return;
    }
    if (event.key === "Enter" && open && activeIndex >= 0 && results[activeIndex]) {
      event.preventDefault();
      choose(results[activeIndex]);
    }
  };

  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget;
    if (!(next instanceof Node) || !event.currentTarget.contains(next)) setOpen(false);
  };

  return (
    <div className="ops-entity-picker" onBlur={onBlur}>
      <input type="hidden" name={name} value={selected?.id ?? ""} />
      <input
        ref={inputRef}
        id={id}
        type="search"
        role="combobox"
        autoComplete="off"
        required={required}
        placeholder={placeholder}
        value={query}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open && results.length > 0 ? listboxId : undefined}
        aria-busy={open && loading}
        aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
        onFocus={() => {
          setOpen(true);
          if (!selected) setLoading(query.trim().length >= 2);
        }}
        onChange={(event) => {
          const nextQuery = event.target.value;
          requestSequence.current += 1;
          setSelected(null);
          setQuery(nextQuery);
          setResults([]);
          setActiveIndex(-1);
          setOpen(true);
          setLoading(nextQuery.trim().length >= 2);
          setError(null);
        }}
        onKeyDown={onKeyDown}
      />
      {open && !selected && (
        <div className="ops-entity-picker__menu">
          {loading && <span className="ops-entity-picker__status" role="status">Searching…</span>}
          {!loading && error && <span className="ops-entity-picker__status ops-entity-picker__status--error" role="alert">{error}</span>}
          {!loading && !error && results.length === 0 && (
            <span className="ops-entity-picker__status" role="status">
              {query.trim().length < 2 ? "Type at least 2 characters to search." : "No matching record. Try another search."}
            </span>
          )}
          {!loading && !error && results.length > 0 && (
            <div id={listboxId} role="listbox" aria-label={`${placeholder} results`}>
              {results.map((option, index) => (
                <button
                  key={option.id}
                  id={`${listboxId}-${index}`}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  className="ops-entity-picker__option"
                  data-active={index === activeIndex ? "true" : undefined}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(option)}
                >
                  <strong>{option.label}</strong>
                  {option.meta && <span>{option.meta.replace(/_/g, " ")}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
