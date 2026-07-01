"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import RouteError from "@/components/site/RouteError";

export default function LeaderboardError({
  error,
  reset,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  unstable_retry?: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <RouteError
      heading="The leaderboard hit a snag."
      body="We couldn’t load the rankings just now. Run it back — your score is safe."
      onRetry={() => (unstable_retry ?? reset)?.()}
      homeHref="/leaderboard"
      homeLabel="Reload Leaderboard"
    />
  );
}
