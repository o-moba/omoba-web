# RU website deployment from dev

The owner explicitly authorized `omoba.ru` on `omoba-ru-server`
(`212.113.117.105`) from `dev`, with Nginx and a single-host layout. Frozen app
source: `c537e0dbf09c4b72955845f90357e01c2906f86b`. The source archive SHA-256 is
`389b05840f8a7fa58d22f040b0fe816fec0f4bf7bd69143884753c4353dae1fc`.

Runtime is production contour, RU market, disabled accounts and empty VK app id.
The owner will create the real app later. No simulated account or download is
offered. The landing, workshop and public legal pages work; account/download pages
explain guest-mode limitations. The legal documents remain drafts in this source.

Nginx proxies HTTPS to the restricted Node service on `127.0.0.1:3010`. Official
vendor Node 24.22.2 LTS was SHA-256 verified and installed under
`/opt/omoba-ru/node-releases/`, selected through `node-current`. Ubuntu's Node 22
build omitted the TypeScript support used by the test suite; its failed gate was
retained and the complete gate rerun successfully with the vendor runtime.
General unit tests run without the RU deployment environment; the build uses it.

The active root-owned application is
`/opt/omoba-ru/web-releases/c537e0d-20261029`, selected through `web-current`.
`BUILD.json` records source/config/runtime provenance; `FILES.sha256.json` lists
1,461 files and has SHA-256
`50c7e3ed44c29edcb264423cf67006138e7be7ecb9eb978a795c35f56000a121`.
The runtime can persist writes only in its separate cache, and has a 512 MiB memory cap and
one-CPU quota. Initial warm process memory was about 55 MiB, not a capacity claim.

REG.RU `@` and `www` A records changed from `95.163.244.138` to the VPS address.
Nameservers and unrelated records were preserved. Positive TTL changed from
86,400 to the provider's minimum 3,600 seconds; old cached answers can outlive this.
VPS DNS and ordinary Chrome already reach the new website, while some Mac resolver
queries still returned the old parking address during verification.

Let's Encrypt certificate covers `omoba.ru` and `www.omoba.ru`, expires
2027-01-27, and uses webroot ACME. HTTP and www redirect to canonical HTTPS.
`certbot.timer` is enabled; renewal dry-run with the Nginx deploy hook passed.
Website, Nginx and renewal services are enabled for boot. Only ports 80/443 were
added to the existing firewall rules; app and database remain loopback-only.

Verification: 197 unit tests passed, one intentionally skipped, typecheck and RU
production build passed on the host in a restricted build cgroup. Fresh independent
checks verified all listed file hashes, HTTPS chain/hostname, pages and six CSS/JS
assets, guest API 503/VK 404, redirects, permissions and resource caps. The public
website was visually checked in one Russian desktop viewport. No physical game
device or real provider was exercised.

The original main 0.44 game process remained PID 5426, started 2026-10-28 12:23:54 UTC,
with server hash `b783df7f6b252ede7157b35b13b13a7d78adbe55262a09a4c2a4aea1e256a991`.
Career schema stayed `[1,2,3]`, portal `[1,2,3,4,5]`; no migration, game restart,
client publication, global Vercel change or dev-VPS rollout occurred. Attaching the
new Account API requires a coordinated future game/schema/client upgrade.

Affected configuration and operational logs are retained privately under
`/var/backups/omoba-ru/web-20261029/`; raw local proof and screenshot are under
`omoba-bevy/.agent/tasks/RU-WEB-DEPLOY-20261029/`. See [runbook](../ru-nginx.md) for
packaging, configuration, verification and rollback. The active release and vendor
runtime are intentionally retained. No automatic CI deployment trigger was added.
