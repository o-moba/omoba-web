import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cache } from 'react';
import { LegalDocumentView } from '@/components/legal';
import { LEGAL_DIR, legalDocumentFile, parseLegalDocument, type LegalDocumentName } from '@/lib/legal.mjs';
import { assertMarket, marketLegal } from '@/lib/market-profile.mjs';
import { contourSiteUrl } from '@/lib/navigation.mjs';

/**
 * The market's document of its current legal version, read from
 * `legal/<market>/<version>/<name>.md` (traced into the standalone build by
 * next.config.ts), or null when the market has none (global, cn). A file whose
 * version differs from the market's table refuses to render (fail closed): the page
 * must show exactly the version the game asks players to accept.
 */
export const loadLegalDocument = cache(async (name: LegalDocumentName) => {
  const { market } = assertMarket();
  const legal = marketLegal(market);
  const file = legalDocumentFile(market, legal, name);
  if (!file) return null;
  // Scoped to the legal folder, so the build traces only it (next.config.ts includes it too).
  const document = parseLegalDocument(await readFile(join(process.cwd(), 'legal', file), 'utf8'));
  if (document.meta.version !== legal.version)
    throw new Error('legal: ' + LEGAL_DIR + '/' + file + ' is version ' + document.meta.version + ' but the market asks for ' + legal.version);
  return document;
});

export async function legalMetadata(name: LegalDocumentName): Promise<Metadata> {
  const document = await loadLegalDocument(name);
  return document ? { title: document.meta.title + ' · OMOBA' } : {};
}

/** `/privacy`, `/terms`, `/offer`: public, no account call; 404 where the market has no such document. */
export async function LegalPage({ name }: { name: LegalDocumentName }) {
  const document = await loadLegalDocument(name);
  if (!document) notFound();
  return <LegalDocumentView name={name} document={document} siteUrl={contourSiteUrl()} />;
}
