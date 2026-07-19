"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

type Variant = "primary" | "emphasis" | "ink" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

interface ButtonProps {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  full?: boolean;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  href?: string;
  onClick?: () => void;
  style?: CSSProperties;
  "aria-label"?: string;
}

const sizes: Record<Size, CSSProperties> = {
  sm: { fontSize: 13, padding: "8px 16px", letterSpacing: "0.06em" },
  md: { fontSize: 15, padding: "12px 22px", letterSpacing: "0.06em" },
  lg: { fontSize: 18, padding: "15px 30px", letterSpacing: "0.05em" },
};

const variants: Record<Variant, CSSProperties> = {
  primary: { background: "var(--bow-blue)", color: "var(--bow-white)", border: "1px solid var(--bow-blue)" },
  emphasis: { background: "var(--bow-orange-solid)", color: "var(--bow-white)", border: "1px solid var(--bow-orange-solid)" },
  ink: { background: "var(--bow-ink)", color: "var(--bow-white)", border: "1px solid var(--bow-ink)" },
  secondary: { background: "transparent", color: "var(--text-primary)", border: "1px solid var(--border-strong)" },
  ghost: { background: "transparent", color: "var(--text-link)", border: "1px solid transparent" },
};

/**
 * BOW Button — the display voice (Barlow Condensed, uppercase) for
 * sports-business verbs. Flat, 4px radius, 120ms press feedback.
 * Renders a link when `href` is set, otherwise a button.
 */
export default function Button({
  children,
  variant = "primary",
  size = "md",
  full = false,
  disabled = false,
  type = "button",
  href,
  onClick,
  style,
  ...rest
}: ButtonProps) {
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: full ? "100%" : "auto",
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    textTransform: "uppercase",
    borderRadius: "var(--radius-control)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1,
    transition: "transform var(--dur-button) var(--ease-out), filter var(--dur-hover) var(--ease-out)",
    whiteSpace: "nowrap",
    textDecoration: "none",
    ...sizes[size],
    ...variants[variant],
    ...style,
  };

  const press = {
    onMouseDown: (e: React.MouseEvent<HTMLElement>) => {
      if (!disabled) e.currentTarget.style.transform = "translateY(1px)";
    },
    onMouseUp: (e: React.MouseEvent<HTMLElement>) => {
      e.currentTarget.style.transform = "translateY(0)";
    },
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      if (!disabled) e.currentTarget.style.filter = "brightness(0.92)";
    },
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
      e.currentTarget.style.filter = "brightness(1)";
      e.currentTarget.style.transform = "translateY(0)";
    },
  };

  if (href && !disabled) {
    return (
      <Link href={href} className="bow-button" style={base} onClick={onClick} {...press} {...rest}>
        {children}
      </Link>
    );
  }

  return (
    <button className="bow-button" type={type} disabled={disabled} onClick={onClick} style={base} {...press} {...rest}>
      {children}
    </button>
  );
}
