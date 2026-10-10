import { getLocale } from "@/lib/locale-server";
import { creatorText } from "@/lib/creator-translations";
import { publicSiteUrl } from "@/lib/navigation.mjs";
import type { Metadata } from "next";
import { connection } from "next/server";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { initialAccount } from "@/lib/server-api";
import { parseAssetCatalog, MAX_CATALOG_BYTES } from "@/lib/asset-catalog.mjs";
import { verifyCatalogRevision } from "@/lib/asset-catalog-server.mjs";
import { parseWorkshopCatalog, MAX_WORKSHOP_BYTES } from "@/lib/workshop.mjs";
import Workshop from "@/components/workshop";
import "../creators/creators.css";
import "./workshop.css";
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: creatorText(locale, "Class Workshop · OMOBA"),
    description: creatorText(locale, "Compose a class from canonical game skills and try it in a local Combat Test."),
  };
}
async function snapshot(path: string, limit: number) {
  const absolute = join(process.cwd(), "public", path);
  if ((await stat(absolute)).size > limit)
    throw new Error("Snapshot exceeds limit");
  return readFile(absolute, "utf8");
}
export default async function WorkshopPage() {
  await connection();
  const [assetsRaw, catalogRaw, session] = await Promise.all([
    snapshot("asset-catalog/catalog.json", MAX_CATALOG_BYTES),
    snapshot("workshop/catalog.json", MAX_WORKSHOP_BYTES),
    initialAccount(),
  ]);
  const assets = verifyCatalogRevision(parseAssetCatalog(assetsRaw));
  const catalog = verifyCatalogRevision(parseWorkshopCatalog(catalogRaw));
  if (catalog.gameplayRevision !== assets.source.gameplayRevision)
    throw new Error("Workshop and asset gameplay revisions differ");
  return (
    <Workshop
      siteUrl={publicSiteUrl(process.env.OMOBA_SITE_URL,process.env.NODE_ENV)}
      catalog={catalog}
      assets={assets}
      initialAccount={session.account}
      initiallyUnavailable={session.unavailable}
      accountDisabled={session.disabled === true}
    />
  );
}
