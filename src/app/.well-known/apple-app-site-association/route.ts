import { assertContour } from '@/lib/contour-guard.mjs';
import { assertMarket } from '@/lib/market-profile.mjs';
import { iosAssociationResponse } from '@/lib/ios-universal-links.mjs';

export const dynamic = 'force-dynamic';
export function GET(request: Request) {
  assertContour();
  assertMarket();
  return iosAssociationResponse(request);
}
export const HEAD = GET;
