/**
 * Small inline nav icons for the portal sidebar. Deliberately minimal (no
 * icon library dependency) — 16x16, currentColor, single stroke weight.
 */
import type { SVGProps } from "react";

const base: SVGProps<SVGSVGElement> = {
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export function IconHome(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M2 7.2 8 2l6 5.2" />
      <path d="M3.5 6.2V13.5h9V6.2" />
      <path d="M6.3 13.5V9.8h3.4v3.7" />
    </svg>
  );
}

export function IconGrowth(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M2.2 12.8 6.4 8l2.6 2.6 4.8-5.4" />
      <path d="M10.6 5.2h3.2v3.2" />
    </svg>
  );
}

export function IconPrograms(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
      <path d="M2.5 6.3h11" />
      <path d="M5.6 2.5v3.8" />
    </svg>
  );
}

export function IconPeople(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="6" cy="5.6" r="2.1" />
      <path d="M2 13.2c.5-2.4 2-3.6 4-3.6s3.5 1.2 4 3.6" />
      <circle cx="11.6" cy="6.2" r="1.6" />
      <path d="M10.6 9.9c1.6.1 2.6 1.2 3 3" />
    </svg>
  );
}

export function IconWork(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <rect x="2.5" y="4.6" width="11" height="8.2" rx="1.3" />
      <path d="M5.8 4.6V3.4a1.2 1.2 0 0 1 1.2-1.2h2a1.2 1.2 0 0 1 1.2 1.2v1.2" />
      <path d="M2.5 8.4h11" />
    </svg>
  );
}

export function IconAdmin(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M8 1.8 12.8 3.4V7c0 3.3-2 5.6-4.8 7-2.8-1.4-4.8-3.7-4.8-7V3.4Z" />
      <path d="M6 8l1.4 1.4L10.2 6.6" />
    </svg>
  );
}

export function IconClasses(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M1.8 4.6 8 2.2l6.2 2.4L8 7z" />
      <path d="M4 5.9v3.9c0 1 1.8 1.9 4 1.9s4-.9 4-1.9V5.9" />
      <path d="M14.2 4.6v4.6" />
    </svg>
  );
}

export function IconPlaybook(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M8 3.4C6.7 2.6 4.9 2.3 3 2.6v9.1c1.9-.3 3.7 0 5 .8 1.3-.8 3.1-1.1 5-.8V2.6c-1.9-.3-3.7 0-5 .8Z" />
      <path d="M8 3.4v9.1" />
    </svg>
  );
}

export function IconPartners(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M2.2 13.4V5.8l4.1-2.4v10" />
      <path d="M6.3 7.2l7.5 1.9v4.3H2.2" />
      <path d="M9 11.2v2.2" />
      <path d="M11.6 11.2v2.2" />
    </svg>
  );
}

export function IconCurriculum(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M3.2 2.6h7.2l2.4 2.4v8.4H3.2z" />
      <path d="M10.2 2.6V5h2.6" />
      <path d="M5.6 8.2h5" />
      <path d="M5.6 10.7h3.2" />
    </svg>
  );
}

export const NAV_ICON_BY_ID: Record<string, (props: SVGProps<SVGSVGElement>) => React.ReactElement> = {
  "staff-home": IconHome,
  "student-home": IconHome,
  "instructor-home": IconHome,
  growth: IconGrowth,
  programs: IconPrograms,
  partners: IconPartners,
  people: IconPeople,
  curriculum: IconCurriculum,
  work: IconWork,
  more: IconAdmin,
  "platform-admin": IconAdmin,
  "instructor-classes": IconClasses,
  "instructor-playbook": IconPlaybook,
};
