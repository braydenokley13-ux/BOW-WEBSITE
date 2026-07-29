import ContentPage from "@/components/site/ContentPage";
import PodcastPlayer from "@/components/site/PodcastPlayer";
import { podcastAllEpisodes, podTakeaways } from "@/lib/podcast";
import { contentMetadata } from "@/lib/cms/metadata";

/**
 * The podcast page.
 *
 * Framing copy and the episode index are content (slug `podcast`); the player
 * below stays in code because it is behaviour, not words. It plays whichever
 * episode is newest in the episode library.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return contentMetadata("podcast", { path: "/podcast" });
}

export default function PodcastPage() {
  return <ContentPage slug="podcast" screenLabel="Podcast" extras={<FeaturedEpisode />} />;
}

/** "44 MIN" -> 2640 seconds; anything unparseable falls back to 30 minutes. */
function runtimeSeconds(runtime: string): number {
  const minutes = Number(/(\d+)/.exec(runtime)?.[1]);
  return Number.isFinite(minutes) && minutes > 0 ? minutes * 60 : 1800;
}

function FeaturedEpisode() {
  const episode = podcastAllEpisodes[0];
  if (!episode) return null;
  const seconds = runtimeSeconds(episode.runtime);
  return (
    <section style={{ background: "var(--bow-ink)", padding: "clamp(32px,5vw,64px) clamp(18px,4vw,40px)" }}>
      <div className="bow-container">
        <PodcastPlayer
          episode={episode.num}
          eyebrow={`${episode.topic} · Latest episode`}
          title={episode.title}
          desc={episode.desc}
          lengthSec={seconds}
          lengthLabel={`${Math.floor(seconds / 60)}:00`}
          takeaways={podTakeaways}
        />
      </div>
    </section>
  );
}
