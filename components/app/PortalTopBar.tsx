"use client";

export default function PortalTopBar({ title }: { title: string }) {
  return (
    <div className="bow-portal-topbar">
      <span className="bow-portal-topbar__title">{title}</span>
      <div className="bow-portal-topbar__utility">
        {/* Placeholder search affordance — no functionality this stage. */}
        <span className="bow-portal-search" aria-disabled="true">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <circle cx="7" cy="7" r="4.5" />
            <path d="M13.5 13.5 10.5 10.5" />
          </svg>
          Search
        </span>
      </div>
    </div>
  );
}
