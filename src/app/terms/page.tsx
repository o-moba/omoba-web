import { LegalPage, legalMetadata } from '@/components/legal-page';
// The market (and so the document) is read at runtime, like every page.
export const dynamic = 'force-dynamic';
export const generateMetadata = () => legalMetadata('terms');
export default function Page() {
  return <LegalPage name="terms" />;
}
