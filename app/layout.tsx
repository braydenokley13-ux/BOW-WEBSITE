import type { Metadata } from "next";
import "./globals.css";
import SmoothScroll from "@/components/site/SmoothScroll";
import { fontVariables } from "@/lib/fonts";
import { contentMetadata } from "@/lib/cms/metadata";
import { SITE_URL } from "@/lib/cms/metadata";

/**
 * Root metadata is built from Global Settings, so the organisation name, the
 * default description, the title pattern, and the social-sharing image are all
 * founder-edited. `contentMetadata` falls back to built-in defaults if the
 * settings read fails, because a `<head>` must never take the site down.
 */
export async function generateMetadata(): Promise<Metadata> {
  const base = await contentMetadata(null);
  return {
    ...base,
    metadataBase: new URL(SITE_URL),
    title: {
      default: typeof base.title === "string" ? base.title : "BOW Sports Capital",
      // Nested pages supply their own fully-formed title through
      // `contentMetadata`, which already applies the founder's title pattern.
      template: "%s",
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={fontVariables}>
      <body>
        <a className="bow-skip-link" href="#main">Skip to main content</a>
        <SmoothScroll />
        {children}
      </body>
    </html>
  );
}
