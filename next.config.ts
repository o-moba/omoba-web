import type { NextConfig } from 'next';
import { assertContour } from './src/lib/contour-guard.mjs';
import { assertMarket, describeMarket } from './src/lib/market-profile.mjs';

// OMOBA_CONTOUR (production|dev, default production). A misconfigured contour fails
// the build and `next dev`; see docs/vercel.md#contours.
const contour = assertContour(process.env);
// OMOBA_MARKET (global|ru|cn, default global) and OMOBA_FEATURE_* (on|off), the same
// switches as the game's shared/src/market.rs. A typo fails the build; see docs/markets.md.
const market = describeMarket(assertMarket(process.env));
const config: NextConfig = {
  poweredByHeader: false,
  // The server refuses to start in a contour or market other than the one it was built for.
  env: { OMOBA_BUILT_CONTOUR: contour, OMOBA_BUILT_MARKET: market },
  // Ship route styles in the initial HTML, including page-specific stylesheets.
  experimental: { inlineCss: true },
  output: 'standalone',
  // The legal pages read their market's versioned documents at runtime (LR-06).
  outputFileTracingIncludes: { '/privacy': ['legal/**/*.md'], '/terms': ['legal/**/*.md'], '/offer': ['legal/**/*.md'] },
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      // The dev contour is public but never indexed, including API routes and assets.
      ...(contour === 'dev' ? [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] : []),
    ] }];
  },
};
export default config;
