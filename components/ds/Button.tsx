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
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
}

/**
 * BOW Button — the display voice (Barlow Condensed, uppercase) for
 * sports-business verbs. Flat, 4px radius, 120ms press feedback.
 *
 * Styling is entirely class-based (see `.bow-button*` in app/globals.css).
 * That is deliberate: it keeps this a *server* component, so a marketing page
 * whose only interactivity is links no longer ships and hydrates React for
 * its buttons. It also means `:active` fires on touch and `:hover`/`:focus`
 * stay in sync for keyboard users — neither of which the previous
 * `onMouseDown`/`onMouseEnter` inline-style mutation could do.
 *
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
  className,
  style,
  ...rest
}: ButtonProps) {
  const classes = [
    "bow-button",
    `bow-button-${variant}`,
    `bow-button-${size}`,
    full ? "bow-button-full" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  if (href && !disabled) {
    return (
      <Link href={href} className={classes} style={style} onClick={onClick} {...rest}>
        {children}
      </Link>
    );
  }

  // A disabled `href` still renders as a button so it is genuinely inert —
  // an anchor with aria-disabled remains keyboard-activatable.
  return (
    <button className={classes} type={type} disabled={disabled} onClick={onClick} style={style} {...rest}>
      {children}
    </button>
  );
}
