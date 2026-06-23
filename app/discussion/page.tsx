import { requireUser } from "@/lib/dal";
import { getChannelPosts, getChannelCounts } from "@/lib/discussion";
import { isDiscussionChannel, type DiscussionChannel } from "@/lib/account";
import DiscussionBoard from "@/components/discussion/DiscussionBoard";

type SP = Promise<{ channel?: string; page?: string }>;

const PER_PAGE = 10;
const DEFAULT_CHANNEL: DiscussionChannel = "gm_decisions";

export default async function DiscussionPage({ searchParams }: { searchParams: SP }) {
  const me = await requireUser();
  const sp = await searchParams;

  const channel: DiscussionChannel =
    sp.channel && isDiscussionChannel(sp.channel) ? sp.channel : DEFAULT_CHANNEL;
  const page = Math.max(1, Number(sp.page) || 1);

  const channelPage = getChannelPosts(channel, page, PER_PAGE, me.id);
  const counts = getChannelCounts();

  return (
    <DiscussionBoard
      channel={channel}
      posts={channelPage.posts}
      page={channelPage.page}
      totalPages={channelPage.totalPages}
      total={channelPage.total}
      counts={counts}
      firstName={me.first}
      role={me.role}
    />
  );
}
