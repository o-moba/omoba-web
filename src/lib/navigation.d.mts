export const DEFAULT_SITE_URL: string;
export function portalReturnTo(value: unknown): string;
export function portalLoginHref(destination: unknown): string;
export function publicSiteUrl(raw: string | undefined, environment: string | undefined, fallback?: string): string;
export function contourSiteUrl(env?: Record<string, string | undefined>): string;
