import type { Metadata } from "next";
import { getCurrentFeedUser, getFeedStories, getAnsweredStoryIds } from "@/lib/feed";
import FeedSignup from "@/components/feed/FeedSignup";
import FeedTerminal from "@/components/feed/FeedTerminal";

export const metadata: Metadata = {
  title: "BOW Daily Feed",
  description:
    "One real sports-business story at a time. Read the headline, make the GM's call, then see what actually happened and the economics behind it — no cohort required.",
  alternates: { canonical: "/feed" },
};

export default async function FeedPage() {
  const me = await getCurrentFeedUser();
  if (!me) return <FeedSignup />;

  const stories = getFeedStories();
  const answeredIds = getAnsweredStoryIds(me.id);
  return <FeedTerminal user={me} stories={stories} answeredIds={answeredIds} />;
}
