import type { MarketItem } from "./market-types";
export const MAX_MARKET_BYTES: number;
export const MAX_MARKET_ITEMS: number;
export const MARKET_PROJECT: "omoba";
export const MARKET_PLATFORM: "desktop";
export const WILDSPARK_SET_REQUIREMENT: "wildspark.handheld.set";
export const DEFAULT_STUDIO_URL: string;
export function parseMarket(
  value: unknown,
  registryOrigin: string,
): { items: MarketItem[]; skipped: number };
export function marketGroups(items: MarketItem[]): {
  wildspark: MarketItem[];
  weapons: MarketItem[];
  avatars: MarketItem[];
};
export function isWildsparkHandheld(requirementId: string | null | undefined): boolean;
export function studioDraftUrl(studioOrigin?: string, requirementId?: string | null): string;
export function studioLibraryUrl(studioOrigin?: string): string;
export const MAX_POLL_BACKOFF_SECONDS: number;
export function devicePollRetry(
  code: string,
  failures: number,
  interval: number,
  retryAfter?: number | null,
): number | null;
