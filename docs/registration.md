# RU registration path

The RU portal now supports website-first account creation through VK ID, OK and
Mail.ru. The ordinary callback requests `register:true`: the RU Account API creates
one default-stat profile for a new verified subject and returns a browser session.
Repeated login returns the same profile. The new /me card links downloads and tells
players to use the same account from the game's Russia region.

A game-opened `/connect?code=…` callback deliberately does not request registration.
A previously unlinked social identity is offered to the enrollment only after
reviewing the device label and fingerprint; the active game key then signs the link,
keeping its existing profile and progress. Known accounts explicitly approve the
candidate device. Choosing another social identity clears the old browser identity;
approval binds the reviewed profile id and rejects stale cross-tab review.

Existing players should link from the game before creating a new website account.
Profiles are never auto-merged. The game opens the system browser bridge directly;
visiting the landing is not required. It receives a device identity after server
verification; provider bearer tokens remain on the API side.

Requires the matching Account API with portal schema 10 and its bounded function's
EXECUTE grant. [Game-side registration notes](https://github.com/o-moba/omoba-bevy/blob/dev/docs/registration.md)
describe quotas, retries, revocation protection and deployment gates. The real VKCOM
[SDK authorization](https://github.com/VKCOM/vkid-web-sdk/blob/master/src/auth/auth.ts)
wire uses s256 and prompt=login for external methods; our direct BFF redirect follows
those parameters without adding a client SDK dependency.

The targeted E2E `tests/vk-sign-in.e2e.mjs` needs a RU production build with the dummy
public app id 51234567, a matching debug RU API binary, an explicitly task-owned
loopback PostgreSQL database named omoba_test (not occupied 5432/55581), a psql wrapper
or executable, and Chrome. It uses only a loopback VK stand-in, validates PKCE/state,
creates three independent subjects, repeats sign-in, enrolls native keys, checks
new-player guidance, stale-account approval and game-first linking, and verifies
cancellation/outage/replay boundaries. One ru 852×393 viewport is used. Optional
`OMOBA_NATIVE_JOURNEY_FIXTURE` exports only private synthetic seeds for a signed
public-lobby gameplay rehearsal; never publish that fixture or use production DBs.

This is not a public-host or real-provider certification. On 2026-10-28 omoba.ru/login
was 404, account/lobby DNS absent, and the RU VPS ran only the old game service.
Real release still needs owner-approved deployment, DNS/TLS, configured VK app and
callback, actual VK/Mail/OK accounts, downloads/signing and physical-device tests.
No website visual redesign is part of this delivery.
