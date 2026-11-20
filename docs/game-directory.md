# Anonymous signed game-directory delivery

`GET`/`HEAD /api/game/directory` is the fixed regional public transport for an
operator-signed document. It calls only the configured Account API's
`/v1/game-directory`, and forwards its exact signed bytes. The native client must
independently verify a baked public pin before using any address; this feature
does not activate client routing or publish a live document.

The route uses the configured market/contour/origin, rejects a different Host or
query-selected region, and never forwards browser Cookie, Authorization or
forwarding headers. Hosted requests use only the existing server-configured
Account API ingress key. It does not create sessions or return cookies.

Responses are JSON with `Cache-Control: no-store` and `nosniff`. Fetches use a
fixed upstream, no redirects, omitted credentials and a5-second deadline.
Streamed response size is capped at64KiB even without Content-Length; UTF-8,
envelope shape, region/contour and freshness are checked. Invalid/unavailable
input becomes generic503; response errors never reflect upstream paths/content.
Signature/schema verification is performed by the Rust publisher and must also
be performed by the consuming client. This proxy does not authenticate signatures
or maintain a sequence high-water mark. Exact-byte transport preserves u64
sequence numbers without JSON reserialization/rounding.

Account API requires all three optional settings together:
`OMOBA_GAME_DIRECTORY_FILE`, `OMOBA_GAME_DIRECTORY_KEY_ID` and
`OMOBA_GAME_DIRECTORY_PUBLIC_KEY`. They point to a reviewed regular signed file
and its separate public trust pin; no private signing key runs on the service.
A regular-file atomic replacement appears without API/portal restart. Region
and contour come from the API build. No live values or services were provisioned.

Verification on2026-11-06:257 unit cases PASS/3 existing expected skips,
typecheck and RU production build PASS. Seven actual migrated loopback
PostgreSQL/Rust Account API/production Next checks PASS, including native offline
verification, no forwarded account material, HEAD/method/query boundaries,
corruption503 and signed hot replacement. API additionally passes4 cases and
strict all-target clippy/build. [Sanitized report](directory-http-proof.json).

To repeat the full transport test, build the portal for `OMOBA_MARKET=ru` and
`OMOBA_CONTOUR=production`, then run `npm run test:game-directory` with absolute
prebuilt RU `OMOBA_DIRECTORY_API_BIN`, native `OMOBA_DIRECTORY_SIGNER_BIN`, an
already migrated loopback `OMOBA_TEST_DATABASE_URL` pointing to `omoba_test`, and
a fresh `OMOBA_DIRECTORY_EVIDENCE_DIR`. The test starts/stops only owned loopback
processes and uses the publicly known seed[7;32] fixture; its private file is
removed before service startup. Output logs/reports remain under the chosen
evidence directory. This is transport evidence, not live HTTPS/WAN/multi-host,
native routing, account authentication or physical-device acceptance.
