"use client";

import { useId } from "react";
import type { FieldSpec } from "@/lib/cms/fields";

/* ============================================================
 * Field inputs for the website editor.
 *
 * These are the controls a founder actually touches. Everything is a labelled
 * form field with plain-English help text — there is no JSON textarea, no key
 * name, and no place to type a CSS value. A repeater renders as "Add another
 * card / Remove", not as an array editor.
 *
 * State lives in the parent as one plain object; each control gets its current
 * value and a setter. Keeping it uncontrolled-free means the Save button can
 * always send exactly what is on screen.
 * ============================================================ */

type Value = unknown;
type Setter = (next: Value) => void;

const labelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontSize: 11,
  letterSpacing: "0.09em",
  textTransform: "uppercase",
  color: "var(--text-secondary)",
  marginBottom: 6,
};

const helpStyle: React.CSSProperties = {
  margin: "6px 0 0",
  fontFamily: "var(--font-interface)",
  fontSize: 12.5,
  lineHeight: 1.45,
  color: "var(--text-secondary)",
};

const controlStyle: React.CSSProperties = {
  width: "100%",
  fontFamily: "var(--font-interface)",
  fontSize: 14.5,
  lineHeight: 1.5,
  padding: "9px 11px",
  border: "1px solid var(--border-rule)",
  borderRadius: "var(--radius-control)",
  background: "var(--bow-white)",
  color: "var(--text-primary)",
};

function asString(value: Value): string {
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value : String(value);
}

function asArray(value: Value): Record<string, unknown>[] {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

export function Field({ spec, value, onChange }: { spec: FieldSpec; value: Value; onChange: Setter }) {
  const inputId = useId();

  if (spec.type === "repeater") {
    return <Repeater spec={spec} value={value} onChange={onChange} />;
  }

  const shared = { id: inputId, style: controlStyle, placeholder: spec.placeholder };

  return (
    <div style={{ marginBottom: 18 }}>
      <label htmlFor={inputId} style={labelStyle}>{spec.label}</label>
      {spec.type === "boolean" ? (
        <label style={{ display: "flex", alignItems: "center", gap: 9, fontFamily: "var(--font-interface)", fontSize: 14.5 }}>
          <input
            id={inputId}
            type="checkbox"
            checked={value === true}
            onChange={(event) => onChange(event.target.checked)}
            style={{ width: 17, height: 17 }}
          />
          <span>{spec.help ?? "Yes"}</span>
        </label>
      ) : spec.type === "select" ? (
        <select {...shared} value={asString(value)} onChange={(event) => onChange(event.target.value)}>
          {(spec.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      ) : spec.type === "number" ? (
        <input
          {...shared}
          type="number"
          value={asString(value)}
          onChange={(event) => onChange(event.target.value === "" ? 0 : Number(event.target.value))}
        />
      ) : spec.type === "textarea" || spec.type === "richtext" ? (
        <textarea
          {...shared}
          rows={spec.type === "richtext" ? 6 : 3}
          value={asString(value)}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : spec.type === "strings" ? (
        <textarea
          {...shared}
          rows={5}
          value={(Array.isArray(value) ? (value as string[]) : []).join("\n")}
          onChange={(event) => onChange(event.target.value.split("\n").map((line) => line.trim()).filter(Boolean))}
        />
      ) : spec.type === "url" ? (
        <input
          {...shared}
          type="text"
          inputMode="url"
          autoCapitalize="none"
          spellCheck={false}
          value={asString(value)}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : spec.type === "image" ? (
        <>
          <input {...shared} type="url" value={asString(value)} onChange={(event) => onChange(event.target.value)} placeholder="https://… or /uploads/photo.jpg" />
          {asString(value) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={asString(value)} alt="" style={{ marginTop: 10, maxWidth: 220, border: "1px solid var(--border-rule)" }} />
          ) : null}
        </>
      ) : (
        <input {...shared} type="text" value={asString(value)} onChange={(event) => onChange(event.target.value)} />
      )}
      {spec.help && spec.type !== "boolean" ? <p style={helpStyle}>{spec.help}</p> : null}
    </div>
  );
}

function Repeater({ spec, value, onChange }: { spec: FieldSpec; value: Value; onChange: Setter }) {
  const rows = asArray(value);
  const noun = spec.itemNoun ?? "item";
  const fields = spec.itemFields ?? [];

  const update = (index: number, next: Record<string, unknown>) => {
    const copy = [...rows];
    copy[index] = next;
    onChange(copy);
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= rows.length) return;
    const copy = [...rows];
    [copy[index], copy[target]] = [copy[target], copy[index]];
    onChange(copy);
  };

  return (
    <fieldset className="bow-repeater" style={{ margin: "0 0 22px", border: "1px solid var(--border-rule)", borderRadius: "var(--radius-control)", background: "var(--bow-paper)" }}>
      <legend style={{ ...labelStyle, marginBottom: 0, padding: "0 6px" }}>{spec.label}</legend>
      {spec.help ? <p style={{ ...helpStyle, marginTop: 0, marginBottom: 10 }}>{spec.help}</p> : null}

      {rows.length === 0 ? (
        <p style={{ ...helpStyle, marginTop: 0 }}>No {noun}s yet.</p>
      ) : null}

      {rows.map((row, index) => (
        <div key={index} className="bow-repeater__row" style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: "var(--radius-control)", marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ ...labelStyle, marginBottom: 0 }}>{noun} {index + 1}</span>
            <span style={{ display: "flex", gap: 6 }}>
              <SmallButton onClick={() => move(index, -1)} disabled={index === 0} label="Move up">↑</SmallButton>
              <SmallButton onClick={() => move(index, 1)} disabled={index === rows.length - 1} label="Move down">↓</SmallButton>
              <SmallButton onClick={() => onChange(rows.filter((_, i) => i !== index))} label={`Remove ${noun}`} tone="danger">Remove</SmallButton>
            </span>
          </div>
          {fields.map((child) => (
            <Field
              key={child.name}
              spec={child}
              value={row[child.name]}
              onChange={(next) => update(index, { ...row, [child.name]: next })}
            />
          ))}
        </div>
      ))}

      <SmallButton
        onClick={() => onChange([...rows, Object.fromEntries(fields.map((field) => [field.name, field.type === "boolean" ? true : field.type === "repeater" ? [] : field.type === "number" ? 0 : ""]))])}
        label={`Add ${noun}`}
      >
        + Add {noun}
      </SmallButton>
    </fieldset>
  );
}

export function SmallButton({
  children,
  onClick,
  disabled = false,
  label,
  tone = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      style={{
        fontFamily: "var(--font-display)",
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        padding: "6px 10px",
        borderRadius: "var(--radius-control)",
        border: `1px solid ${tone === "danger" ? "var(--bow-negative)" : "var(--border-rule)"}`,
        background: "var(--bow-white)",
        color: tone === "danger" ? "var(--bow-negative)" : "var(--text-primary)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {children}
    </button>
  );
}

export function FieldGroup({
  fields,
  data,
  onChange,
}: {
  fields: FieldSpec[];
  data: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  return (
    <>
      {fields.map((field) => (
        <Field
          key={field.name}
          spec={field}
          value={data[field.name]}
          onChange={(next) => onChange({ ...data, [field.name]: next })}
        />
      ))}
    </>
  );
}
