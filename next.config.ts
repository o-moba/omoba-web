import type { NextConfig } from 'next';
import { assertContour } from './src/lib/contour-guard.mjs';

// OMOBA_CONTOUR (production|dev, default production). A misconfigured contour fails
// the build and `next dev`; see docs/vercel.md#contours.
const contour = assertContour(process.env);
const config: NextConfig = {
  poweredByHeader: false,
  // The server refuses to start in a contour other than the one it was built for.
  env: { OMOBA_BUILT_CONTOUR: contour },
  // Ship route styles in the initial HTML, including page-specific stylesheets.
  experimental: { inlineCss: true },
  output: 'standalone',
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
