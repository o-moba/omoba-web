import type { Metadata } from "next";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { Suspense } from "react";
import { MAX_CATALOG_BYTES, parseAssetCatalog } from "@/lib/asset-catalog.mjs";
import { verifyCatalogRevision } from "@/lib/asset-catalog-server.mjs";
import CreatorCatalog from "@/components/creator-catalog";
import "./creators.css";

export const metadata: Metadata = {
  title: "Creator Library · OMOBA",
  description:
    "Explore Open Moba classes, skill visuals and game-owned design briefs.",
};
// Prerendered from the reviewed snapshot. This route has no Account API imports or requests.
export default async function CreatorsPage() {
  const path = join(process.cwd(), "public/asset-catalog/catalog.json");
  if ((await stat(path)).size > MAX_CATALOG_BYTES)
    throw new Error("Asset catalogue exceeds snapshot limit");
  const catalog = verifyCatalogRevision(
    parseAssetCatalog(await readFile(path, "utf8")),
  );
  return (
    <Suspense
      fallback={
        <main lang="en" className="creator-loading">
          Loading the creator library…
        </main>
      }
    >
      <CreatorCatalog catalog={catalog} />
    </Suspense>
  );
}
