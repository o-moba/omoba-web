/** The browser artifact is trusted local code, never an account or remote URL. */
export const BROWSER_GAME_MANIFEST = '/game/BUILD_INFO.json';
export const BROWSER_GAME_ENTRY = '/game/index.html';
export const BROWSER_GAME_READY = 'omoba-practice-ready';
export const BROWSER_GAME_ERROR = 'omoba-practice-error';

export function validBrowserGameManifest(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && value.mode === 'local-practice' && value.entry === 'index.html'
    && typeof value.version === 'string' && value.version.length > 0 && value.version.length <= 80
    && typeof value.commit === 'string' && /^[a-f0-9]{7,40}$/.test(value.commit);
}

/** A child frame may report readiness, never navigate or provide account state. */
export function browserGameMessage(event, frameWindow, origin) {
  if (!frameWindow || event.source !== frameWindow || event.origin !== origin) return null;
  if (!event.data || typeof event.data !== 'object') return null;
  if (event.data.type === BROWSER_GAME_READY) return 'ready';
  if (event.data.type === BROWSER_GAME_ERROR) return 'error';
  return null;
}
