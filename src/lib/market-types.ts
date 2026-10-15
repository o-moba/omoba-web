export type MarketKind = "weapon" | "avatar";
/** Shared renderer input; placing a map prop does not make it a market claim. */
export type PreviewAsset = {
  kind: MarketKind | 'map_prop'; name: string; thumbnailUrl: string | null;
  modelUrl: string; sha256: string; sizeBytes: number; wildspark?: boolean;
};
export type MarketItem = {
  /** Registry catalogue ID, `ekza:<kind>:<uuid>`. */
  id: string;
  /** Bare UUID used by the claim routes. */
  assetId: string;
  kind: MarketKind;
  name: string;
  description: string;
  creator: string;
  license: { text: string; attribution: string };
  /** Registry-hosted preview, or null when absent or not trusted. */
  thumbnailUrl: string | null;
  /** Exact approved GLB, validated against the configured Registry and SHA. */
  modelUrl: string;
  /** C5 requirement binding of the approved OMOBA release. */
  requirementId: string | null;
  wildspark: boolean;
  revisionId: string;
  profile: string;
  sha256: string;
  sizeBytes: number;
};
export type MarketState =
  | { state: "ready"; items: MarketItem[]; skipped: number }
  | { state: "unavailable"; reason: string };
export type OwnedReason = "created" | "saved" | "claimed";
export type OwnedAsset = {
  assetId: string;
  kind: MarketKind;
  reason: OwnedReason | null;
};
export type EkzaSession =
  | { state: "guest" }
  | { state: "connected"; username: string; expiresAt: string; owned: OwnedAsset[] }
  | { state: "expired" }
  | { state: "unavailable" };
export type EkzaDevice = {
  userCode: string;
  verificationUrl: string | null;
  expiresAt: string;
  interval: number;
};
