import type {Profile} from './types';
export type Tier = 'bronze'|'silver'|'gold'|'platinum'|'diamond'|'master';
export type RankedProgress = {seasonId:number|null; endsAt:number|null; played:number; total:number; calibrated:boolean; tier:Tier|null};
export type EarnedBadge = {seasonId:number; endedAt:number; rating:number; played:number; tier:Tier|null};
export function ratingTier(rating:unknown):Tier|null;
export function rankedProgress(profile:Partial<Profile>|null|undefined,placements?:number):RankedProgress|null;
export function earnedSeasonBadge(profile:Partial<Profile>|null|undefined):EarnedBadge|null;
export function rankedWords(locale:string):Record<string,string>;
