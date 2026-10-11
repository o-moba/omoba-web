import type { EkzaDevice, OwnedAsset } from "./market-types";
export const DEFAULT_REGISTRY_URL: string;
export const DEFAULT_STUDIO_URL: string;
export const EKZA_LINK_SCOPE: "library-claim";
export const MAX_LINK_SECONDS: number;
export const LINK_TOKEN: RegExp;
export function ekzaConfig(env?: Record<string, string | undefined>): { registry: string; studio: string };
export function studioOrigin(env?: Record<string, string | undefined>): string;
export function ekzaCookieNames(secure: boolean): { link: string; device: string; csrf: string };
export type EkzaRoute =
  | { action: "csrf" | "library" | "start" | "poll" | "sign-out" }
  | { action: "claim" | "unclaim"; assetId: string };
export function ekzaRoute(path: string, method: string): EkzaRoute | null;
export function safeVerificationUrl(value: unknown, studio: string, userCode: string): string | null;
export function parseDeviceStart(
  value: unknown,
  studio: string,
  now?: number,
): { deviceCode: string; maxAge: number; browser: EkzaDevice };
export function parsePoll(
  value: unknown,
  now?: number,
):
  | { status: "pending" }
  | { status: "approved"; scope: string | null; accessToken: string; maxAge: number; username: string; expiresAt: string };
export function parseLibrary(value: unknown): { username: string; expiresAt: string; owned: OwnedAsset[] };
export function upstreamFailure(
  action: string,
  status: number,
  body: unknown,
): { status: number; code: string; clearLink?: boolean; clearDevice?: boolean };
