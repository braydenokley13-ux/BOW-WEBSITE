import PageEditor from "@/components/admin/website/PageEditor";
import { getEditablePage, listVersions } from "@/lib/cms/admin";
import { SETTINGS_SLUG } from "@/lib/cms/read";

export const dynamic = "force-dynamic";
export const metadata = { title: "Global Settings" };

/**
 * Site-wide content: the organisation name, default descriptions, default
 * signup explanations, and the fallback empty-state text. Never credentials —
 * API keys and connection strings stay in the deployment environment.
 */
export default async function GlobalSettingsScreen() {
  const settings = await getEditablePage(SETTINGS_SLUG);

  if (!settings) {
    return (
      <p style={{ fontFamily: "var(--font-interface)", fontSize: 15, color: "var(--text-secondary)", padding: "40px 0" }}>
        Global settings haven’t been set up yet. Run <code>npm run content:bootstrap</code> to create them.
      </p>
    );
  }

  const versions = await listVersions(settings.page.id);
  return (
    <PageEditor
      key={`${settings.versionId}:${settings.page.hasDraft}:${settings.page.updatedAt}`}
      page={settings}
      versions={versions}
      faqPageSlug={settings.page.slug}
    />
  );
}
