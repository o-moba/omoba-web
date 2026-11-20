import type { ClassBuildDocument, WorkshopCatalog } from "./workshop-types";
import type { AssetCatalog, AssetRequirement } from "./asset-catalog-types";
export const MAX_BUILD_BYTES: number;
export const MAX_WORKSHOP_BYTES: number;
export function parseWorkshopCatalog(input: unknown): WorkshopCatalog;
export function recipeIssues(
  recipe: unknown,
  catalog: WorkshopCatalog,
): string[];
export function buildIssues(
  document: unknown,
  catalog: WorkshopCatalog,
): string[];
export function parseClassBuild(
  input: unknown,
  catalog: WorkshopCatalog,
): ClassBuildDocument;
export function defaultBuild(
  catalog: WorkshopCatalog,
  coreId?: string,
): ClassBuildDocument;
export function combatTestPreset(
  document: ClassBuildDocument,
  catalog: WorkshopCatalog,
): WorkshopCatalog["sandboxTemplate"];
export function derivedAssetRequirements(
  document: ClassBuildDocument,
  assets: AssetCatalog,
): AssetRequirement[];
export function safeLibraryVerificationUrl(
  value: unknown,
  context?: { studio?: string | null; prototype?: boolean; loopback?: boolean },
): string | null;
