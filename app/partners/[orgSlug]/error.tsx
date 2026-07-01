"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import RouteError from "@/components/site/RouteError";

export default function PartnerPageError({
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
      heading="This partner page hit a snag."
      body="We couldn’t load this page just now. Run it back, or head to the BOW homepage."
      onRetry={() => (unstable_retry ?? reset)?.()}
      homeHref="/"
      homeLabel="Back to Home"
    />
  );
}
