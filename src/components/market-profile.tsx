'use client';
import { createContext, useContext } from 'react';
import { MARKET_LANDING, MARKET_LEGAL, type MarketLanding, type MarketLegal, type PaymentProvider } from '@/lib/market-profile.mjs';

export type Market = 'global' | 'ru' | 'cn';
/** `vkSignIn` here means "offer the VK ID buttons": the feature is on and its app id is set. */
export type ClientFeatures = { ekza: boolean; supporter: boolean; vkSignIn: boolean };
/**
 * `legal` is the market's legal table (`marketLegal`, LR-06): documents, source, channels.
 * `landing` says whether `/` is the market's landing and how the workshop is offered
 * (`marketLanding`, LR-22).
 * `providers` are who sells Hero access here (`paymentProviders`: global Apple and
 * Solana, RU YooKassa; LR-67). `supporterLinks` is the one switch for Supporter
 * navigation and the `/supporter`, `/supporters` and `/offer` links (`supporterLinks`;
 * LR-68 turns it off for pages opened from a store build).
 */
export type MarketValue = { market: Market; features: ClientFeatures; legal: MarketLegal; landing: MarketLanding; providers: readonly PaymentProvider[]; supporterLinks: boolean };

// Outside the provider nothing optional is offered (fail closed).
const MarketContext = createContext<MarketValue>({ market: 'global', features: { ekza: false, supporter: false, vkSignIn: false }, legal: MARKET_LEGAL.global, landing: MARKET_LANDING.global, providers: [], supporterLinks: false });

/** The server's market (root layout), so every page hides what this market does not serve. */
export function MarketProvider({ market, features, legal, landing, providers, supporterLinks, children }: MarketValue & { children: React.ReactNode }) {
  return <MarketContext.Provider value={{ market, features, legal, landing, providers, supporterLinks }}>{children}</MarketContext.Provider>;
}

export function useMarket(): MarketValue {
  return useContext(MarketContext);
}
