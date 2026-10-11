import type { EkzaSession, MarketState } from "./market-types";
export const REGISTRY_TIMEOUT_MS: number;
export class RegistryUnavailable extends Error {
  reason: string;
  constructor(reason: string);
}
type RequestOptions = { method?: string; token?: string; body?: unknown; timeoutMs?: number; maxBytes?: number };
export function registryRequest(
  origin: string,
  path: string,
  options?: RequestOptions,
): Promise<{ status: number; headers: Headers; json: unknown }>;
export function loadMarket(
  env?: Record<string, string | undefined>,
  options?: { timeoutMs?: number; maxBytes?: number },
): Promise<MarketState>;
export function readLibrary(
  registry: string,
  token: string,
  options?: { timeoutMs?: number; maxBytes?: number },
): Promise<EkzaSession>;
