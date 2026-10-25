import type { MarketLegal } from './market-profile.mjs';

export type LegalDocumentName = 'privacy' | 'terms' | 'offer';
export type LegalLinkKey = 'privacy' | 'terms' | 'offer' | 'support' | 'source' | 'vk' | 'telegram';
export type LegalLink = { key: LegalLinkKey; href: string; external: boolean };
export type Inline =
  | { type: 'text'; value: string }
  | { type: 'strong'; children: Inline[] }
  | { type: 'code'; value: string }
  | { type: 'link'; href: string; children: Inline[] }
  | { type: 'placeholder'; value: string };
export type Block =
  | { type: 'h2' | 'h3' | 'p' | 'note'; id?: string; inline: Inline[] }
  | { type: 'ul'; items: Inline[][] }
  | { type: 'ol'; start: number; items: Inline[][] }
  | { type: 'table'; head: Inline[][]; rows: Inline[][][] };
export type LegalMeta = { title: string; version: string; status: 'draft' | 'final'; effective: string | null; review: string | null };
export type LegalDocument = { meta: LegalMeta; blocks: Block[] };

export const LEGAL_PAGES: Readonly<Record<LegalDocumentName, string>>;
export const LEGAL_VERSION: RegExp;
export const LEGAL_DIR: 'legal';
export function legalDocumentFile(market: string, legal: MarketLegal, name: LegalDocumentName): string | null;
export function legalSourceUrl(legal: MarketLegal, version?: string | null): string | null;
export function legalLinks(legal: MarketLegal, features: { supporter: boolean }): LegalLink[];
export function signInNotice(legal: MarketLegal): { terms: string; privacy: string; version: string | null } | null;
export function parseInline(text: string, nested?: boolean): Inline[];
export function parseLegalDocument(source: string): LegalDocument;
export function legalPlainText(document: { blocks: Block[] }): string;
