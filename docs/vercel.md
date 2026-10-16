# Vercel deployment

Use the Next.js framework preset, repository root, `npm ci` and `npm run build`. Keep the default Next.js output handling; `scripts/start.mjs` is only the local standalone launcher. The dynamic workshop function reads the verified catalogue snapshots included by Next.js file tracing. `/` redirects to `/workshop`; account navigation uses `/me`.

The linked project is `omoba-app` in team `wotoris-projects-c784733b`. The canonical production URL is `https://app.omoba.io`, with `https://omoba-app.vercel.app` as the verified Vercel fallback. The custom domain is assigned to this project; Name.com DNS and HTTPS were verified on 2026-10-10.

For the initial public guest prototype, configure these server-only production environment variables:

```text
OMOBA_PORTAL_ORIGIN=https://app.omoba.io
OMOBA_ACCOUNT_MODE=disabled
```

Leave `OMOBA_CONTOUR` unset on `omoba-app`; unset means `production` (see [Contours](#contours)). The market (`/market`) reads the public Ekza Registry and uses its own Ekza link cookies. It needs no further variables in production: `OMOBA_REGISTRY_URL` and `OMOBA_STUDIO_URL` default to `https://registry.ekza.io` and `https://studio.ekza.io`. Do not set them on Vercel; any other value is accepted only on loopback with `OMOBA_ALLOW_INSECURE_LOCAL=1` and otherwise renders "Market unavailable". A dev-contour host (`*.dev.omoba.io`, `*.dev.ekza.io`) in any `OMOBA_*` URL fails the build. In-place claims need a Registry with the `library-claim` link scope and `POST/DELETE /v1/account/library/{assetId}`; against an older Registry the market still lists items and sign-in reports that claims are not available yet. Sign-out also ends the link with `DELETE /v1/account/session`; a Registry without that route leaves the link listed under Studio connections until it expires, and the page says so. See [Market](market.md).

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
npm run test:contour
```

The targeted smoke starts an isolated production server on loopback port 3013 with a trap Account API. It checks the root redirect, stale-cookie behavior, unavailable login/account pages, local save/export, public gallery and zero Account API calls; it does not open `/market` (see `npm run test:market`). No hosted account service or personal credentials are used.

`npm run test:https-cookies` runs the build as `https://app.omoba.io` behind a Playwright route, so the `__Host-` cookie rules of the production origin apply. It checks that every cookie the Account and Ekza BFFs set or delete is Secure, HttpOnly, SameSite=Lax and `Path=/`, and that Chrome actually drops the Ekza link on sign-out and after a revoked link.

## Contours

`OMOBA_CONTOUR` selects the contour: `production` (also when unset or empty) or `dev`. No other value is accepted, not even `prod`. The contour fixes the only hosted origins the app may use:

| Contour | Registry | Studio | Portal origin | Website (`OMOBA_SITE_URL`) | Account API |
|---|---|---|---|---|---|
| `production` | `https://registry.ekza.io` | `https://studio.ekza.io` | any HTTPS origin except dev-contour hosts (today `https://app.omoba.io`) | default `https://omoba.io` | any HTTPS origin except dev-contour hosts |
| `dev` | `https://registry.dev.ekza.io` | `https://studio.dev.ekza.io` | exactly `https://app.dev.omoba.io` | `https://dev.omoba.io` only (the default) | exactly `https://account.dev.omoba.io`; explicit loopback fixtures remain available |

Dev-contour hosts are `dev.omoba.io`, `dev.ekza.io` and their subdomains. Production hosts are `omoba.io`, `ekza.io` and their other subdomains. Unset Registry, Studio and website variables take the contour's origin. Loopback test doubles stay possible in both contours, only with `OMOBA_ALLOW_INSECURE_LOCAL=1`; on Vercel (`VERCEL=1`) the dev contour refuses that flag, so a hosted dev deployment accepts only its fixed dev origins. The rules live in `src/lib/contour.mjs` and `src/lib/contour-guard.mjs`.

A cross-contour misconfiguration fails closed with a clear server error. It never falls back to production:

- **Build.** `next build` (and `next dev`) fails with `OMOBA contour misconfigured, refusing to build or serve (fail closed)` and one line per problem. Examples: dev URLs with the switch unset, `OMOBA_CONTOUR=dev` with `https://app.omoba.io`, `OMOBA_CONTOUR=prod`. On Vercel it also compares the switch with `VERCEL_PROJECT_PRODUCTION_URL`: dev settings on a project whose production domain is `app.omoba.io`, or a project serving `app.dev.omoba.io` without `OMOBA_CONTOUR=dev`, fail the build. A bad env therefore never reaches a deployment.
- **Startup** (`src/instrumentation.ts`). The server checks the same rules, and that the build was made for the contour it runs in (`X-Robots-Tag` is fixed at build time). On failure it answers every request with 500 and logs the reason.
- **Each request.** The root layout renders no page under a bad contour, or when the request reached this contour under the other contour's host (for example `app.dev.omoba.io` attached to the production project, or the reverse): 500 with `OMOBA contour mismatch … request host …` in the log. `/api/ekza/*` and `/api/*` answer `503 configuration_unavailable` in both cases. `ekzaConfig()` throws, so the market shows "Market unavailable"; `studioOrigin()` returns null under dev and the Studio links are hidden.

The dev contour also:

- sends `X-Robots-Tag: noindex, nofollow` on every response, including API routes and static files; every page already carries `<meta name="robots" content="noindex, nofollow">` in both contours;
- serves `/robots.txt` as `User-Agent: *` / `Disallow: /`;
- shows an amber `DEV` badge next to the OMOBA mark in every header and prefixes every tab title with `DEV · `;
- keeps its own language cookie: a host-only `omoba_locale_dev`, never `omoba_locale` with `Domain=.omoba.io` (see [Website languages](LOCALIZATION.md)).

Production is unchanged: no `X-Robots-Tag`, no badge, the same titles, the same Registry/Studio/portal rules and the shared `.omoba.io` language cookie. The only visible difference is `/robots.txt`, which now answers 404 (before, the catch-all portal page answered it). Production publishes no robots policy, as before.

`npm run test:contour` (`tests/contour.e2e.mjs`) runs the current build in its own contour and in the other one, using only loopback services; hosted dev and production hosts only appear as `Host` headers sent to loopback. Run it after a normal build and again after a dev build:

```sh
npm run build && npm run test:contour       # production build
OMOBA_CONTOUR=dev OMOBA_PORTAL_ORIGIN=https://app.dev.omoba.io OMOBA_ACCOUNT_MODE=disabled \
  OMOBA_REGISTRY_URL=https://registry.dev.ekza.io OMOBA_STUDIO_URL=https://studio.dev.ekza.io \
  OMOBA_SITE_URL=https://dev.omoba.io npm run build && npm run test:contour
npm run build                               # back to a production build before the other suites
```

## Dev project `omoba-app-dev`

> **Never touch `omoba-app`.** Every write below names `omoba-app-dev` explicitly. Never run `vercel link` in a working checkout, never connect Git to `omoba-app`, and never add a dev domain to `omoba-app`. That project has `autoAssignCustomDomains=true`, so a dev domain there would serve production on the dev host (the request-host check then answers 500, but do not rely on it). If a command could reach `omoba-app`, stop.

`https://app.dev.omoba.io` is a separate Vercel project, `omoba-app-dev`, in the same team (`wotoris-projects-c784733b`). Its Production target serves the `dev` branch and talks only to the dev Registry and dev Studio. Those two run on the dedicated dev VPS (SSH alias `vds-dev`), not on Vercel and not on the production VPS; see `ekza-registry` `deploy/dev`.

Status (2026-10-13): `omoba-app-dev` exists (Next.js, Node 24.x, Standard Protection, not Git-connected) with the six variables below on Production and Preview, and serves a `deploy` of `dev` (c598845) on `app.dev.omoba.io` (verified, `misconfigured=false`; the `app.dev` CNAME already existed) and `omoba-app-dev.vercel.app`. `check --apply` passes.

Guest-mode environment, on both the **Production** and **Preview** targets of `omoba-app-dev`. Preview gets the same values so that any build in this project, including a branch preview, is the dev contour:

```text
OMOBA_CONTOUR=dev
OMOBA_PORTAL_ORIGIN=https://app.dev.omoba.io
OMOBA_ACCOUNT_MODE=disabled
OMOBA_REGISTRY_URL=https://registry.dev.ekza.io
OMOBA_STUDIO_URL=https://studio.dev.ekza.io
OMOBA_SITE_URL=https://dev.omoba.io
```

- Never set `OMOBA_ALLOW_INSECURE_LOCAL` or `OMOBA_TRUST_LOOPBACK_PROXY` on Vercel. Enabled accounts use only the exact dev API and the server-only ingress key described below.
- The Registry, Studio and website values equal the dev defaults. They are set anyway: if `OMOBA_CONTOUR=dev` were lost, they make the build fail instead of building production.
- The dev Registry must use `EKZA_STUDIO_WEB_URL=https://studio.dev.ekza.io`. Otherwise its device-link approval URL is not the dev Studio, and the market refuses it (sign-in fails closed).
- `https://dev.omoba.io` is the dev landing: its own new Vercel project from the `dev` branch of `landing-v2` (planned name `landing-v2-omoba-dev`), never `landing-v2-omoba`. Until it is live, "About the game" links on the dev app do not resolve.

DNS (zone `omoba.io` at Name.com, set by the owner): host `app.dev`, type `CNAME`, answer `cname.vercel-dns.com`, TTL 300.

- No TXT record is expected: the apex is already verified in this team. If `vercel domains add` returns a `verification` array, add the `_vercel` TXT it names.
- Do not create `*.dev` wildcards, and add no CAA record.
- `registry.dev.ekza.io` and `studio.dev.ekza.io` are A records to the dev VPS, not Vercel.

### Hosted dev accounts

The operator may enable the shared game Account API after its isolated database, migrations, TLS and ingress are ready. Add `OMOBA_ACCOUNT_MODE=enabled`, `OMOBA_ACCOUNT_API_URL=https://account.dev.omoba.io` and sensitive `OMOBA_ACCOUNT_INGRESS_KEY` on both Vercel targets. The key is 32 random bytes encoded as 64 lowercase hex characters. Production and unrelated API origins remain rejected; enabled hosted dev fails closed when the key is absent or malformed.

Only server-side Account API requests attach `X-Omoba-Portal-Key`; the BFF, SSR account read and pairing cancellation all refuse redirects. Caddy validates and strips the header before forwarding to the loopback Account API. The key is never a browser header, cookie, response field or `NEXT_PUBLIC_` setting. Native signed routes have their own ingress policy. This does not enable payment providers or turn a synthetic Hero grant into a real payment.

The guarded script keeps guest mode as its default. To configure enabled accounts, run its dry run first, then use a private regular key file (0600) supplied by the operator. The key goes to Vercel through stdin as a sensitive secret; it never appears in CLI arguments or the printed plan:

```sh
DEV_ACCOUNT_MODE=enabled scripts/vercel-dev.sh plan
DEV_ACCOUNT_MODE=enabled DEV_ACCOUNT_INGRESS_KEY_FILE=/private/path/ingress.key scripts/vercel-dev.sh --apply setup
DEV_ACCOUNT_MODE=enabled scripts/vercel-dev.sh --apply deploy
DEV_ACCOUNT_MODE=enabled scripts/vercel-dev.sh --apply check
```

After a dev build, `node tests/account-ingress.e2e.mjs` verifies the standalone BFF and SSR against a local Account API double: server-only header injection, ignored browser forgery, rejected redirects, and no ingress credential in browser HTML, cookies or static bundles. It uses a synthetic credential and never contacts the hosted API.

The local deployment gate uses a synthetic key only to validate the build configuration. The hosted build/runtime reads the real Vercel secret. Do not put the private key file inside a checkout or deployment export. To return to guest mode, remove the hosted API/key settings explicitly before the guest-mode check; `setup` does not silently delete credentials.

### Runbook

`scripts/vercel-dev.sh` does the work. Without `--apply` it only prints the commands (dry run). In both modes it refuses production project names (`omoba-app`, `landing-v2-omoba`, `landing-v2-ekza`), a project name without `-dev`, any ref but `dev`, production identifiers (`vds-eternal`, `77.246.105.57`, `snrjxwutqxokeujuiepn`, the `omoba-app` project id) in its settings, and any non-empty `VERCEL_PROJECT_ID`, `VERCEL_ORG_ID`, `NOW_PROJECT_ID` or `NOW_ORG_ID` in the environment; it then unsets all four. The CLI reads each ID as `VERCEL_<X>`, or else the legacy `NOW_<X>` (`getPlatformEnv` in `@vercel/build-utils`). With both IDs set, `vercel deploy` without `--project` deploys to that project instead of the one in `.vercel/project.json`, and `vercel link --project omoba-app-dev` links that project instead (verified with 63.1.2). The domain is fixed to `app.dev.omoba.io`. `tests/vercel-dev.test.mjs` runs it against a fake CLI. `VERCEL_CLI=<…/node_modules/vercel/dist/vc.js> npm run test:vercel-cli` (`tests/vercel-cli.e2e.mjs`) runs it through the real pinned CLI against a loopback fake of the Vercel API, and checks those CLI rules; rerun it whenever the pin moves.

```sh
VC="npx --cache /tmp/npm-cache-vercel --yes vercel@63.1.2"   # default; or the cached .bin/vercel path
export VC
scripts/vercel-dev.sh plan              # dry run of everything below
scripts/vercel-dev.sh --apply setup     # idempotent: project, build settings, env (production+preview), domain
scripts/vercel-dev.sh --apply deploy    # resolve id -> origin/dev -> fresh export -> gate -> link -> deploy --prod --project -> check projectId
scripts/vercel-dev.sh --apply check     # read-only checks of the live dev project
```

- `setup` creates the project only if `vercel project inspect` does not find it, sets Next.js, Node 24.x, `npm ci` and `npm run build`, writes the env with `--force` (re-runs overwrite the same values), and attaches `app.dev.omoba.io` only if the project does not list it yet. It never passes `--force` to `domains add`: that would move the domain from another project.
- `deploy` refuses a `.vercel` directory in the checkout. It first resolves the dev project: `vercel api /v9/projects/omoba-app-dev` must answer a `prj_` id that is not the production id, under the name `omoba-app-dev`. It fetches `origin/dev`, exports that commit with `git archive` into a fresh `mktemp -d` outside the checkout, and gates the export: `npm ci`, `npm test`, `npm run typecheck`, and `npm run build` with the env above (`GATE=0` skips the gate). Then it runs `vercel link --project omoba-app-dev --cwd <export>`. Unless `<export>/.vercel/project.json` holds exactly the resolved id (and team), it stops before deploying. It runs `vercel deploy --prod --project omoba-app-dev --cwd <export> -m contour=dev -m gitRef=dev -m gitSha=<sha>`; an explicit `--project` wins over environment IDs in the CLI. Finally it reads the new deployment (`vercel api /v13/deployments/<id or URL>`, from the URL or JSON the CLI prints) and requires its `projectId` to be the resolved id. Otherwise it exits 2 and says to roll `omoba-app` back at once if the deployment landed there. The checkout is only read; no `.vercel` ever lands in it.
- `check` reads the domain config (`misconfigured` must be false), refuses env drift (missing keys or forbidden local-fixture variables; guest mode also refuses Account API settings), and checks the live site: `/` redirects to `/workshop`, `/market` sends `X-Robots-Tag: noindex, nofollow` and shows the `DEV` badge, `/robots.txt` disallows `/`, and the only Studio link is `https://studio.dev.ekza.io`.

The same steps by hand, if the script cannot be used. Save them as a file outside any checkout (for example `/tmp/omoba-dev-deploy.sh`) and run `bash /tmp/omoba-dev-deploy.sh`. Use bash, not an interactive zsh: zsh does not split `$VC` into words, and `exit` would close the shell.

```sh
set -euo pipefail
VC=${VC:-npx --cache /tmp/npm-cache-vercel --yes vercel@63.1.2}
S=wotoris-projects-c784733b; P=omoba-app-dev; R=${R:-/path/to/omoba-web}   # R is only read
PROD=prj_9pxN1QpGTWA2ZvuSOL13F4AWTrdL                                       # omoba-app: only ever refused
# The CLI prefers VERCEL_* or NOW_* project IDs over the link, even over `link --project`.
for v in VERCEL_PROJECT_ID VERCEL_ORG_ID NOW_PROJECT_ID NOW_ORG_ID; do
  [ -z "${!v:-}" ] || { echo "REFUSED: $v is set; unset it" >&2; exit 2; }
done
unset VERCEL_PROJECT_ID VERCEL_ORG_ID NOW_PROJECT_ID NOW_ORG_ID
$VC project inspect $P --scope $S >/dev/null 2>&1 || $VC project create $P --scope $S
ID=$($VC api /v9/projects/$P -X GET --scope $S | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const p=JSON.parse(s);if(p.name!==process.argv[1]||!/^prj_/.test(p.id)||p.id===process.argv[2])process.exit(1);console.log(p.id)})' $P $PROD) ||
  { echo "REFUSED: $P does not resolve to a dev project" >&2; exit 2; }
git -C $R fetch -q origin dev; SHA=$(git -C $R rev-parse origin/dev)
X=$(mktemp -d /tmp/omoba-web-dev.XXXXXX); git -C $R archive $SHA | tar -x -C $X
$VC link --yes --project $P --scope $S --cwd $X
node -e 'if (require(process.argv[1]+"/.vercel/project.json").projectId!==process.argv[2]) process.exit(1)' $X $ID ||
  { echo "REFUSED: $X is not linked to $P ($ID); nothing was deployed" >&2; exit 2; }
OUT=$($VC deploy --prod --yes --project $P --cwd $X --scope $S -m contour=dev -m gitRef=dev -m gitSha=$SHA); echo "$OUT"
DEP=$(printf '%s' "$OUT" | grep -Eo 'https://[a-z0-9.-]+\.vercel\.app' | tail -1 | sed 's|^https://||') && [ -n "$DEP" ] ||
  { echo "cannot tell which deployment the CLI made: confirm by hand that it is on $P, not omoba-app" >&2; exit 2; }
$VC api /v13/deployments/$DEP -X GET --scope $S | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.exit(JSON.parse(s).projectId===process.argv[1]?0:1))' $ID ||
  { echo "DEPLOYMENT $DEP IS NOT ON $P: if it is on omoba-app, roll omoba-app back now (Instant Rollback)" >&2; exit 2; }
echo "deployed $SHA to $P ($ID): https://$DEP"
```

Protection: Standard Protection (`ssoProtection.deploymentType=all_except_custom_domains`, as on production). The custom domain is public, and `*.vercel.app` deployment URLs need a team login. Dev hostnames appear in certificate-transparency logs; `noindex` and `robots.txt` keep them out of search results. Use synthetic test accounts only; never copy production data into the dev contour.

After every deploy, confirm production is unchanged: `omoba-app` keeps the same production deployment id, its two domains (`app.omoba.io`, `omoba-app.vercel.app`) and its two env keys (`OMOBA_ACCOUNT_MODE`, `OMOBA_PORTAL_ORIGIN`).

Updates repeat `deploy`; it is idempotent. Optional auto-deploy: the owner installs the Vercel GitHub app on `o-moba` (this repository only) and connects it to `omoba-app-dev` only, with Production Branch `dev` and an ignored build step for every other branch (`[ "$VERCEL_GIT_COMMIT_REF" != "dev" ]`). Never connect it to `omoba-app`.

Rollback: `$VC rollback` inside `omoba-app-dev`, or `$VC project remove omoba-app-dev --scope $S` and then delete the `app.dev` DNS row. Both affect the dev project only.
