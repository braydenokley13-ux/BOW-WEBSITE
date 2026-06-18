import type { CSSProperties } from "react";
import Link from "next/link";
import CapLine from "./CapLine";

interface ActionObj {
  label: string;
  href: string;
}

interface SectionHeaderProps {
  kicker?: string;
  title: string;
  action?: ActionObj;
  capLine?: boolean;
  align?: "left" | "center" | "right";
  style?: CSSProperties;
  className?: string;
}

/** SectionHeader — a franchise/section title built from type, spacing and a rule. */
export default function SectionHeader({
  kicker,
  title,
  action,
  capLine = true,
  align = "left",
  style,
  className,
}: SectionHeaderProps) {
  return (
    <header className={className} style={{ display: "flex", flexDirection: "column", gap: 10, ...style }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, textAlign: align }}>
          {kicker && (
            <span
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 12,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--text-secondary)",
              }}
            >
              {kicker}
            </span>
          )}
          <h2
            style={{
              margin: 0,
              fontFamily: "var(--font-display)",
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: "var(--track-display)",
              fontSize: "var(--type-section)",
              lineHeight: "var(--lh-section)",
            }}
          >
            {title}
          </h2>
        </div>
        {action && (
          <Link
            href={action.href}
            className="bow-link"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 14,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--text-link)",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            {action.label}
          </Link>
        )}
      </div>
      {capLine && <CapLine weight={5} step={14} stepAt={0.5} />}
    </header>
  );
}
