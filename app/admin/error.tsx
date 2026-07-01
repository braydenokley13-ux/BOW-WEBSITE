"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import RouteError from "@/components/site/RouteError";

export default function AdminError({
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
      heading="The admin console hit a snag."
      body="We couldn’t load the platform data just now. Run it back — nothing was lost."
      onRetry={() => (unstable_retry ?? reset)?.()}
      homeHref="/admin"
      homeLabel="Reload Admin"
    />
  );
}
