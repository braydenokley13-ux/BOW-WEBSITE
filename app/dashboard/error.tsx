"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import RouteError from "@/components/site/RouteError";

export default function DashboardError({
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
      heading="Your dashboard hit a snag."
      body="We couldn’t load your modules just now. Run it back — your progress is safe."
      onRetry={() => (unstable_retry ?? reset)?.()}
      homeHref="/dashboard"
      homeLabel="Reload Dashboard"
    />
  );
}
