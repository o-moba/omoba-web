# Portal dev integration — 2026-10-29

Combine PR20(VK-linked recovery copy),22(career/browser practice) and25(iOS
Universal Link association) into dev, with their original ancestry retained.
Keep current website-first registration, signed game-profile linking,
account-change re-review, legal notices and new-player game instructions.
The new career Overview composes with GameNextStep instead of replacing it.

The outdated fixture assumptions are adapted to the actual lower-case `s256`
VK challenge and `register:true` website flow. New website subjects receive a
session/profile; game-bound sign-in keeps its separate explicit linking route.
The browser practice artifact is imported with its original PR139 source/hash;
no new WASM build or public deployment is claimed by that local HTTP test.

Combined checks:218 Node tests with the game market table comparison and no
skips, TypeScript, RU production build,10 real loopback BFF/browser-package HTTP
checks and6 public iOS Host-isolation/return-page checks. All external identity
services are synthetic; no credentials, production accounts, DNS or profiles
are changed. Rollout and physical iOS acceptance remain documented gates.
