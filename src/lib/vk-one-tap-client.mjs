/** Explicit SDK configuration and payloads. Provider tokens never become
 * browser-supplied OMOBA sessions. */
export function oneTapConfiguration(value, origin) {
  if (!value || !Number.isSafeInteger(value.app) || value.app <= 0 || value.redirectUrl !== origin
    || !/^[0-9a-f]{64}$/.test(value.state) || !/^[A-Za-z0-9_-]{43}$/.test(value.codeChallenge)
    || value.scope !== 'vkid.personal_info') throw new Error('Invalid sign-in configuration');
  return { app: value.app, redirectUrl: value.redirectUrl, state: value.state,
    codeChallenge: value.codeChallenge, scope: value.scope };
}

export function oneTapPayload(value, state) {
  const printable = (text, max) => typeof text === 'string' && text.length > 0 && text.length <= max && /^[\x21-\x7e]+$/.test(text);
  if (!value || value.state !== state || !printable(value.code, 1024) || !printable(value.device_id, 512)) throw new Error('Invalid sign-in response');
  return { code: value.code, device_id: value.device_id, state: value.state };
}

export function localSignInLocation(value, origin) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\s\u0000-\u001f\u007f]/.test(value)) throw new Error('Invalid sign-in destination');
  const url = new URL(value, origin);
  if (url.origin !== origin) throw new Error('Invalid sign-in destination');
  return url.pathname + url.search;
}
