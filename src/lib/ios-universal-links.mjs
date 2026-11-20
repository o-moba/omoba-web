import { contourName, isLoopbackHost, requestHostname } from './contour.mjs';

// Public App ID prefixes verified against the existing OMOBA provisioning
// profiles. The dev app has its own host so two installed apps cannot compete.
export const IOS_LINKS = Object.freeze({
  production: Object.freeze({ host: 'ios.omoba.ru', appID: 'QSRX2Y2RJB.space.ekza.omoba.beta' }),
  dev: Object.freeze({ host: 'ios.dev.omoba.io', appID: 'QSRX2Y2RJB.space.ekza.omoba.dev' }),
});
export const IOS_RETURN_PATH = '/auth';

export function iosReturnUrl(contour = 'production') {
  if (!Object.hasOwn(IOS_LINKS, contour)) throw new Error('Unknown iOS link contour');
  return 'https://' + IOS_LINKS[contour].host + IOS_RETURN_PATH;
}

/** A link is offered only after a completed browser confirmation, on iOS. */
export function canOfferIosReturn(market, phase, userAgent, platform = '', touchPoints = 0) {
  return market === 'ru' && ['approved', 'attached'].includes(phase)
    && (/iPhone|iPad|iPod/.test(userAgent) || (platform === 'MacIntel' && touchPoints > 1));
}

/** Exact path only. OAuth callbacks, /connect and the website stay in Safari. */
export function iosAssociation(appID) {
  return { applinks: { details: [{ appIDs: [appID], components: [{ '/': IOS_RETURN_PATH }] }] } };
}

/** No session, cookies, upstream calls, redirects or credentials on this endpoint. */
export function iosAssociationResponse(request, env = process.env) {
  const config = IOS_LINKS[contourName(env)];
  // Next's internal Request URL can name its loopback listener behind Nginx.
  // Match the actual Host header, never X-Forwarded-Host or that internal URL.
  const host = request.headers.has('host') ? requestHostname(request.headers.get('host')) : new URL(request.url).hostname;
  const local = isLoopbackHost(host) && env.OMOBA_ALLOW_INSECURE_LOCAL === '1';
  const available = env.OMOBA_MARKET === 'ru' && (host === config.host || local);
  return new Response(request.method === 'HEAD' ? null : JSON.stringify(available ? iosAssociation(config.appID) : { error: 'not_found' }), {
    status: available ? 200 : 404,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': available ? 'public, max-age=3600' : 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
