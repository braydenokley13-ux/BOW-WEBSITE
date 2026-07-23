"use client";

import { usePathname } from "next/navigation";
import { useAppState } from "./AppState";
import { roleLabel as roleLabelFor, roleAccent as roleAccentFor } from "@/lib/account";
import { activeNavId, navForRole, type NavEntry, type NavLink } from "@/lib/navigation/catalog";

function findActiveLabel(navigation: NavEntry[], activeId: string | null): string | null {
  if (!activeId) return null;
  for (const entry of navigation) {
    if (entry.kind === "link" && entry.id === activeId) return entry.label;
    if (entry.kind === "group") {
      const match = entry.items.find((item: NavLink) => item.id === activeId);
      if (match) return match.label;
    }
  }
  return null;
}

/** Shared nav/identity state for the portal shell (sidebar + top bar). */
export function usePortalNav({
  instructorCanDeliver,
  cutoverEnabled,
}: {
  instructorCanDeliver: boolean;
  cutoverEnabled: boolean;
}) {
  const pathname = usePathname();
  const { role, me, signOut } = useAppState();
  const navigation = navForRole(role, { instructorCanDeliver, cutoverEnabled });
  const activeId = activeNavId(pathname, navigation);
  const roleLabelText = roleLabelFor(role);
  const title = findActiveLabel(navigation, activeId) ?? roleLabelText;
  const accent = roleAccentFor(role);

  return { pathname, role, me, signOut, navigation, activeId, title, roleLabel: roleLabelText, accent };
}
