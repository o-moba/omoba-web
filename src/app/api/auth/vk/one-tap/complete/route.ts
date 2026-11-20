import { NextResponse, type NextRequest } from 'next/server';
import { marketName } from '@/lib/market-profile.mjs';
import { applyCookies, vkCallback } from '@/lib/vk-id.mjs';
import { fail, noStore, upstreamHeaders, vkContext, vkJsonBody } from '@/lib/vk-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  if (marketName() !== 'ru') return fail('not_found', 404);
  const context = vkContext(request);
  if (!('clientId' in context)) return context;
  const body = await vkJsonBody(request, context, ['code', 'device_id', 'state']);
  if (body instanceof NextResponse) return body;
  if (!['code', 'device_id', 'state'].every(key => typeof body[key] === 'string')) return fail('invalid_request', 400);
  const headers = upstreamHeaders(request);
  if (!headers) return fail('configuration_unavailable', 503);
  const result = await vkCallback({ api: context.config.api, origin: context.config.origin,
    names: context.names, features: context.features, query: new URLSearchParams(body as Record<string, string>),
    cookie: request.cookies.get(context.names.vk)?.value, headers, flow: 'one-tap' });
  const response = NextResponse.json({ location: result.location }, { headers: noStore });
  applyCookies(response.cookies, result.cookies, context.config.secure);
  return response;
}
