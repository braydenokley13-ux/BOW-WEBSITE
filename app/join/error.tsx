"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import RouteError from "@/components/site/RouteError";

export default function JoinError({
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
      heading="Sign-up hit a snag."
      body="We couldn’t load the sign-up form just now. Run it back, or head to the front office and try another way in."
      onRetry={() => (unstable_retry ?? reset)?.()}
      homeHref="/sign-in"
      homeLabel="Sign In"
    />
  );
}
