// Runs once before a server instance handles requests. A contour
// misconfiguration, or a build made for another contour, stops the server here
// with a clear error instead of serving (fail closed). See docs/vercel.md#contours.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { assertBuiltContour, assertContour } = await import('./lib/contour-guard.mjs');
  // OMOBA_BUILT_CONTOUR is inlined by next.config.ts at build time.
  assertBuiltContour(process.env.OMOBA_BUILT_CONTOUR, assertContour(process.env));
}
