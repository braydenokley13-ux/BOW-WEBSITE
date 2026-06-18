"use client";

import { useRouter } from "next/navigation";
import { useAppState } from "./AppState";
import { roleHomePath, type Role } from "@/lib/account";

const ROLES: { role: Role; label: string }[] = [
  { role: "student", label: "Student" },
  { role: "instructor", label: "Instructor" },
  { role: "admin", label: "Admin" },
];

/** Floating prototype role switcher (stands in for real auth/session). */
export default function RolePreview() {
  const { role, signInAs } = useAppState();
  const router = useRouter();

  return (
    <div style={{ position: "fixed", right: 16, bottom: 16, zIndex: 3500, background: "var(--bow-ink)", border: "1px solid var(--bow-dark-border)", borderRadius: 8, padding: "10px 12px", boxShadow: "0 8px 30px rgba(0,0,0,0.28)", display: "flex", flexDirection: "column", gap: 8, maxWidth: "calc(100vw - 32px)" }}>
      <span style={{ fontFamily: "var(--font-data)", fontSize: 9.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--bow-warning)" }}>● Prototype Role Preview</span>
      <div style={{ display: "flex", gap: 6 }}>
        {ROLES.map((r) => {
          const active = role === r.role;
          return (
            <button
              key={r.role}
              onClick={() => {
                signInAs(r.role);
                router.push(roleHomePath(r.role));
              }}
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 11,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                padding: "6px 11px",
                borderRadius: 4,
                cursor: "pointer",
                background: active ? "var(--bow-blue)" : "transparent",
                color: active ? "#fff" : "#c8cad0",
                border: `1px solid ${active ? "var(--bow-blue)" : "var(--bow-dark-border)"}`,
              }}
            >
              {r.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
