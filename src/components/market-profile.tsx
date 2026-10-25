'use client';
import { createContext, useContext } from 'react';
import { MARKET_LEGAL, type MarketLegal } from '@/lib/market-profile.mjs';

export type Market = 'global' | 'ru' | 'cn';
/** `vkSignIn` here means "offer the VK ID buttons": the feature is on and its app id is set. */
export type ClientFeatures = { ekza: boolean; supporter: boolean; vkSignIn: boolean };
/** `legal` is the market's legal table (`marketLegal`, LR-06): documents, source, channels. */
export type MarketValue = { market: Market; features: ClientFeatures; legal: MarketLegal };

// Outside the provider nothing optional is offered (fail closed).
const MarketContext = createContext<MarketValue>({ market: 'global', features: { ekza: false, supporter: false, vkSignIn: false }, legal: MARKET_LEGAL.global });

/** The server's market (root layout), so every page hides what this market does not serve. */
export function MarketProvider({ market, features, legal, children }: MarketValue & { children: React.ReactNode }) {
  return <MarketContext.Provider value={{ market, features, legal }}>{children}</MarketContext.Provider>;
}

export function useMarket(): MarketValue {
  return useContext(MarketContext);
}
