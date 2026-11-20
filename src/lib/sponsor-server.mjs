import { ekzaConfig } from './ekza-link.mjs';
import { registryRequest } from './market-server.mjs';
import { PLACEMENT_SLOTS_PATH, SCULPTURE_CATALOG_PATH, parseSlots, parseSculptures, parseOwnPlacements } from './sponsor.mjs';

export async function loadSponsor(env = process.env) {
  try {
    const { registry } = ekzaConfig(env);
    const [slots, catalog] = await Promise.all([
      registryRequest(registry, PLACEMENT_SLOTS_PATH), registryRequest(registry, SCULPTURE_CATALOG_PATH),
    ]);
    if (slots.status !== 200 || catalog.status !== 200) return { state: 'unavailable' };
    const { items: models, skipped } = parseSculptures(catalog.json, registry);
    return { state: 'ready', ...parseSlots(slots.json, registry), models, skipped };
  } catch { return { state: 'unavailable' }; }
}
export async function readSponsorSession(registry, token) {
  try {
    const response = await registryRequest(registry, '/v1/account/placements', { token });
    if (response.status === 401 || response.status === 403) return { state: 'expired' };
    if (response.status !== 200) return { state: 'unavailable' };
    return { state: 'connected', items: parseOwnPlacements(response.json, registry) };
  } catch { return { state: 'unavailable' }; }
}
