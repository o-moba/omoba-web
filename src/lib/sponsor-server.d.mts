import type { SponsorSession, SponsorState } from './sponsor-types';
export function loadSponsor(env?: Record<string, string | undefined>): Promise<SponsorState>;
export function readSponsorSession(registry: string, token: string): Promise<SponsorSession>;
