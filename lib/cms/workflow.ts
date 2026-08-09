/* Small, pure rules shared by the website editor and its tests. */

export function editableVersionId(
  draftVersionId: unknown,
  publishedVersionId: unknown,
): string | null {
  if (typeof draftVersionId === "string" && draftVersionId) return draftVersionId;
  if (typeof publishedVersionId === "string" && publishedVersionId) return publishedVersionId;
  return null;
}

export function hasUnpublishedDraft(draftVersionId: unknown): boolean {
  return typeof draftVersionId === "string" && draftVersionId.length > 0;
}

