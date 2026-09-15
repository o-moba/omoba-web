import { initialAccount } from '@/lib/server-api';
import Portal from '@/components/portal';
export const dynamic='force-dynamic';
export default async function Page() {
  const initial=await initialAccount();
  return <Portal initialAccount={initial.account} initiallyUnavailable={initial.unavailable}/>;
}
