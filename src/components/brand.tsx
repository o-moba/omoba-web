import { ContourBadge } from '@/components/contour';

/** The game-owned mark stays intact; section names are navigation, not sub-brands. */
export function Brand({ section }: { section: string }) {
  return (
    <span className="omoba-brand">
      <img src="/brand/omoba-logo.png" alt="" width={64} height={64} />
      <span>
        <b>OMOBA</b>
        <small>{section}</small>
      </span>
      <ContourBadge />
    </span>
  );
}
