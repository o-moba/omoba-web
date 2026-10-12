# Vercel deployment

Use the Next.js framework preset, repository root, `npm ci` and `npm run build`. Keep the default Next.js output handling; `scripts/start.mjs` is only the local standalone launcher. The dynamic workshop function reads the verified catalogue snapshots included by Next.js file tracing. `/` redirects to `/workshop`; account navigation uses `/me`.

The linked project is `omoba-app` in team `wotoris-projects-c784733b`. The canonical production URL is `https://app.omoba.io`, with `https://omoba-app.vercel.app` as the verified Vercel fallback. The custom domain is assigned to this project; Name.com DNS and HTTPS were verified on 2026-10-10.

For the initial public guest prototype, configure these server-only production environment variables:

```text
OMOBA_PORTAL_ORIGIN=https://app.omoba.io
OMOBA_ACCOUNT_MODE=disabled
```

The market (`/market`) reads the public Ekza Registry and uses its own Ekza link cookies. It needs no further variables in production: `OMOBA_REGISTRY_URL` and `OMOBA_STUDIO_URL` default to `https://registry.ekza.io` and `https://studio.ekza.io`. Do not set them on Vercel; any other value is accepted only on loopback with `OMOBA_ALLOW_INSECURE_LOCAL=1` and otherwise renders "Market unavailable". In-place claims need a Registry with the `library-claim` link scope and `POST/DELETE /v1/account/library/{assetId}`; against an older Registry the market still lists items and sign-in reports that claims are not available yet. Sign-out also ends the link with `DELETE /v1/account/session`; a Registry without that route leaves the link listed under Studio connections until it expires, and the page says so. See [Market](market.md).

Keep the exact canonical HTTPS origin configured. The fallback hostname does not become an additional trusted origin for account mutations. Do not enable `OMOBA_ALLOW_INSECURE_LOCAL` or `OMOBA_TRUST_LOOPBACK_PROXY` on Vercel. No fixture credentials or Registry tokens belong in this deployment.

Disabled mode serves the public catalogue, class editor, browser drafts and JSON exports. Account and login pages explain the limitation, and account API routes return `503 account_service_disabled` without contacting any upstream, even with a stale session cookie. No OMOBA account login or cloud save is offered. The market is separate from the Account API and stays live in this mode: `/market` reads the public Registry on every request, and its "Sign in with Ekza" links the player's Ekza library through `/api/ekza/*`. That BFF calls `registry.ekza.io` (device link, library, claims and removals, and `DELETE /v1/account/session` on sign-out) and keeps the Registry link token in its own HttpOnly cookie (`__Host-omoba-ekza-link`, up to 90 days). Local development remains enabled by default.

Before enabling accounts, provision and verify the HTTPS Account API, its database migrations, native-client pairing configuration and exact portal origin allowlist. Set `OMOBA_ACCOUNT_API_URL` to that verified origin and `OMOBA_ACCOUNT_MODE=enabled`. CSRF deliberately rejects mutations from other origins, including unrelated Vercel preview URLs. The existing loopback proxy trust option is not a Vercel ingress configuration.

Deploy from the merged Git commit or a clean export of tracked files. `.vercelignore` explicitly excludes `.agent`, env files, Git metadata, dependencies, local builds and test output; never upload the local fixture/evidence directory. Do not copy an existing worktree's local env files into a deployment export.

Validation before publishing:

```sh
npm test
npm run typecheck
npm run build
npm run test:guest-deployment
npm run test:market
npm run test:https-cookies
```

The targeted smoke starts an isolated production server on loopback port 3013 with a trap Account API. It checks the root redirect, stale-cookie behavior, unavailable login/account pages, local save/export, public gallery and zero Account API calls; it does not open `/market` (see `npm run test:market`). No hosted account service or personal credentials are used.

`npm run test:https-cookies` runs the build as `https://app.omoba.io` behind a Playwright route, so the `__Host-` cookie rules of the production origin apply. It checks that every cookie the Account and Ekza BFFs set or delete is Secure, HttpOnly, SameSite=Lax and `Path=/`, and that Chrome actually drops the Ekza link on sign-out and after a revoked link.
