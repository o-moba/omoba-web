'use client';
import { createContext, useContext } from 'react';
import { useLocale } from '@/components/locale-provider';

type Contour = 'production' | 'dev';
const ContourContext = createContext<Contour>('production');

/** The server's contour (root layout), so every header can mark a dev deployment. */
export function ContourProvider({ contour, children }: { contour: Contour; children: React.ReactNode }) {
  return <ContourContext.Provider value={contour}>{children}</ContourContext.Provider>;
}

/** Visible in every header of the dev contour; renders nothing in production. */
export function ContourBadge() {
  return useContext(ContourContext) === 'dev' ? <DevBadge /> : null;
}

function DevBadge() {
  const { t } = useLocale();
  const label = t('Development environment: test data, not the live OMOBA site');
  return <span className="contour-badge" data-contour-badge="dev" title={label} aria-label={label}>DEV</span>;
}
