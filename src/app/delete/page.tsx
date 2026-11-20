import { DeletionPage, deletionMetadata } from '@/components/legal-page';
// The market (and so the page and its contact) is read at runtime, like every page.
export const dynamic = 'force-dynamic';
export const generateMetadata = () => deletionMetadata();
export default function Page() {
  return <DeletionPage />;
}
