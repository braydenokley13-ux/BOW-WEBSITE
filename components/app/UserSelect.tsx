"use client";

import type { CSSProperties } from "react";

const selectStyle: CSSProperties = {
  background: "var(--bow-paper)",
  border: "1px solid var(--border-rule)",
  color: "var(--bow-ink)",
  padding: "10px 12px",
  fontFamily: "var(--font-interface)",
  fontSize: 14,
  width: "100%",
  borderRadius: 4,
};

interface UserSelectProps {
  users: { id: string; name: string }[];
  value: string;
  onChange: (id: string) => void;
  allowUnassigned?: boolean;
  style?: CSSProperties;
  id?: string;
  "aria-label"?: string;
}

/**
 * Client select of staff users by name — replaces raw-user-id text
 * inputs. The caller fetches the user list server-side (lib/hiring
 * listStaffUsers) and passes it down as props.
 */
export default function UserSelect({ users, value, onChange, allowUnassigned = true, style, id, "aria-label": ariaLabel }: UserSelectProps) {
  return (
    <select className="bow-field" id={id} aria-label={ariaLabel} style={{ ...selectStyle, ...style }} value={value} onChange={(e) => onChange(e.target.value)}>
      {allowUnassigned && <option value="">Unassigned</option>}
      {users.map((u) => (
        <option key={u.id} value={u.id}>
          {u.name}
        </option>
      ))}
    </select>
  );
}
