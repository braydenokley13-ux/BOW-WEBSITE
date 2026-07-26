import type { Metadata } from "next";
import "./globals.css";
import SmoothScroll from "@/components/site/SmoothScroll";
import { fontVariables } from "@/lib/fonts";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: "BOW Sports Capital — The front office for the next generation",
    template: "%s · BOW Sports Capital",
  },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: [
    "sports business education",
    "sports economics",
    "front office simulation",
    "salary cap",
    "middle school economics",
    "high school finance",
    "decision-making",
  ],
  openGraph: {
    type: "website",
    siteName: SITE.name,
    title: "BOW Sports Capital — Read the game. Run the business. Make the decision.",
    description: SITE.description,
    url: SITE.url,
    images: [{ url: "/bow-social-preview.png", width: 1200, height: 630, alt: "Students making sports-business decisions with a BOW instructor" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "BOW Sports Capital",
    description: SITE.description,
    images: ["/bow-social-preview.png"],
  },
};

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
