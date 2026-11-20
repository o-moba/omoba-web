import type { VkOneTapConfiguration } from './vk-id.mjs';
export function oneTapConfiguration(value: unknown, origin: string): VkOneTapConfiguration;
export function oneTapPayload(value: unknown, state: string): { code: string; device_id: string; state: string };
export function localSignInLocation(value: unknown, origin: string): string;
