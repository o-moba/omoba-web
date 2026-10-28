# RU website and game registration

Ordinary website VK ID/OK/Mail.ru callbacks request fresh-profile registration.
Game-opened `/connect` callbacks preserve explicit signed linking to the existing
game profile. New accounts receive a download/next-step card; existing players are
directed to link from the game first so they do not accidentally create a separate
blank profile. Accounts are never automatically merged.

Device approval carries the reviewed profile id. Account changes between browser
tabs invalidate that review; choosing another social identity replaces or clears
the prior browser identity. Unlinked game-first identities require device label
and fingerprint review. Provider authorization parameters follow the official SDK;
PKCE/state and callback replay protections remain enforced.

Verification: typecheck, RU production build and unit suite passed (197 passed,
1 skipped). Chrome at one Russian 852×393 viewport exercised three independent
first/repeat provider subjects, native key enrollment, cross-tab account switching,
game-first progress preservation, cancellation, mismatched state, provider outage
and replay against the real RU API and disposable PostgreSQL 18. Provider responses
are a loopback stand-in, not real VK/OK/Mail.ru certification. No visual redesign,
production deployment, credentials, dependencies or CI configuration changed.

The game repository's fresh signed harness used the portal-enrolled synthetic keys
for VK, OK, Mail.ru and game-first linking in real allocated matches, including
movement and a fresh-socket VK reconnect. This proves application integration with
the game server; physical client key storage and browser return still need devices.

Matching game/API changes require portal schema 10 and the bounded registration
function's EXECUTE grant. Public DNS, RU portal/API hosting, VK app/callback settings,
actual provider accounts, signed downloads and physical-device return/restart remain
launch gates. Read-only checks found the public `/login` returning 404 and account/
lobby DNS missing. Public registration is not ready for acquisition yet.

See [registration](../registration.md) and local raw proof under
`.agent/tasks/RU-REGISTRATION-20261028/`. Feature changes target `dev`; merging does
not activate production or publish packages.
