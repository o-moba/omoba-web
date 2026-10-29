import type { NextRequest } from 'next/server';
import { vkStart } from '@/lib/vk-id.mjs';
import { fail, redirectWith, vkContext } from '@/lib/vk-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * `GET /api/auth/vk/start?method=vkid|ok_ru|mail_ru&returnTo=<allowlisted path>`:
 * a fresh state + PKCE verifier in the HttpOnly attempt cookie, then 302 to VK ID.
 */
export async function GET(request: NextRequest) {
  const context = vkContext(request);
  if (!('clientId' in context)) return context;
  if (request.nextUrl.search.length > 2048) return fail('invalid_query', 400);
  const params = request.nextUrl.searchParams;
  const result = vkStart({
    clientId: context.clientId,
    origin: context.config.origin,
    names: context.names,
    features: context.features,
    method: params.get('method'),
    returnTo: params.get('returnTo'),
  });
  if ('code' in result) return fail(result.code, result.status);
  return redirectWith(result.location, context.config.origin, result.cookies, context.config.secure);
}
