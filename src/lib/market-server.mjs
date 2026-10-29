// Bounded Registry reads for the market page and the Ekza BFF. Framework-free so
// the timeout, size and outage rules run under node --test.
import { ekzaConfig, parseLibrary } from "./ekza-link.mjs";
import { MARKET_PROJECT, MAX_MARKET_BYTES, parseMarket } from "./market.mjs";

export const REGISTRY_TIMEOUT_MS = 5000;

export class RegistryUnavailable extends Error {
  constructor(reason) {
    super("Registry unavailable: " + reason);
    this.reason = reason;
  }
}

/** One Registry request: fixed origin, no redirects, 5 s budget including the body. */
export async function registryRequest(origin, path, {
  method = "GET",
  token,
  body,
  timeoutMs = REGISTRY_TIMEOUT_MS,
  maxBytes = MAX_MARKET_BYTES,
} = {}) {
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = "Bearer " + token;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let response;
  const signal = AbortSignal.timeout(timeoutMs);
  try {
    response = await fetch(origin + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      redirect: "error",
      signal,
    });
  } catch {
    throw new RegistryUnavailable(signal.aborted ? "timeout" : "network");
  }
  if (Number(response.headers.get("content-length") || 0) > maxBytes) {
    await response.body?.cancel().catch(() => {});
    throw new RegistryUnavailable("oversized");
  }
  const chunks = [];
  let size = 0;
  try {
    const reader = response.body?.getReader();
    if (reader)
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > maxBytes) {
          await reader.cancel().catch(() => {});
          throw new RegistryUnavailable("oversized");
        }
        chunks.push(value);
      }
  } catch (error) {
    if (error instanceof RegistryUnavailable) throw error;
    throw new RegistryUnavailable(signal.aborted ? "timeout" : "network");
  }
  if (!size) return { status: response.status, headers: response.headers, json: null };
  if (!/^application\/(?:[a-z.+-]+\+)?json\b/i.test(response.headers.get("content-type") || ""))
    throw new RegistryUnavailable("not_json");
  try {
    const raw = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
    return { status: response.status, headers: response.headers, json: JSON.parse(raw) };
  } catch {
    throw new RegistryUnavailable("invalid_json");
  }
}

/**
 * Public catalogue for /market. An outage, bad configuration or malformed
 * document is "unavailable", never an empty market.
 * @returns {Promise<import('./market-types').MarketState>}
 */
export async function loadMarket(env = process.env, options = {}) {
  let config;
  try {
    config = ekzaConfig(env);
  } catch {
    return { state: "unavailable", reason: "configuration" };
  }
  try {
    const response = await registryRequest(config.registry, "/v2/assets?project=" + MARKET_PROJECT, options);
    if (response.status !== 200) return { state: "unavailable", reason: "status_" + response.status };
    const { items, skipped } = parseMarket(response.json, config.registry);
    return { state: "ready", items, skipped };
  } catch (error) {
    return { state: "unavailable", reason: error instanceof RegistryUnavailable ? error.reason : "invalid_catalogue" };
  }
}

export const SIGN_OUT_TIMEOUT_MS = 3000;

/**
 * Sign-out (Registry C7): `DELETE /v1/account/session` ends exactly this link, any
 * scope; the account's other links stay. Best effort with a short budget: it never
 * throws, and the caller clears its cookies whatever the answer. True only when the
 * Registry confirmed (204, also for an already ended link).
 */
export async function revokeLink(registry, token, options = {}) {
  try {
    const response = await registryRequest(registry, "/v1/account/session", {
      timeoutMs: SIGN_OUT_TIMEOUT_MS,
      maxBytes: 64 * 1024,
      ...options,
      method: "DELETE",
      token,
    });
    return response.status === 204;
  } catch {
    return false;
  }
}

/** @returns {Promise<import('./market-types').EkzaSession>} */
export async function readLibrary(registry, token, options = {}) {
  try {
    const response = await registryRequest(registry, "/v1/account/library", { ...options, token });
    if (response.status === 401) return { state: "expired" };
    if (response.status !== 200) return { state: "unavailable" };
    const library = parseLibrary(response.json);
    return { state: "connected", ...library };
  } catch {
    return { state: "unavailable" };
  }
}
