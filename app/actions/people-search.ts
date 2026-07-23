"use server";

import { getCurrentUser } from "@/lib/dal";
import { searchPeopleDirectory, type PersonSearchResult } from "@/lib/people-directory";

/**
 * Universal people search backing the portal top bar (Stage 3). Staff-only;
 * returns an empty result set for any other role instead of throwing, so the
 * top bar can call it unconditionally without role-gating its own markup.
 */
export async function searchPeopleAction(query: string): Promise<PersonSearchResult[]> {
  const me = await getCurrentUser();
  if (!me || (me.role !== "admin" && me.role !== "growth")) return [];
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  return searchPeopleDirectory(trimmed, 8);
}
