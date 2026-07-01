"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import RouteError from "@/components/site/RouteError";

export default function FeedError({
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
      heading="The Daily Feed hit a snag."
      body="We couldn’t load today’s feed just now. Run it back — your streak is safe."
      onRetry={() => (unstable_retry ?? reset)?.()}
      homeHref="/feed"
      homeLabel="Reload Feed"
    />
  );
}
