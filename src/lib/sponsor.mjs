// Exact, bounded contracts for the free community sculpture pilot.
export const PLACEMENT_SCOPE = 'map-placement';
export const SCULPTURE_PROFILE = 'map-prop-glb-v1';
export const MAX_SCULPTURE_BYTES = 8 * 1024 * 1024;
export const SCULPTURE_CATALOG_PATH = '/v2/assets?kind=map_prop&project=omoba&platform=desktop&profile=map-prop-glb-v1';
export const PLACEMENT_SLOTS_PATH = '/v1/projects/omoba/placements/slots';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HASH = /^[0-9a-f]{64}$/;
const ASSET = /^ekza:map_prop:([0-9a-f-]{36})$/;
const STATUSES = new Set(['pending', 'active', 'expired', 'rejected', 'cancelled', 'revoked']);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validAsset = value => typeof value === 'string' && ASSET.test(value) && UUID.test(value.slice(14));
function check(condition) { if (!condition) throw new Error('Invalid sculpture response'); }
function text(value, limit, empty = false, multiline = false) {
  const controls = multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u : /[\u0000-\u001f\u007f-\u009f]/u;
  check(typeof value === 'string' && value.length <= limit && (empty || value.trim()) && !controls.test(value));
  return value.trim();
}
function timestamp(value) {
  check(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|\+00:00)$/.test(value) && Number.isFinite(Date.parse(value)));
  return value;
}
/** Files must be from this contour's Registry and their URL must bind the exact hash. */
export function sculptureFile(value, registry, sha, thumbnail = false) {
  try {
    const url = new URL(value);
    const match = /^\/v1\/studio\/assets\/([a-f0-9]{64})\/(rendition|rendition-thumbnail)$/.exec(url.pathname);
    if (url.origin !== registry || url.username || url.password || url.hash || url.search || !match ||
      match[2] !== (thumbnail ? 'rendition-thumbnail' : 'rendition') || (sha && match[1] !== sha)) return null;
    return url.href;
  } catch { return null; }
}
export function parseSculptures(value, registry) {
  check(object(value) && value.schema === 'ekza.asset.catalog.v2' && Array.isArray(value.items) && value.items.length <= 500);
  const items = [], ids = new Set();
  let skipped = 0;
  for (const row of value.items) {
    try {
      check(object(row) && validAsset(row.id) && !ids.has(row.id) && row.assetKind === 'map_prop' && row.access === 'free');
      check(row.origin?.kind === 'studio' && UUID.test(row.origin.revisionId));
      check(Array.isArray(row.projectSupport) && row.projectSupport.length <= 64 && row.projectSupport.some(s => s?.projectId === 'omoba' && s.platform === 'desktop' && s.profile === SCULPTURE_PROFILE && s.status === 'approved'));
      check(Array.isArray(row.renditions) && row.renditions.length <= 64);
      const r = row.renditions.find(r => r?.platform === 'desktop' && r.profile === SCULPTURE_PROFILE && r.format === 'glb');
      check(r && HASH.test(r.sha256) && Number.isSafeInteger(r.sizeBytes) && r.sizeBytes > 0 && r.sizeBytes <= MAX_SCULPTURE_BYTES);
      const modelUrl = sculptureFile(r.downloadUrl, registry, r.sha256);
      check(modelUrl);
      const parsed = { id: row.id, kind: 'map_prop', name: text(row.name, 160), description: text(row.description ?? '', 4000, true, true),
        creator: text(row.creator?.name, 120), license: { text: text(row.license?.text, 64), attribution: text(row.license?.attribution ?? '', 2000, true, true) },
        thumbnailUrl: sculptureFile(row.thumbnailUrl, registry, null, true), modelUrl, revisionId: row.origin.revisionId,
        sha256: r.sha256, sizeBytes: r.sizeBytes, wildspark: false };
      ids.add(row.id); items.push(parsed);
    } catch { skipped++; }
  }
  return { items, skipped };
}
export function parsePlacement(value, registry, own = false) {
  check(object(value) && UUID.test(value.id) && value.slotId === 'opposite-dragon' && validAsset(value.assetId) && UUID.test(value.revisionId));
  check(HASH.test(value.renditionSha256) && Number.isSafeInteger(value.renditionBytes) && value.renditionBytes > 0 && value.renditionBytes <= MAX_SCULPTURE_BYTES);
  const renditionUrl = sculptureFile(value.renditionUrl, registry, value.renditionSha256);
  check(renditionUrl);
  const startsAt = value.startsAt === null && own ? null : timestamp(value.startsAt);
  const expiresAt = value.expiresAt === null && own ? null : timestamp(value.expiresAt);
  check((startsAt === null) === (expiresAt === null));
  if (startsAt !== null) check(Date.parse(expiresAt) - Date.parse(startsAt) === 86400000);
  const result = { id: value.id, slotId: value.slotId, assetId: value.assetId, revisionId: value.revisionId,
    renditionSha256: value.renditionSha256, renditionBytes: value.renditionBytes, renditionUrl,
    title: text(value.title, 80), credit: text(value.credit, 120), startsAt, expiresAt };
  if (own) {
    check(value.project === 'omoba' && value.paymentMode === 'free' && STATUSES.has(value.status));
    if (value.status === 'active') check(startsAt !== null);
    return { ...result, project: 'omoba', paymentMode: 'free', status: value.status, createdAt: timestamp(value.createdAt), reason: text(value.reason ?? '', 2000, true, true) };
  }
  return result;
}
export function parseOwnPlacements(value, registry) {
  check(object(value) && Array.isArray(value.items) && value.items.length <= 500);
  const items = value.items.map(item => parsePlacement(item, registry, true));
  check(new Set(items.map(item => item.id)).size === items.length);
  return items;
}
export function parseSlots(value, registry) {
  check(object(value) && Array.isArray(value.slots) && value.slots.length <= 1);
  const serverNow = timestamp(value.serverNow);
  const slots = value.slots.map(slot => {
    check(object(slot) && slot.id === 'opposite-dragon' && slot.durationSeconds === 86400 && typeof slot.enabled === 'boolean');
    const current = slot.current === null ? null : parsePlacement(slot.current, registry);
    if (current) check(Date.parse(current.startsAt) <= Date.parse(serverNow) && Date.parse(serverNow) < Date.parse(current.expiresAt));
    return { id: slot.id, name: text(slot.name, 120), durationSeconds: 86400, enabled: slot.enabled, current };
  });
  return { serverNow, slots };
}
/** Explicit body allowlist: no payment flag, transaction hash, URL, times or transforms. */
export function parsePlacementRequest(value) {
  const fields = ['project', 'slotId', 'assetId', 'revisionId', 'renditionSha256', 'title', 'credit', 'rightsAccepted', 'idempotencyKey'];
  check(object(value) && Object.keys(value).length === fields.length && Object.keys(value).every(key => fields.includes(key)));
  check(value.project === 'omoba' && value.slotId === 'opposite-dragon' && validAsset(value.assetId) && UUID.test(value.revisionId) && HASH.test(value.renditionSha256) && UUID.test(value.idempotencyKey) && value.rightsAccepted === true);
  return { project: 'omoba', slotId: value.slotId, assetId: value.assetId, revisionId: value.revisionId,
    renditionSha256: value.renditionSha256, title: text(value.title, 80), credit: text(value.credit, 120), rightsAccepted: true, idempotencyKey: value.idempotencyKey };
}
export function sponsorCookieNames(secure) {
  const prefix = secure ? '__Host-' : '';
  return { link: prefix + 'omoba-ekza-placement', device: prefix + 'omoba-ekza-placement-device', csrf: prefix + 'omoba-ekza-placement-csrf' };
}
export function sponsorRoute(path, method) {
  if (typeof path !== 'string' || path.length > 128) return null;
  if (method === 'GET' && ['csrf', 'public', 'placements'].includes(path)) return { action: path };
  if (method === 'POST' && ['device', 'device/poll', 'sign-out', 'placements'].includes(path)) return { action: path === 'placements' ? 'create' : path };
  const match = /^placements\/([^/]+)\/cancel$/.exec(path);
  if (method === 'POST' && match && UUID.test(match[1])) return { action: 'cancel', id: match[1] };
  return null;
}
export function sculptureDraftUrl(studio) {
  return studio + '/studio?view=new&kind=map_prop&project=omoba&requirement=community.map.sculpture';
}
