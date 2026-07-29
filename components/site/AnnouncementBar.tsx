import Link from "next/link";
import type { SiteAnnouncement } from "@/lib/cms/read";

/**
 * The site-wide announcement strip.
 *
 * Announcements carry their own date window and are filtered in SQL against
 * `now()`, so an expired one simply stops arriving here — nothing has to be
 * turned off by hand. An empty list renders nothing at all rather than an
 * empty bar.
 */
export default function AnnouncementBar({ announcements }: { announcements: SiteAnnouncement[] }) {
  if (announcements.length === 0) return null;
  return (
    <div
      role="region"
      aria-label="Announcements"
      style={{
        background: "var(--bow-blue)",
        color: "#fff",
        padding: "10px var(--page-inset)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      {announcements.map((announcement) => (
        <div
          key={announcement.id}
          className="bow-container-wide"
          style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 12 }}
        >
          <span style={{ fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.4 }}>{announcement.message}</span>
          {announcement.linkHref ? (
            <Link
              href={announcement.linkHref}
              style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: "#fff", textDecoration: "underline" }}
            >
              {announcement.linkLabel || "Read more"}
            </Link>
          ) : null}
        </div>
      ))}
    </div>
  );
}
