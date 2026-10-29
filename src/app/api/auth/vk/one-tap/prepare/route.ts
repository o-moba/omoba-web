import { NextResponse, type NextRequest } from 'next/server';
import { marketName } from '@/lib/market-profile.mjs';
import { applyCookies, vkOneTapStart } from '@/lib/vk-id.mjs';
import { fail, noStore, vkContext, vkJsonBody } from '@/lib/vk-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  if (marketName() !== 'ru') return fail('not_found', 404);
  const context = vkContext(request);
  if (!('clientId' in context)) return context;
  const body = await vkJsonBody(request, context, ['returnTo']);
  if (body instanceof NextResponse) return body;
  if (body.returnTo !== undefined && typeof body.returnTo !== 'string') return fail('invalid_request', 400);
  const result = vkOneTapStart({ clientId: context.clientId, origin: context.config.origin,
    names: context.names, features: context.features, returnTo: body.returnTo as string | null ?? null });
  const response = NextResponse.json(result.configuration, { headers: noStore });
  applyCookies(response.cookies, result.cookies, context.config.secure);
  return response;
}
