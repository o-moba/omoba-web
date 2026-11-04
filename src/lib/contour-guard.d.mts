import type { Contour } from "./contour.mjs";
export const URL_VARIABLES: readonly string[];
export function contourProblems(env?: Record<string, string | undefined>): string[];
export function assertContour(env?: Record<string, string | undefined>): Contour;
export function assertBuiltContour(built: string | undefined, running: Contour): void;
export function assertContourHost(contour: Contour, hostname: string | null | undefined): void;
