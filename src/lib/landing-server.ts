import 'server-only';
import { headers } from 'next/headers';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { MAX_CATALOG_BYTES, parseAssetCatalog } from './asset-catalog.mjs';
import { verifyCatalogRevision } from './asset-catalog-server.mjs';
import { pageReleases, type Release } from './releases.mjs';
import { accountUpstreamHeaders, portalConfig } from './security.mjs';

/** What the guest home claims, counted from the game's own data, never written by hand. */
export type LandingFacts = { classes: number };
/** The downloads the guest home offers; `unavailable` when the Account API did not answer. */
export type LandingReleases = { releases: Release[]; unavailable: boolean };

let facts: Promise<LandingFacts> | null = null;

/**
 * The number of hero classes in the game's catalog snapshot (`public/asset-catalog/
 * catalog.json`, exported from the game's `shared/assets/catalog` and verified by
 * `npm run catalog:check` on every build), read once per server process.
 */
export function landingFacts(): Promise<LandingFacts> {
  facts ??= (async () => {
    const path = join(process.cwd(), 'public/asset-catalog/catalog.json');
    if ((await stat(path)).size > MAX_CATALOG_BYTES) throw new Error('Asset catalogue exceeds snapshot limit');
    const catalog = verifyCatalogRevision(parseAssetCatalog(await readFile(path, 'utf8')));
    return { classes: catalog.classes.length };
  })().catch((error) => { facts = null; throw error; });
  return facts;
}

/**
 * The market's download catalog (`GET /v1/releases`, public), read on the server so the
 * guest home lists its downloads without JavaScript. Only direct downloads with an https
 * link, a SHA-256 and a size are kept (`pageReleases`).
 */
export async function landingReleases(): Promise<LandingReleases> {
  try {
    const config = portalConfig();
    if (!config.accountEnabled) return { releases: [], unavailable: false };
    const forwarded = accountUpstreamHeaders((await headers()).get('x-real-ip'));
    if (!forwarded) return { releases: [], unavailable: true };
    const response = await fetch(config.api + '/v1/releases', {
      headers: forwarded, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return { releases: [], unavailable: true };
    return { releases: pageReleases(await response.json()), unavailable: false };
  } catch { return { releases: [], unavailable: true }; }
}
