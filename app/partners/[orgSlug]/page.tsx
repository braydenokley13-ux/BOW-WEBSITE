import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPartnerBySlug } from "@/lib/partners";
import {
  PARTNER_STUDENT_BULLETS,
  PARTNER_INSTRUCTOR_BULLETS,
  partnerTypeLabel,
} from "@/lib/account";
import { SITE } from "@/lib/site";
import PartnerLanding from "@/components/partners/PartnerLanding";

/* ============================================================
 * Public partner / school landing page (Feature 5).
 *
 * No login: these are outreach pages shared on LinkedIn and over
 * email, so generateMetadata emits full Open Graph tags and the
 * dynamic OG card lives in opengraph-image.tsx alongside this file.
 *
 * Reads SQLite via getPartnerBySlug, so this is a dynamic ƒ route
 * (not statically prerendered for the slug) — that's expected.
 * ============================================================ */

type Props = { params: Promise<{ orgSlug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { orgSlug } = await params;
  const org = (await getPartnerBySlug(orgSlug));
  if (!org) {
    return { title: "Partner not found · BOW Sports Capital", robots: { index: false, follow: false } };
  }

  const title = `${org.name} · BOW Sports Capital`;
  const description = org.customHeadline;
  const url = `${SITE.url}/partners/${org.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      title,
      description,
      siteName: "BOW Sports Capital",
      url,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function PartnerPage({ params }: Props) {
  const { orgSlug } = await params;
  const org = (await getPartnerBySlug(orgSlug));
  if (!org) notFound();

  return (
    <PartnerLanding
      slug={org.slug}
      name={org.name}
      typeLabel={partnerTypeLabel(org.orgType)}
      customHeadline={org.customHeadline}
      customBody={org.customBody}
      studentBullets={PARTNER_STUDENT_BULLETS}
      instructorBullets={PARTNER_INSTRUCTOR_BULLETS}
    />
  );
}
