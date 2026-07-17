"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface TabItem {
  label: string;
  href: string;
  count?: number;
}

interface TabsProps {
  items: TabItem[];
}

/**
 * Href-based subview tab strip. Active detection is by exact pathname
 * match (falls back to a prefix match so a detail-ish sub-route under
 * a tab's href still highlights it).
 */
export default function Tabs({ items }: TabsProps) {
  const pathname = usePathname();

  return (
    <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border-rule)", flexWrap: "wrap" }}>
      {items.map((item) => {
        const active = pathname === item.href || (pathname?.startsWith(`${item.href}/`) ?? false);
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 14px",
              fontFamily: "var(--font-data)",
              fontSize: 12,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: active ? "var(--bow-ink)" : "var(--bow-slate)",
              borderBottom: active ? "2px solid var(--bow-blue)" : "2px solid transparent",
              marginBottom: -1,
            }}
          >
            {item.label}
            {typeof item.count === "number" && (
              <span
                style={{
                  fontFamily: "var(--font-data)",
                  fontSize: 11,
                  color: "var(--bow-slate)",
                  background: "var(--bow-paper)",
                  borderRadius: 999,
                  padding: "1px 7px",
                }}
              >
                {item.count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
