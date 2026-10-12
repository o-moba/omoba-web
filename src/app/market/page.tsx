import { getLocale } from "@/lib/locale-server";
import { publicSiteUrl } from "@/lib/navigation.mjs";
import type { Metadata } from "next";
import { connection } from "next/server";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { MAX_CATALOG_BYTES, parseAssetCatalog } from "@/lib/asset-catalog.mjs";
import { verifyCatalogRevision } from "@/lib/asset-catalog-server.mjs";
import type { AssetCatalog } from "@/lib/asset-catalog-types";
import { studioOrigin } from "@/lib/ekza-link.mjs";
import { WILDSPARK_SET_REQUIREMENT, studioDraftUrl, studioLibraryUrl } from "@/lib/market.mjs";
import { loadMarket } from "@/lib/market-server.mjs";
import { initialEkzaSession } from "@/lib/ekza-server";
import { marketText } from "@/lib/market-translations";
import Market from "@/components/market";
import "../creators/creators.css";
import "./market.css";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: marketText(locale, "Market · OMOBA"),
    description: marketText(locale, "Free community weapons and avatars approved for OMOBA."),
  };
}
/** Game-owned default previews stand in for sets without a Registry thumbnail. */
async function wildsparkPreviews() {
  const path = join(process.cwd(), "public/asset-catalog/catalog.json");
  if ((await stat(path)).size > MAX_CATALOG_BYTES)
    throw new Error("Asset catalogue exceeds snapshot limit");
  const catalog: AssetCatalog = verifyCatalogRevision(parseAssetCatalog(await readFile(path, "utf8")));
  return ["wildspark.handheld.repeater", "wildspark.handheld.launcher"].flatMap((id) => {
    const preview = catalog.requirements.find((r) => r.id === id)?.baseline.preview;
    return preview ? [{ id, url: preview.url }] : [];
  });
}
// Public Registry read on every request; the Ekza link cookie never leaves the server.
export default async function MarketPage() {
  await connection();
  const [market, session, previews] = await Promise.all([
    loadMarket(),
    initialEkzaSession(),
    wildsparkPreviews(),
  ]);
  return (
    <Market
      market={market}
      initialSession={session}
      wildsparkPreviews={previews}
      studioDraftUrl={studioDraftUrl(studioOrigin(), WILDSPARK_SET_REQUIREMENT)}
      studioLibraryUrl={studioLibraryUrl(studioOrigin())}
      siteUrl={publicSiteUrl(process.env.OMOBA_SITE_URL, process.env.NODE_ENV)}
    />
  );
}
