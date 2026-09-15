import 'server-only';
import { cookies, headers } from 'next/headers';
import { isIP } from 'node:net';
import { cookieNames, portalConfig } from './security.mjs';

export async function initialAccount() {
  try {
    const config = portalConfig();
    const token = (await cookies()).get(cookieNames(config.secure).session)?.value;
    if (!token) return { account: null, unavailable: false };
    const forwarded:Record<string,string>={ Authorization: 'Bearer '+token };
    if(process.env.OMOBA_TRUST_LOOPBACK_PROXY==='1'){const ip=(await headers()).get('x-real-ip');if(!ip||!isIP(ip))throw new Error('Trusted ingress required');forwarded['X-Real-IP']=ip;}
    const response = await fetch(config.api+'/v1/me', {
      headers: forwarded, cache: 'no-store', signal: AbortSignal.timeout(8000),
    });
    if (response.status === 401) return { account: null, unavailable: false };
    if (!response.ok) return { account: null, unavailable: true };
    return { account: await response.json(), unavailable: false };
  } catch { return { account: null, unavailable: true }; }
}
