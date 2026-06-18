import type { Metadata } from "next";
import "./globals.css";
import SmoothScroll from "@/components/site/SmoothScroll";
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
  },
  twitter: {
    card: "summary_large_image",
    title: "BOW Sports Capital",
    description: SITE.description,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <SmoothScroll />
        {children}
      </body>
    </html>
  );
}
