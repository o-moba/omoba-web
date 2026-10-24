'use client';
import { createContext, useContext } from 'react';

export type Market = 'global' | 'ru' | 'cn';
/** `vkSignIn` here means "offer the VK ID buttons": the feature is on and its app id is set. */
export type ClientFeatures = { ekza: boolean; supporter: boolean; vkSignIn: boolean };
export type MarketValue = { market: Market; features: ClientFeatures };

// Outside the provider nothing optional is offered (fail closed).
const MarketContext = createContext<MarketValue>({ market: 'global', features: { ekza: false, supporter: false, vkSignIn: false } });

/** The server's market (root layout), so every page hides what this market does not serve. */
export function MarketProvider({ market, features, children }: MarketValue & { children: React.ReactNode }) {
  return <MarketContext.Provider value={{ market, features }}>{children}</MarketContext.Provider>;
}

export function useMarket(): MarketValue {
  return useContext(MarketContext);
}
