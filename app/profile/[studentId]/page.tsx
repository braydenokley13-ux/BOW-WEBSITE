import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicProfile } from "@/lib/profile";
import { getPublishedPapersByAuthor, rehydrateArticlesFromMirror } from "@/lib/articles";
import PublicProfileView from "@/components/profile/PublicProfileView";

type Props = { params: Promise<{ studentId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { studentId } = await params;
  const profile = getPublicProfile(studentId);
  if (!profile) {
    return { title: "Profile not found · BOW Sports Capital", robots: { index: false, follow: false } };
  }
  const title = `${profile.name} — ${profile.rank.name} · BOW Sports Capital`;
  const description = `${profile.name} reached ${profile.rank.name} on BOW Sports Capital — ${profile.modulesCompleted}/${profile.totalModules} Track 101 modules${profile.certificateEarned ? ", certified" : ""}. BOW Score ${profile.bowScore}.`;

  return {
    title,
    description,
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
  const { studentId } = await params;
  const profile = getPublicProfile(studentId);
  if (!profile) notFound();
  // Published research belongs on the credential — it's the strongest
  // line on it. Rehydrate first so papers survive a cold start.
  await rehydrateArticlesFromMirror();
  const papers = getPublishedPapersByAuthor(studentId).map((a) => ({
    slug: a.slug,
    title: a.title,
    abstract: a.dek,
    publishedAt: a.publishedAt,
  }));
  return <PublicProfileView profile={profile} papers={papers} />;
}
