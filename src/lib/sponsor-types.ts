import type { PreviewAsset } from './market-types';

export type Sculpture = PreviewAsset & {
  kind: 'map_prop'; id: string; revisionId: string; creator: string;
  description: string; license: { text: string; attribution: string };
};
export type Placement = {
  id: string; slotId: string; assetId: string; revisionId: string;
  renditionSha256: string; renditionBytes: number; renditionUrl: string;
  title: string; credit: string; startsAt: string | null; expiresAt: string | null;
};
export type OwnPlacement = Placement & {
  project: 'omoba'; status: 'pending' | 'active' | 'expired' | 'rejected' | 'cancelled' | 'revoked';
  paymentMode: 'free'; createdAt: string; reason: string;
};
export type PlacementRequest = {
  project: 'omoba'; slotId: string; assetId: string; revisionId: string;
  renditionSha256: string; title: string; credit: string;
  rightsAccepted: true; idempotencyKey: string;
};
export type Slot = { id: string; name: string; durationSeconds: 86400; enabled: boolean; current: Placement | null };
export type SponsorState = { state: 'ready'; serverNow: string; slots: Slot[]; models: Sculpture[]; skipped: number } | { state: 'unavailable' };
export type SponsorSession = { state: 'connected'; items: OwnPlacement[] } | { state: 'guest' | 'expired' | 'unavailable' };
