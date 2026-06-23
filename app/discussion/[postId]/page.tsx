import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { getPostDetail } from "@/lib/discussion";
import PostThread from "@/components/discussion/PostThread";

type Props = { params: Promise<{ postId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { postId } = await params;
  const me = await requireUser();
  const post = getPostDetail(postId, me.id);
  if (!post) {
    return { title: "Discussion · BOW Sports Capital", robots: { index: false, follow: false } };
  }
  return {
    title: `${post.title} · Discussion`,
    description: `${post.channelLabel} — a BOW discussion started by ${post.authorName}.`,
    robots: { index: false, follow: false },
  };
}

export default async function PostThreadPage({ params }: Props) {
  const { postId } = await params;
  const me = await requireUser();
  const post = getPostDetail(postId, me.id);
  if (!post) notFound();

  return <PostThread post={post} firstName={me.first} role={me.role} />;
}
