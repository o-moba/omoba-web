export type Release = { platform: string; architecture: string; version: string; url: string; sha256: string; size_bytes: string; published_at: string; instructions: string; test_status: string };
export const RELEASE_PLATFORMS: Readonly<Record<string, string>>;
export const DIRECT_CHANNEL: 'direct';
export const RELEASE_STATUS_LABELS: Readonly<Record<string, Readonly<Record<'en' | 'ru' | 'zh', string>>>>;
export function directRelease(value: unknown): Release | null;
export function pageReleases(catalog: unknown): Release[];
export function releaseSize(bytes: string | number, locale: 'en' | 'ru' | 'zh'): string;
export function releaseStatus(status: string, locale: 'en' | 'ru' | 'zh'): string;
export function releasePlatform(platform: string): string;
