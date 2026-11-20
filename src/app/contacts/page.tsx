import type { Metadata } from 'next';
import { ContactsPage } from '@/components/legal-page';
import { getLocale } from '@/lib/locale-server';
import { legalTranslations } from '@/lib/legal-translations';
// The market (and so the offer) is read at runtime, like every legal page.
export const dynamic = 'force-dynamic';
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const entry = legalTranslations['Contacts and requisites'];
  const title = locale === 'ru' ? entry.ru : locale === 'zh' ? entry.zh : 'Contacts and requisites';
  return { title: title + ' · OMOBA' };
}
export default function Page() {
  return <ContactsPage />;
}
