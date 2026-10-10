import { initialAccount } from '@/lib/server-api';
import Portal from '@/components/portal';
import { redirect } from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{path?:string[]}>}) {
  if (!(await params).path?.length) redirect('/workshop');
  const initial=await initialAccount();
  return <Portal initialAccount={initial.account} initiallyUnavailable={initial.unavailable} accountDisabled={initial.disabled === true}/>;
}
