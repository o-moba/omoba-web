// Runs once before a server instance handles requests. A contour or market
// misconfiguration, or a build made for another contour or market, stops the
// server here with a clear error instead of serving (fail closed). See
// docs/vercel.md#contours and docs/markets.md.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { assertBuiltContour, assertContour } = await import('./lib/contour-guard.mjs');
  const { assertBuiltMarket, assertMarket } = await import('./lib/market-profile.mjs');
  // OMOBA_BUILT_CONTOUR and OMOBA_BUILT_MARKET are inlined by next.config.ts at build time.
  assertBuiltContour(process.env.OMOBA_BUILT_CONTOUR, assertContour(process.env));
  assertBuiltMarket(process.env.OMOBA_BUILT_MARKET, assertMarket(process.env));
}
