import type { AssetCatalog, CatalogFile } from "./asset-catalog-types";
export const MAX_CATALOG_BYTES: number;
export function parseAssetCatalog(value: unknown): AssetCatalog;
export function catalogFiles(catalog: AssetCatalog): CatalogFile[];
export function contributionBrief(
  catalog: AssetCatalog,
  requirementId: string,
  classId: string,
): {
  schema: string;
  catalogRevision: string;
  source: AssetCatalog["source"];
  classId: string;
  requirementId: string;
  name: string;
  role: string;
  status: string;
  profile: AssetCatalog["requirements"][number]["profile"];
  brief: string;
  uses: AssetCatalog["requirements"][number]["uses"];
  baseline: AssetCatalog["requirements"][number]["baseline"];
  workflow: string;
};
