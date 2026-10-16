export type Contour = "production" | "dev";
export const CONTOUR_VARIABLE: "OMOBA_CONTOUR";
export const DEFAULT_CONTOUR: "production";
export const DEV_ACCOUNT_API_ORIGIN: "https://account.dev.omoba.io";
export const CONTOURS: Readonly<Record<Contour, Readonly<{ registry: string; studio: string; portal: string; site: string }>>>;
export function isLoopbackHost(hostname: string): boolean;
export function isDevContourHost(hostname: unknown): boolean;
export function isProductionContourHost(hostname: unknown): boolean;
export function contourName(env?: Record<string, string | undefined>): Contour;
export function foreignOrigin(contour: Contour, url: URL): string | null;
export function contourServiceOrigin(
  raw: string | undefined,
  contour: Contour,
  service: "registry" | "studio",
  allowLocal: boolean,
  label: string,
): string;
export function requestHostname(value: string | null | undefined): string;
export function contourHostProblem(contour: Contour, hostname: unknown): string | null;
export function robotsTxt(contour: Contour): { status: 200; body: string } | { status: 404; body: null };
