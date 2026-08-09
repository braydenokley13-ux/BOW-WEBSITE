"use client";

import { useState, useTransition } from "react";
import { Badge, Button } from "@/components/ds";
import { SmallButton } from "@/components/admin/website/Fields";
import {
  archivePublicationAction,
  movePublicationAction,
  savePublicationAction,
  type ActionResult,
} from "@/app/actions/website";
import type { AdminPublication, PublicationInput } from "@/lib/cms/admin";
import type { PublicationStatus } from "@/lib/cms/status";

const EMPTY: PublicationInput = {
  name: "",
  logoUrl: "",
  articleTitle: "",
  articleUrl: "",
  publicationDate: "",
  status: "draft",
};

export default function PublicationManager({ publications }: { publications: AdminPublication[] }) {
  const [editing, setEditing] = useState<PublicationInput | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const call = (operation: () => Promise<ActionResult>, success: string, close = false) => {
    startTransition(async () => {
      const result = await operation();
      setNotice(result.ok ? result.message ?? success : result.error);
      if (result.ok && close) setEditing(null);
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div
        style={{
          padding: "14px 16px",
          border: "1px solid var(--border-rule)",
          background: "var(--bow-paper)",
          fontFamily: "var(--font-interface)",
          fontSize: 14,
          lineHeight: 1.55,
        }}
      >
        Three complete, independently verified publication records are loaded. BOW reports seven publications in total.
        Add the remaining four only when you have each outlet name and article link. Blank or draft records never appear publicly.
      </div>

      {notice ? (
        <p role="status" style={{ margin: 0, padding: "10px 12px", border: "1px solid var(--border-rule)", background: "var(--bow-white)", fontFamily: "var(--font-interface)", fontSize: 14 }}>
          {notice}
        </p>
      ) : null}

      <div>
        <Button onClick={() => setEditing({ ...EMPTY })} variant="secondary" size="sm" disabled={pending}>
          Add press coverage
        </Button>
      </div>

      {editing ? (
        <PublicationForm
          key={editing.id ?? "new"}
          value={editing}
          pending={pending}
          onCancel={() => setEditing(null)}
          onSave={(value) => call(() => savePublicationAction(value), "Press coverage saved.", true)}
        />
      ) : null}

      {publications.length === 0 ? (
        <p style={{ fontFamily: "var(--font-interface)", fontSize: 15, color: "var(--text-secondary)" }}>
          No press coverage has been added yet.
        </p>
      ) : (
        <div style={{ border: "1px solid var(--border-rule)", background: "var(--bow-white)" }}>
          {publications.map((publication, index) => (
            <div key={publication.id} style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-rule)", display: "flex", gap: 14, justifyContent: "space-between", flexWrap: "wrap" }}>
              <div style={{ minWidth: 0, flex: "1 1 360px" }}>
                <strong style={{ fontFamily: "var(--font-editorial)", fontSize: 17 }}>{publication.name}</strong>
                <p style={{ margin: "4px 0 7px", fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--text-secondary)" }}>
                  {publication.articleTitle}
                </p>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <Badge status={publication.status === "published" ? "positive" : publication.status === "archived" ? "neutral" : "warning"}>
                    {publication.status === "published" ? "Published" : publication.status === "archived" ? "Archived" : "Draft"}
                  </Badge>
                  <span className="bow-data" style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>
                    {publication.publicationDate || "Date not added"}{publication.logoUrl ? " · Logo added" : " · Text name used"}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <SmallButton onClick={() => call(() => movePublicationAction(publication.id, "up"), "Order updated.")} disabled={pending || index === 0} label="Move up">↑</SmallButton>
                <SmallButton onClick={() => call(() => movePublicationAction(publication.id, "down"), "Order updated.")} disabled={pending || index === publications.length - 1} label="Move down">↓</SmallButton>
                <SmallButton onClick={() => setEditing({ ...publication })} disabled={pending} label="Edit press coverage">Edit</SmallButton>
                {publication.status !== "archived" ? (
                  <SmallButton
                    onClick={() => {
                      if (window.confirm(`Archive the ${publication.name} press record? It will stop appearing publicly.`)) {
                        call(() => archivePublicationAction(publication.id), "Press record archived.");
                      }
                    }}
                    disabled={pending}
                    label="Archive press coverage"
                    tone="danger"
                  >
                    Archive
                  </SmallButton>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PublicationForm({
  value: initialValue,
  pending,
  onCancel,
  onSave,
}: {
  value: PublicationInput;
  pending: boolean;
  onCancel: () => void;
  onSave: (value: PublicationInput) => void;
}) {
  const [value, setValue] = useState(initialValue);
  const set = (patch: Partial<PublicationInput>) => setValue((current) => ({ ...current, ...patch }));

  return (
    <section style={{ padding: "18px 20px", border: "1px solid var(--border-rule)", background: "var(--bow-white)" }}>
      <div className="website-editor-field-grid">
        <label>
          <span style={labelStyle}>Publication name</span>
          <input value={value.name} onChange={(event) => set({ name: event.target.value })} placeholder="Publication name" style={controlStyle} />
        </label>
        <label>
          <span style={labelStyle}>Publication date</span>
          <input type="date" value={value.publicationDate} onChange={(event) => set({ publicationDate: event.target.value })} style={controlStyle} />
        </label>
      </div>
      <label style={{ display: "block", marginTop: 14 }}>
        <span style={labelStyle}>Article title</span>
        <input value={value.articleTitle} onChange={(event) => set({ articleTitle: event.target.value })} style={controlStyle} />
      </label>
      <label style={{ display: "block", marginTop: 14 }}>
        <span style={labelStyle}>Article link</span>
        <input type="url" inputMode="url" value={value.articleUrl} onChange={(event) => set({ articleUrl: event.target.value })} placeholder="https://publication.com/article" style={controlStyle} />
      </label>
      <label style={{ display: "block", marginTop: 14 }}>
        <span style={labelStyle}>Logo image link</span>
        <input inputMode="url" value={value.logoUrl} onChange={(event) => set({ logoUrl: event.target.value })} placeholder="Optional. The publication name is shown when blank." style={controlStyle} />
      </label>
      <label style={{ display: "block", marginTop: 14, maxWidth: 280 }}>
        <span style={labelStyle}>Status</span>
        <select value={value.status} onChange={(event) => set({ status: event.target.value as PublicationStatus })} style={controlStyle}>
          <option value="draft">Draft, not public</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
      </label>
      <p style={{ margin: "10px 0 14px", fontFamily: "var(--font-interface)", fontSize: 12.5, color: "var(--text-secondary)" }}>
        A published record needs the real outlet name, article title, and complete article link. The logo is optional.
      </p>
      <div style={{ display: "flex", gap: 10 }}>
        <Button onClick={() => onSave(value)} variant="primary" size="sm" disabled={pending}>Save</Button>
        <Button onClick={onCancel} variant="secondary" size="sm" disabled={pending}>Cancel</Button>
      </div>
    </section>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 6,
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontSize: 11,
  letterSpacing: "0.09em",
  textTransform: "uppercase",
  color: "var(--text-secondary)",
};

const controlStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  border: "1px solid var(--border-rule)",
  borderRadius: "var(--radius-control)",
  background: "var(--bow-white)",
  fontFamily: "var(--font-interface)",
  fontSize: 14.5,
  lineHeight: 1.5,
};
