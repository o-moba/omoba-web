import type { MetadataRoute } from 'next';
import { notFound } from 'next/navigation';
import { assertContour } from '@/lib/contour-guard.mjs';
import { robotsTxt } from '@/lib/contour.mjs';

// Read the runtime contour on every request (a misconfigured one answers 500).
export const dynamic = 'force-dynamic';

/** The dev contour disallows every crawler; production keeps no robots.txt (404). */
export default function robots(): MetadataRoute.Robots {
  if (robotsTxt(assertContour()).status !== 200) notFound();
  return { rules: { userAgent: '*', disallow: '/' } };
}
