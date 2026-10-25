# Markets

One build of the portal serves one **market**, the same axis as the game's separate builds (`shared/src/market.rs`, `scripts/release.py --market`). Not to be confused with `/market`, the Ekza item market ([Market](market.md)), which is one of the surfaces a market may switch off.

| Market | `OMOBA_MARKET` | For | Ekza | Supporter (payments) | Sign-in |
|---|---|---|---|---|---|
| `global` | unset, empty or `global` | Europe and the rest of the world; today's product | on | on | game pairing |
| `ru` | `ru` | Russia: a free game, no Ekza ecosystem, no payments | off | off | VK ID (VK, OK, Mail.ru) + game pairing |
| `cn` | `cn` | mainland China: free, no Ekza, no payments; providers not decided | off | off | game pairing |

The market is independent of the contour (`OMOBA_CONTOUR`, [Contours](vercel.md#contours)): an RU build can be the production or the dev contour. Both axes are checked separately and neither falls back to the other.

## Environment

All server-only; none is a `NEXT_PUBLIC_` variable. Client components receive the market and its features from the root layout as React context (`src/components/market-profile.tsx`), like the contour.

| Variable | Values | Meaning |
|---|---|---|
| `OMOBA_MARKET` | `global` (default when unset or empty), `ru`, `cn` | The market. Exact, lower case; `RU`, `ru `, `eu` fail. |
| `OMOBA_FEATURE_EKZA` | empty (preset), `on`, `off` | Override the market's Ekza feature. |
| `OMOBA_FEATURE_SUPPORTER` | empty (preset), `on`, `off` | Override paid Hero Supporter. |
| `OMOBA_FEATURE_VK_SIGN_IN` | empty (preset), `on`, `off` | Override Sign in with VK ID. |
| `OMOBA_VKID_CLIENT_ID` | empty, or the numeric VK ID app id | Needed for VK ID buttons and routes; a non-numeric value fails. |

Names, values and semantics equal `market.rs` (`Market::parse`, `Features::resolve`): `on`/`off` are exact; anything else (`yes`, `OFF`, `1`) is an error. The presets:

| Market | `ekza` | `supporter` | `vk_sign_in` |
|---|---|---|---|
| `global` | on | on | off |
| `ru` | off | off | on |
| `cn` | off | off | off |

Fail closed, like the contour (`src/lib/market-profile.mjs`):

- **Build.** `next.config.ts` calls `assertMarket` and fails `next build`/`next dev` with `OMOBA market misconfigured, refusing to build or serve (fail closed)` and one line per problem. It inlines the build's line, for example `OMOBA_BUILT_MARKET=ru (ekza off, supporter off, vk_sign_in on)` (the same text as `market.rs` `describe`).
- **Startup.** `src/instrumentation.ts` refuses to serve when the runtime market or any feature differs from the built line (`OMOBA market mismatch …; rebuild`): every request answers 500 and the log says why. Rebuild after changing any `OMOBA_MARKET` / `OMOBA_FEATURE_*` value.
- **Each request.** The root layout calls `assertMarket` again and renders no page on a bad value.

## What each feature switches

**Ekza off** (`ru`, `cn`):

- `/market`, `/sponsor` and `/creators` answer the 404 page (`notFound()`).
- `/api/ekza/*` and `/api/sponsor/*` answer `404 {"code":"not_found"}` before reading a cookie or contacting the Registry.
- The Account API BFF allowlist (`allowedPath` in `src/lib/security.mjs`) refuses `me/ekza-library*`.
- The sidebar, mobile nav and guest card show no Creators, Market or Community sculptures; the workshop shows no Ekza library panel, no asset library, market or Studio link, and does not request `me/ekza-library`. Return destinations (`portalReturnTo`) drop those pages.

**Supporter off** (`ru`, `cn`):

- `/supporter` and `/supporters` answer the 404 page.
- The allowlist refuses `me/supporter*` and `supporters`.
- No Hero / Supporters nav entry, no Hero button on the profile, no "Meet the supporters" link and no Hero badge on player cards.

**VK sign-in on** (`ru`) **and** `OMOBA_VKID_CLIENT_ID` set: the login view shows **Войти через VK ID**, **Одноклассники** and **Mail.ru** above the game pairing (which stays as the secondary path); the allowlist adds `POST auth/social/attach`, `POST auth/social/ticket` and `DELETE me/social/vk`. Without the app id the buttons are hidden and `/api/auth/vk/*` answers 404.

**Language.** Without a manual choice (the language cookie always wins) and without a supported browser language, `ru` falls back to Russian and `cn` to Chinese; neither uses the IP-country heuristic. `global` is unchanged (browser language, then country, then English).

## Sign in with VK ID

VK, OK and Mail.ru are one **VK ID app**: a public client (OAuth 2.1 with PKCE S256, no client secret). The portal never exchanges the code; the RU Account API does, and verifies the identity.

1. `GET /api/auth/vk/start?method=vkid|ok_ru|mail_ru&returnTo=<path>`: 32 random bytes of `state` (hex) and a 43-character `code_verifier` go into one HttpOnly, SameSite=Lax cookie (`__Host-omoba-vk` on HTTPS, `omoba-vk` on loopback HTTP; 600 s; `Path=/`), together with the method and the destination. `returnTo` must pass the navigation allowlist, including `/connect?code=XXXXXXXX` (8 × `[A-Z2-9]`); anything else becomes `/me`. Then 302 to `https://id.vk.ru/authorize` with `response_type=code`, `client_id`, `redirect_uri`, `state`, `code_challenge`, `code_challenge_method=S256`, `scope=vkid.personal_info` and `provider=<method>`. `redirect_uri` is exactly `${OMOBA_PORTAL_ORIGIN}/api/auth/vk/callback`.
2. `GET /api/auth/vk/callback`: needs the attempt cookie and a constant-time equal `state`; the cookie is cleared on every outcome. A missing cookie, another state, `error=…`, or a missing `code` / `device_id` goes to `/login?signin=failed` (`cancelled` for `access_denied`) without an upstream request. Otherwise the portal sends `POST {OMOBA_ACCOUNT_API_URL}/v1/auth/social/vk` with `{"method","code","code_verifier","device_id","redirect_uri","state"}` server-to-server (the BFF's headers: trusted `X-Real-IP`, and the ingress key only for an API that is not on loopback; no redirects, 12 s, bodies never logged).
   - `{"state":"signed_in","session_token":<64 hex>,…}`: the normal session cookie (7 days), exactly as pairing `complete`; the pairing and CSRF cookies are cleared. Redirect to `returnTo`.
   - `{"state":"unlinked","social_ticket":<64 hex>,"display_name","expires_at"}`: an HttpOnly ticket cookie (`__Host-omoba-social`, up to 1800 s, never longer than `expires_at`). Redirect to `returnTo` (default `/me`, which then shows "finish registration in the game").
   - Errors go to `/login?signin=<reason>[&returnTo=…]` with a localized message: `400 invalid_request` → failed, `502 provider_rejected` → rejected, `503 provider_unavailable`, `409 session_limit`, `429 rate_limited`, `404 not_found` (VK not configured on the API) and anything else → unavailable.
3. Ticket routes through the BFF: `POST /api/auth/social/attach {"code"}` and `POST /api/auth/social/ticket {}`. The BFF injects `social_ticket` from its cookie; a browser body with any other field (in particular its own `social_ticket`) is refused with `400 invalid_request` before the API is called. A missing ticket cookie is `404 social_ticket_expired`. The page reads the ticket's display name server-side (`initialSocialTicket` in `src/lib/server-api.ts`); the ticket never reaches the page. Sign-out clears the ticket and attempt cookies too.
4. Settings shows the linked VK account from `GET me` → `social` (absent on older APIs: no linked account) and can unlink it with `DELETE me/social/vk` (`403 fresh_confirmation_required` asks for a fresh sign-in).

### `/connect?code=ABCD2345`

The page the game opens in the system browser after it created a device enrollment (8 characters, 5 minutes):

- no session, no ticket: the VK buttons with `returnTo=/connect?code=…` and a game-pairing link;
- a session: `POST me/devices/lookup {code}` → «Войти как {nickname} на устройстве «{label}»?» with the key fingerprint (first and last 8 hex characters) → `POST me/devices/approve {enrollment_id, public_key}` → «Готово. Вернитесь в игру и подтвердите вход». `403 fresh_confirmation_required` asks to sign in with VK again (back to this page); 404 means the code expired;
- an unlinked VK ticket: «VK «{display_name}» ещё не связан с профилем OMOBA…» → **Продолжить** → `POST auth/social/attach {code}` → «Вернитесь в игру и подтвердите».

Mutations use the usual CSRF proof. The only value in the URL is the enrollment code; no token, ticket or VK code ever is.

### Registering the VK ID app

One VK ID **web** app in the VK ID developer cabinet covers VK, OK and Mail.ru:

- trusted redirect URL: `${OMOBA_PORTAL_ORIGIN}/api/auth/vk/callback`, exactly (for example `https://<ru portal>/api/auth/vk/callback`);
- scope: `vkid.personal_info`;
- no client secret is used by the portal. The app id goes into `OMOBA_VKID_CLIENT_ID` on the portal; the Account API holds its own VK ID settings for the exchange.

## Hosting the RU portal

The RU portal handles Russian users' sign-in and talks to the RU Account API. Host it in Russia on the same host as that API, not on Vercel: build with the RU environment and run the existing standalone output (`output: 'standalone'`, `npm start` → `scripts/start.mjs`, which binds to loopback) behind the host's TLS ingress (Caddy).

The topology (the game repo's `ops/vps/ru/README.md#topology`, `portal.env.example`, `Caddyfile.ru`):

- Caddy serves `omoba.ru` and **overwrites** `X-Real-IP` with the browser's address;
- the portal calls the Account API directly on `http://127.0.0.1:40550`, with no portal ingress key, and forwards that `X-Real-IP` (`OMOBA_TRUST_LOOPBACK_PROXY=1` on the portal and on the API), so per-IP limits such as VK sign-in (30 per minute) stay per player;
- `account.omoba.ru` passes only the game's native routes and health; every portal route answers 403 there.

```sh
export OMOBA_MARKET=ru OMOBA_VKID_CLIENT_ID=<app id> OMOBA_PORTAL_ORIGIN=https://omoba.ru \
  OMOBA_ACCOUNT_API_URL=http://127.0.0.1:40550 OMOBA_TRUST_LOOPBACK_PROXY=1 OMOBA_ACCOUNT_MODE=enabled
npm run build
PORT=3010 npm start
```

The runtime environment must repeat the build's market and features (the server refuses otherwise). The server also refuses to serve the loopback API without `OMOBA_TRUST_LOOPBACK_PROXY=1`, or an API that is not on loopback without a 64-hex `OMOBA_ACCOUNT_INGRESS_KEY` (see the README). The `cn` market has no hosting or sign-in decided yet.

## Legal documents and links (LR-06)

Each market has a legal table, `MARKET_LEGAL` in `src/lib/market-profile.mjs`, read only through `marketLegal(market)` (the one place LR-68 switches to the runtime region). It mirrors the game's `scripts/markets.py` `Legal` and `shared/src/market.rs` `Market::legal` field for field (camelCase here):

| Field | `ru` | Used for |
|---|---|---|
| `version` | `0-draft` (the Russian drafts, LR-04) | the documents shown, the notice |
| `privacy`, `terms` | `https://omoba.ru/privacy`, `https://omoba.ru/terms` | `/privacy`, `/terms`, footer, sign-in notice |
| `offer` (portal only) | `https://omoba.ru/offer` | `/offer`; linked only with the Supporter feature |
| `source` | `https://github.com/o-moba/omoba-bevy/tree/v{version}-ru` | footer (the repository), each download card (the release's tag) |
| `supportEmail`, `communityVk`, `communityTelegram` | empty until the owner provides them (LR-21) | footer; hidden while empty |
| `ageRating` | `12+` (placeholder, LR-07) | the guest home and the portal footer (LR-22) |

`global` and `cn` have no table (every field null): no legal pages (`/privacy`, `/terms` and `/offer` answer 404), no notice, no legal links, footers as before.

**Pages.** `/privacy`, `/terms` and `/offer` render `legal/<market>/<version>/<name>.md` ([legal/README.md](../legal/README.md): format, and how to publish the counsel-approved texts). They are public and make no Account API call. A file whose front-matter `version` differs from the table refuses to render, so the page always shows the version the game asks players to accept. A `draft` shows the «Проект — требует проверки юристом» banner and «не вступила в силу»; a `final` document shows its effective date and review line. The documents are Russian; other page languages get a one-line note. `next.config.ts` traces `legal/**` into the standalone output.

**Links** (`src/lib/legal.mjs`, `src/components/legal.tsx`):

- the login card (under the VK ID buttons, or under game pairing) and `/connect` show «Входя, вы принимаете Пользовательское соглашение и соглашаетесь на обработку персональных данных в соответствии с Политикой обработки персональных данных» with both documents linked (`SignInLegalNotice`, needs both `terms` and `privacy`);
- the portal footer, the legal pages and the workshop footer list Privacy, Terms, the offer (only with the Supporter feature: the one switch for Supporter links, LR-67/LR-68), Support (`mailto:`), Source and the community (`LegalLinks`). On phones the portal footer, otherwise hidden, stays visible when it carries legal links;
- each download card links the source of that release (`v<version>-ru`, the tag `release.py catalog --market ru` requires).

The drafts list every data category the RU services process (Account API migrations 001-007, career store 001-004, in-memory chat, cookies, logs, backups), with retention; `tests/legal.test.mjs` keeps that coverage. The privacy policy and the user agreement carry no payment-method details: those live in the offer, so store builds can leave it out.

## RU landing: the guest home (LR-22)

The RU landing is the RU portal's own guest home at `/` (`https://omoba.ru`), hosted in Russia with the portal and without foreign analytics; the omoba.io landing is not changed. Each market's landing is in `MARKET_LANDING` (`src/lib/market-profile.mjs`), read only through `marketLanding(market)` (the one place LR-68 switches to the runtime region):

| Market | `home` | `workshop` |
|---|---|---|
| `global`, `cn` | `site`: the OMOBA website; `/` opens the workshop, as before | `listed` |
| `ru` | `portal`: `/` is the guest home | `experimental` |

Where `home` is `portal`:

- **`/` signed out** renders the guest home (`src/components/guest-home.tsx`): the hero classes counted from the game's catalog snapshot (`public/asset-catalog/catalog.json`, exported from the game's `shared/assets/catalog`, `src/lib/landing-server.ts`), the Verdant Arena and the four ways to play named as the game names them (Ranked, Casual PvP, vs Bots, Offline practice; the game's `client/i18n` `queue.json` and `home.json`), the release status, the age sign from the legal table, the downloads and how progress is kept (VK ID in the game). The footer carries the legal, source, support and community links (`LegalLinks`) and the age sign. No donate, wallet, crypto, Solana or Ekza content appears on any RU page (`tests/ru-landing.e2e.mjs`).
- **`/` signed in** redirects to `/me`.
- **Downloads** come from the Account API's `GET /v1/releases` (the market's `releases.json`, written by the game's `release.py catalog --market ru`), read on the server for `/` and in the browser for `/download` (`src/lib/releases.mjs`): only `direct` entries of Windows, macOS, Linux and Android with an https link, a SHA-256 and a size, the newest per platform, in that order. Each card shows the version, the status in the page language («Открытая бета» → "Open beta"), the size in МБ/MB, the package link, the release's source tag and the SHA-256 in plain sight. IPFS mirrors, store channels and iOS packages are never offered. `/download?platform=<p>` (the game's update button) lists that platform first.
- **Search.** `/` is indexable in production (`robots: index, follow`) with a canonical link and `hreflang` = the market's page language (`ru`); every other page stays `noindex` and the dev contour stays `noindex` everywhere. Adding the site to Yandex Webmaster is the owner's step once `omoba.ru` answers.
- **`OMOBA_SITE_URL`**: the "OMOBA website" links lead to `/` (the brand, the footer's «OMOBA», the workshop and legal pages); the sidebar shows no external website button. Leave `OMOBA_SITE_URL` unset: a value fails the build and the server start (`marketProblems`), so no RU page can link another market's website.
- **Workshop** (`experimental`): `/workshop` shows «Эксперимент: мастерская классов — прототип…», the sidebar entry carries an «эксперимент» tag, and the phone navigation leaves it out (`mobileNav`).

## Verification

- `npm test` includes `tests/market-profile.test.mjs` (parsing, presets, overrides, fail closed, built-line check, allowlist and nav per market, return destinations, language fallback, `next.config`), `tests/vk-id.test.mjs` (authorize URL, PKCE against the RFC 7636 vector, cookie attributes, callback with a stubbed Account API, ticket injection) and `tests/legal.test.mjs` (the legal table against the game's values, footer and notice links per market, the document format, version and data-category coverage of the drafts). With `OMOBA_GAME_MARKETS_PY=<game repo>/scripts/markets.py` it also compares the table with the game's file.
- `tests/landing.test.mjs` (in `npm test`) covers the landing table, the RU site link and the `OMOBA_SITE_URL` refusal, the phone navigation, the catalog filter, sizes and status labels, the counted class claim with Russian plurals and the absence of donate, wallet, crypto and Ekza text in the guest home and its translations. With `OMOBA_GAME_HEROES=<game repo>/shared/assets/catalog/heroes.json` it also compares the class count with the game's catalog.
- `npm run test:ru-landing` (`tests/ru-landing.e2e.mjs`) runs the current standalone build against a loopback fake Account API. A ru build: `/` signed out is the guest home (claims, modes, downloads with SHA-256 and МБ, status, footer links, age sign, index/canonical/hreflang), signed in it redirects to `/me`, the English page and an unavailable catalog, the experimental workshop, no donate/wallet/crypto/Ekza text or link on `/`, `/download`, `/login`, `/me`, `/workshop`, `/privacy`, `/terms`, `/offer`, `/connect` and `/settings`, and in Chrome the page hydrates without errors and fits a phone (no screenshots). A global build: `/` still redirects to `/workshop` and the website link is unchanged.
- `npm run test:market-profiles` (`tests/market-profiles.e2e.mjs`) runs the current standalone build against a loopback fake Account API, in the market it was built for, and checks that it refuses the other market. A ru build also renders `/privacy`, `/terms` and `/offer` (draft banner, version, no Account API call), checks the notice on the login card and `/connect` and the footer links, follows them in Chrome (desktop, and the footer on a phone width) and takes two screenshots into `.agent/market-profiles/`; a global build checks that the legal pages answer 404 and no notice or legal link appears. Run it after a global and after a ru build:

```sh
npm run build && npm run test:market-profiles
OMOBA_MARKET=ru OMOBA_VKID_CLIENT_ID=12345 npm run build && npm run test:market-profiles
npm run build    # back to a global build before the other suites
```
