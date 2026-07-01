"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import RouteError from "@/components/site/RouteError";

export default function AppError({
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
      heading="The front office hit a snag."
      body="We couldn’t load that page just now. Run it back — nothing was lost."
      onRetry={() => (unstable_retry ?? reset)?.()}
      homeHref="/app"
      homeLabel="Back to Front Office"
    />
  );
}
