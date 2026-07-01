"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import RouteError from "@/components/site/RouteError";

export default function ProfileError({
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
      heading="This profile hit a snag."
      body="We couldn’t load this profile just now. Run it back and try again."
      onRetry={() => (unstable_retry ?? reset)?.()}
      homeHref="/dashboard"
      homeLabel="Back to Dashboard"
    />
  );
}
