import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicProfile, getPublicProfileRecord } from "@/lib/profile";
import PublicProfileView from "@/components/profile/PublicProfileView";

type Props = { params: Promise<{ studentId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { studentId: publicSlug } = await params;
  const profile = (await getPublicProfile(publicSlug));
  if (!profile) {
    return { title: "Profile not found · BOW Sports Capital", robots: { index: false, follow: false } };
  }
  const title = `${profile.name} — ${profile.rank.name} · BOW Sports Capital`;
  const description = `${profile.name} reached ${profile.rank.name} on BOW Sports Capital — ${profile.modulesCompleted}/${profile.totalModules} Track 101 modules${profile.certificateEarned ? ", certified" : ""}.`;

  return {
    title,
    description,
    // Student credentials are share-by-link only in v1. Even with guardian
    // approval, search-engine discovery remains off by default.
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: "profile",
      siteName: "BOW Sports Capital",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function PublicProfilePage({ params }: Props) {
  const { studentId: publicSlug } = await params;
  const record = (await getPublicProfileRecord(publicSlug));
  if (!record) notFound();
  // Research publication/byline consent is separate from guardian credential
  // sharing consent. Do not attach papers to a minor's public credential until
  // that independent workflow exists.
  return <PublicProfileView profile={record.profile} />;
}
