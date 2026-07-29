"use client";

import { useState, useTransition } from "react";
import { Badge, Button } from "@/components/ds";
import { SmallButton } from "@/components/admin/website/Fields";
import { deleteAnnouncementAction, saveAnnouncementAction, type ActionResult } from "@/app/actions/website";
import type { AdminAnnouncement } from "@/lib/cms/admin";
import type { PublicationStatus } from "@/lib/cms/status";

/* ============================================================
 * Announcements.
 *
 * A message with a start and an end. The end date is the point: an expired
 * announcement stops showing on its own, because the public query filters on
 * `now()` rather than on someone remembering to switch it off.
 * ============================================================ */

interface Draft {
  id?: string;
  message: string;
  linkHref: string;
  linkLabel: string;
  startsAt: string;
  endsAt: string;
  placement: "site" | "page";
  pageSlug: string;
  audience: string;
  status: PublicationStatus;
}

const EMPTY: Draft = {
  message: "",
  linkHref: "",
  linkLabel: "",
  startsAt: "",
  endsAt: "",
  placement: "site",
  pageSlug: "",
  audience: "everyone",
  status: "published",
};

const toInput = (value: number | null): string => (value ? new Date(value).toISOString().slice(0, 10) : "");
const toStamp = (value: string): number | null => {
  if (!value) return null;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) ? parsed : null;
};

export default function AnnouncementManager({
  announcements,
  pageOptions,
}: {
  announcements: AdminAnnouncement[];
  pageOptions: { value: string; label: string }[];
}) {
  const [editing, setEditing] = useState<Draft | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const call = (fn: () => Promise<ActionResult>, success: string) => {
    startTransition(async () => {
      const result = await fn();
      setNotice(result.ok ? success : result.error);
      if (result.ok) setEditing(null);
    });
  };

  const save = (draft: Draft) =>
    call(
      () =>
        saveAnnouncementAction({
          id: draft.id,
          message: draft.message,
          linkHref: draft.linkHref,
          linkLabel: draft.linkLabel,
          startsAt: toStamp(draft.startsAt),
          endsAt: toStamp(draft.endsAt),
          placement: draft.placement,
          pageSlug: draft.pageSlug,
          audience: draft.audience,
          status: draft.status,
        }),
      draft.id ? "Announcement updated." : "Announcement added.",
    );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {notice ? (
        <p role="status" style={{ margin: 0, padding: "10px 12px", border: "1px solid var(--border-rule)", borderRadius: "var(--radius-control)", background: "var(--bow-white)", fontFamily: "var(--font-interface)", fontSize: 14.5 }}>
          {notice}
        </p>
      ) : null}

      <div>
        <Button onClick={() => setEditing({ ...EMPTY })} variant="secondary" size="sm" disabled={pending}>
          Add an announcement
        </Button>
      </div>

      {editing ? (
        <Form draft={editing} pageOptions={pageOptions} pending={pending} onSave={save} onCancel={() => setEditing(null)} />
      ) : null}

      {announcements.length === 0 ? (
        <p style={{ fontFamily: "var(--font-interface)", fontSize: 15, color: "var(--text-secondary)" }}>
          No announcements. Add one to show a message bar across the site.
        </p>
      ) : (
        <div style={{ border: "1px solid var(--border-rule)", background: "var(--bow-white)" }}>
          {announcements.map((announcement) => (
            <div key={announcement.id} style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-rule)", display: "flex", gap: 12, justifyContent: "space-between", flexWrap: "wrap" }}>
              <div style={{ minWidth: 0, flex: "1 1 320px" }}>
                <strong style={{ fontFamily: "var(--font-editorial)", fontSize: 16 }}>{announcement.message}</strong>
                <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <Badge status={announcement.isLive ? "positive" : announcement.status === "published" ? "info" : "warning"}>
                    {announcement.isLive ? "Showing now" : announcement.status === "published" ? "Scheduled / expired" : "Draft"}
                  </Badge>
                  <span style={{ fontFamily: "var(--font-data)", fontSize: 11.5, color: "var(--text-secondary)" }}>
                    {announcement.placement === "site" ? "Whole site" : `Only ${announcement.pageSlug}`}
                    {announcement.startsAt ? ` · from ${new Date(announcement.startsAt).toLocaleDateString()}` : ""}
                    {announcement.endsAt ? ` · until ${new Date(announcement.endsAt).toLocaleDateString()}` : " · no end date"}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <SmallButton
                  onClick={() =>
                    setEditing({
                      id: announcement.id,
                      message: announcement.message,
                      linkHref: announcement.linkHref,
                      linkLabel: announcement.linkLabel,
                      startsAt: toInput(announcement.startsAt),
                      endsAt: toInput(announcement.endsAt),
                      placement: announcement.placement,
                      pageSlug: announcement.pageSlug,
                      audience: announcement.audience,
                      status: announcement.status,
                    })
                  }
                  label="Edit announcement"
                >
                  Edit
                </SmallButton>
                <SmallButton onClick={() => call(() => deleteAnnouncementAction(announcement.id), "Announcement deleted.")} disabled={pending} label="Delete" tone="danger">
                  Delete
                </SmallButton>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Form({
  draft,
  pageOptions,
  pending,
  onSave,
  onCancel,
}: {
  draft: Draft;
  pageOptions: { value: string; label: string }[];
  pending: boolean;
  onSave: (draft: Draft) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState<Draft>(draft);
  const set = (patch: Partial<Draft>) => setValue({ ...value, ...patch });

  return (
    <section style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: "var(--radius-control)", padding: "18px 20px" }}>
      <label style={{ display: "block", marginBottom: 14 }}>
        <span style={labelStyle}>Message</span>
        <textarea rows={2} value={value.message} onChange={(event) => set({ message: event.target.value })} style={controlStyle} />
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <label>
          <span style={labelStyle}>Link text</span>
          <input value={value.linkLabel} onChange={(event) => set({ linkLabel: event.target.value })} style={controlStyle} />
        </label>
        <label>
          <span style={labelStyle}>Link goes to</span>
          <input value={value.linkHref} onChange={(event) => set({ linkHref: event.target.value })} placeholder="/programs" style={controlStyle} />
        </label>
        <label>
          <span style={labelStyle}>Starts</span>
          <input type="date" value={value.startsAt} onChange={(event) => set({ startsAt: event.target.value })} style={controlStyle} />
        </label>
        <label>
          <span style={labelStyle}>Ends</span>
          <input type="date" value={value.endsAt} onChange={(event) => set({ endsAt: event.target.value })} style={controlStyle} />
        </label>
        <label>
          <span style={labelStyle}>Where it shows</span>
          <select value={value.placement} onChange={(event) => set({ placement: event.target.value as "site" | "page" })} style={controlStyle}>
            <option value="site">Every page</option>
            <option value="page">One page only</option>
          </select>
        </label>
        {value.placement === "page" ? (
          <label>
            <span style={labelStyle}>Which page</span>
            <select value={value.pageSlug} onChange={(event) => set({ pageSlug: event.target.value })} style={controlStyle}>
              <option value="">Choose a page…</option>
              {pageOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        ) : null}
        <label>
          <span style={labelStyle}>Audience</span>
          <select value={value.audience} onChange={(event) => set({ audience: event.target.value })} style={controlStyle}>
            <option value="everyone">Everyone</option>
            <option value="families">Families</option>
            <option value="schools">Schools</option>
            <option value="instructors">Instructors</option>
          </select>
        </label>
        <label>
          <span style={labelStyle}>Status</span>
          <select value={value.status} onChange={(event) => set({ status: event.target.value as PublicationStatus })} style={controlStyle}>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </label>
      </div>
      <p style={{ margin: "12px 0 14px", fontFamily: "var(--font-interface)", fontSize: 12.5, color: "var(--text-secondary)" }}>
        Leave the end date blank to run it until you turn it off. Once the end date passes, it stops showing on its own.
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
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontSize: 11,
  letterSpacing: "0.09em",
  textTransform: "uppercase",
  color: "var(--text-secondary)",
  marginBottom: 6,
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
};
