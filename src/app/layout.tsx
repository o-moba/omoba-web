import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title:'Omoba · Player Portal',description:'Your Open Moba profile, match history and friends.',robots:{index:false,follow:false} };
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="ru"><body>{children}</body></html>;
}
