import 'server-only';
import { cookies } from 'next/headers';
import { portalConfig } from './security.mjs';
import { LINK_TOKEN, ekzaConfig, ekzaCookieNames } from './ekza-link.mjs';
import { readLibrary } from './market-server.mjs';
import type { EkzaSession } from './market-types';

/** First paint of the Ekza sign-in state; the token is read here and never rendered. */
export async function initialEkzaSession(): Promise<EkzaSession> {
  let secure: boolean, registry: string;
  try { secure = portalConfig().secure; registry = ekzaConfig().registry; } catch { return { state: 'unavailable' }; }
  const token = (await cookies()).get(ekzaCookieNames(secure).link)?.value;
  if (!token) return { state: 'guest' };
  if (!LINK_TOKEN.test(token)) return { state: 'expired' };
  return readLibrary(registry, token);
}
