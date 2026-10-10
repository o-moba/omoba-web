import { publicSiteUrl } from "@/lib/navigation.mjs";
import { initialAccount } from '@/lib/server-api';
import Portal from '@/components/portal';
import { redirect } from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{path?:string[]}>}) {
  if (!(await params).path?.length) redirect('/workshop');
  const initial=await initialAccount();
  return <Portal siteUrl={publicSiteUrl(process.env.OMOBA_SITE_URL,process.env.NODE_ENV)} initialAccount={initial.account} initiallyUnavailable={initial.unavailable} accountDisabled={initial.disabled === true}/>;
}
