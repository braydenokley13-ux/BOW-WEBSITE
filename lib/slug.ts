/**
 * URL slugs — shared by the NBA seed (player names → slugs) and the
 * article CMS (titles → slugs). ASCII-folds accents, drops punctuation,
 * kebab-cases the rest: "De'Aaron Fox" → "deaaron-fox".
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining accents left by NFKD
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
