export const IOS_LINKS: Readonly<Record<'production' | 'dev', Readonly<{ host: string; appID: string }>>>;
export const IOS_RETURN_PATH: '/auth';
export function iosReturnUrl(contour?: 'production' | 'dev'): string;
export function canOfferIosReturn(market: string, phase: string, userAgent: string, platform?: string, touchPoints?: number): boolean;
export function iosAssociation(appID: string): { applinks: { details: { appIDs: string[]; components: { '/': string }[] }[] } };
export function iosAssociationResponse(request: Request, env?: Record<string, string | undefined>): Response;
