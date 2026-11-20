# Website languages

The portal and landing support English (`en`), Russian (`ru`) and Simplified
Chinese (`zh`, rendered as `zh-CN` in HTML). Server rendering negotiates the first
response using an explicit `omoba_locale` cookie, weighted `Accept-Language`,
then Vercel country (`CN`, `TW`, `HK`, `MO` → Chinese; `RU` → Russian), then English.
A browser's supported language takes priority over the country fallback.

The visible language selector writes a one-year, SameSite=Lax preference cookie.
On `omoba.io` and its subdomains its domain is `.omoba.io`, allowing a choice on
one website to follow the visitor to the other. Localhost and preview deployments
use host-only cookies. The dev contour (`OMOBA_CONTOUR=dev`, and any `dev.omoba.io` or
`*.dev.omoba.io` host) writes a host-only `omoba_locale_dev` cookie instead and never
`Domain=.omoba.io`, so a choice on dev cannot change production's, and production's
shared cookie, which a dev host also receives, cannot shadow it. The server there reads
`omoba_locale_dev` first and production's `omoba_locale` only as a read-only starting
point. HTTPS cookies include Secure. This cookie contains only a language code;
account/session cookies retain their existing security behavior.

Client components use `useLocale()` or `<LanguageSelector />` from
`src/components/locale-provider.tsx`. Existing account words live in
`src/lib/i18n.ts`; creator/catalogue/workshop source translations live in
`src/lib/creator-translations.ts`; market copy lives in `src/lib/market-translations.ts`.
Add Russian and Chinese entries together. Registry item names, creators and licences
are shown as published.
Translate display strings at render time so an existing notice follows a new
language choice. Canonical IDs, export schema fields and user-authored names
must remain unchanged.

The game Account API currently accepts only RU/EN in `Settings.locale`. Website
language selection is independent and remains available after sign-in. Choosing
Chinese must not send an unsupported `zh` value while saving account privacy or
time-zone settings. The landing uses the same cookie contract.

`npm test` includes negotiation, cookie scope and translation coverage checks.
Existing browser scenarios specify their expected locale explicitly.
