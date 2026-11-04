export const BROWSER_GAME_MANIFEST: '/game/BUILD_INFO.json';
export const BROWSER_GAME_ENTRY: '/game/index.html';
export const BROWSER_GAME_READY: 'omoba-practice-ready';
export const BROWSER_GAME_ERROR: 'omoba-practice-error';
export function validBrowserGameManifest(value: unknown): value is {mode:'local-practice'; entry:'index.html';version:string;commit:string};
export function browserGameMessage(event: {source:unknown; origin:string; data:unknown}, frameWindow: unknown, origin:string): 'ready'|'error'|null;
