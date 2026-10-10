# Vercel deployment

Use the Next.js framework preset, repository root, `npm ci` and `npm run build`. Keep the default Next.js output handling; `scripts/start.mjs` is only the local standalone launcher. The dynamic workshop function reads the verified catalogue snapshots included by Next.js file tracing. `/` redirects to `/workshop`; account navigation uses `/me`.

The linked project is `omoba-app` in team `wotoris-projects-c784733b`. Its planned production guest URL is `https://omoba-app.vercel.app`; verify the deployed URL before sharing it as live. The custom domain `app.omoba.io` is assigned to this project, with Name.com DNS configuration still pending.

For the initial public guest prototype, configure these server-only production environment variables:

```text
OMOBA_PORTAL_ORIGIN=https://omoba-app.vercel.app
OMOBA_ACCOUNT_MODE=disabled
```

Use the verified canonical HTTPS origin. After custom-domain DNS and TLS are verified, change the origin to `https://app.omoba.io` for that deployment. Do not enable `OMOBA_ALLOW_INSECURE_LOCAL` or `OMOBA_TRUST_LOOPBACK_PROXY` on Vercel. No fixture credentials or Registry tokens belong in this deployment.

Disabled mode serves the public catalogue, class editor, browser drafts and JSON exports. Account and login pages explain the limitation, and account API routes return `503 account_service_disabled` without contacting any upstream, even with a stale session cookie. No account login, cloud save or Ekza connection is claimed. Local development remains enabled by default.

Before enabling accounts, provision and verify the HTTPS Account API, its database migrations, native-client pairing configuration and exact portal origin allowlist. Set `OMOBA_ACCOUNT_API_URL` to that verified origin and `OMOBA_ACCOUNT_MODE=enabled`. CSRF deliberately rejects mutations from other origins, including unrelated Vercel preview URLs. The existing loopback proxy trust option is not a Vercel ingress configuration.

Deploy from the merged Git commit or a clean export of tracked files. `.vercelignore` explicitly excludes `.agent`, env files, Git metadata, dependencies, local builds and test output; never upload the local fixture/evidence directory. Do not copy an existing worktree's local env files into a deployment export.

Validation before publishing:

```sh
npm test
npm run typecheck
npm run build
npm run test:guest-deployment
```

The targeted smoke starts an isolated production server on loopback port 3013 with a trap Account API. It checks the root redirect, stale-cookie behavior, unavailable login/account pages, local save/export, public gallery and zero upstream calls. No hosted account service or personal credentials are used.
