# OMOBA · Arena / Armory

The player portal, creator library and class workshop use the existing game
emblem, one OMOBA name and one digital palette. Section labels remain navigation.
The game world's own jade, ivory and brass materials are preserved in captures.

`src/app/brand.css` owns the canonical tokens, local fonts and `Brand` lockup.
Background / surface / raised: #080E1A / #101B2D / #17253B. Borders: #2A3E5A.
Primary text / secondary text: #F0F4FA / #9BAEC6. Action cobalt: #3478F6.
Selection/focus crystal: #3DDCFF. Gold #C9A56A belongs to status and achievements.
Primary buttons use Void text on Cobalt (4.75:1); hover is #5592FF with Void text.

Show the full original logo at 64px in desktop headers, 44px on mobile alongside
readable OMOBA lettering, or at least 96px when it stands alone. Keep proportions;
never replace it with a letter O, crop a pseudo-symbol or add artificial glow.
See `public/brand/README.md` for source provenance and licenses.

Use Barlow Condensed Bold for English headings and figures. Use Inter for UI and
Cyrillic. Keep descriptions readable; technical snapshot identifiers stay in the
source/compatibility details. Concept art is labelled as illustration, never as
a shipped character model or an unlock promise.

The workshop exposes core presets beside the editable kit, uses original skill
icons for QWER, and shows the current draft in its save panel. Optional notes
remain in the draft even while collapsed. This does not change game rules,
account availability, upload approval, or matchmaking eligibility.

## Verification for this revision

`node tests/brand.e2e.mjs` targets a running guest portal (default port 3017,
`BRAND_TEST_ORIGIN` override). `npm test` (77 checks), typecheck and production build passed. The public catalog
browser suite and disabled-account production smoke passed. Additional EN Chrome
1440x1000 /393x852 checks exercised core presets, skill reassignment, optional
notes, browser recovery, JSON export and page overflow. An authenticated profile
layout was checked against a GET-only synthetic Account API fixture; it is not a
real account, database, payment or authentication integration check.

The 12-page brandbook source and portable HTML/PDF live in `wotori/decks` under
`omoba-brandbook-2026`. No production deployment was performed.
