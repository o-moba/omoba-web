// Runs once before a server instance handles requests. A contour, market or
// Account API misconfiguration, or a build made for another contour or market,
// stops the server here with a clear error instead of serving (fail closed). See
// docs/vercel.md#contours and docs/markets.md.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { assertBuiltContour, assertContour } = await import('./lib/contour-guard.mjs');
  const { assertBuiltMarket, assertMarket } = await import('./lib/market-profile.mjs');
  // OMOBA_BUILT_CONTOUR and OMOBA_BUILT_MARKET are inlined by next.config.ts at build time.
  assertBuiltContour(process.env.OMOBA_BUILT_CONTOUR, assertContour(process.env));
  assertBuiltMarket(process.env.OMOBA_BUILT_MARKET, assertMarket(process.env));
  // The Account API route: a missing or malformed ingress key, or a hosted portal on
  // the loopback API without OMOBA_TRUST_LOOPBACK_PROXY=1 (docs/markets.md#hosting-the-ru-portal).
  const { assertPortalConfig } = await import('./lib/security.mjs');
  assertPortalConfig(process.env);
}
