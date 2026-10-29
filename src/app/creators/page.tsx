import { getLocale } from "@/lib/locale-server";
import { creatorText } from "@/lib/creator-translations";
import { contourSiteUrl } from "@/lib/navigation.mjs";
import type { Metadata } from "next";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { marketFeatures } from "@/lib/market-profile.mjs";
import { MAX_CATALOG_BYTES, parseAssetCatalog } from "@/lib/asset-catalog.mjs";
import { verifyCatalogRevision } from "@/lib/asset-catalog-server.mjs";
import { studioOrigin } from "@/lib/ekza-link.mjs";
import CreatorCatalog from "@/components/creator-catalog";
import "./creators.css";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: creatorText(locale, "Creator Library · OMOBA"),
    description: creatorText(locale, "Explore Open Moba classes, skill visuals and game-owned design briefs."),
  };
}
// Game-owned snapshot only; localization does not access the Account API.
export default async function CreatorsPage() {
  // The creator library leads to Studio and the market: an Ekza surface.
  if (!marketFeatures().ekza) notFound();
  const locale = await getLocale();
  const path = join(process.cwd(), "public/asset-catalog/catalog.json");
  if ((await stat(path)).size > MAX_CATALOG_BYTES)
    throw new Error("Asset catalogue exceeds snapshot limit");
  const catalog = verifyCatalogRevision(
    parseAssetCatalog(await readFile(path, "utf8")),
  );
  return (
    <Suspense
      fallback={
        <main lang={locale === "zh" ? "zh-CN" : locale} className="creator-loading">
          {creatorText(locale, "Loading the creator library…")}
        </main>
      }
    >
      <CreatorCatalog siteUrl={contourSiteUrl()} studioUrl={studioOrigin()} catalog={catalog} />
    </Suspense>
  );
}
