"use client";

import { usePortalNav } from "./usePortalNav";
import PortalTopBar from "./PortalTopBar";

export default function PortalTopBarConnected({
  instructorCanDeliver = true,
  cutoverEnabled = true,
}: {
  instructorCanDeliver?: boolean;
  cutoverEnabled?: boolean;
}) {
  const { title } = usePortalNav({ instructorCanDeliver, cutoverEnabled });
  return <PortalTopBar title={title} />;
}
