# Legal documents

The documents a market's portal publishes (LR-04, LR-06), one folder per market and
version: `legal/<market>/<version>/{privacy,terms,offer}.md`, served at `/privacy`,
`/terms` and `/offer`. Which version is live comes from the market's legal table
(`src/lib/market-profile.mjs` `MARKET_LEGAL`, the same `version` as the game's
`scripts/markets.py` and `shared/src/market.rs`): the page always shows the version the
game asks players to accept, and refuses to render a file whose front matter says
otherwise. Only `ru` has documents today; `global` and `cn` have none (404).

`ru/0-draft/` holds the Russian drafts: a visible «Проект — требует проверки юристом»
banner, no effective date, and `{{…}}` fields (highlighted on the page) for what the
owner still has to fill in: operator, requisites, e-mail, retention periods counsel
decides.

## Publishing the counsel-approved texts

1. Copy the approved texts into a new folder, for example `ru/1/`, and set the front
   matter: `version: 1`, `status: final`, `effective: YYYY-MM-DD`, and
   `review: <reviewer>, <date>` (shown under the title). Fill in every `{{…}}`.
2. Change `version` to `1` in the RU legal table in all three places:
   `src/lib/market-profile.mjs` here, and `scripts/markets.py` and
   `shared/src/market.rs` in the game. A new version makes the game ask every player
   to accept again.
3. Record the counsel review (date and reviewer) in the game's `docs/markets.md`
   (RU release runbook, step 1).
4. Keep the old folders: they are the record of what players accepted.
5. `npm test` checks that every document parses, carries the market's version and still
   covers every data category (`tests/legal.test.mjs`).

## Format

Front matter between `---` lines: `title`, `version`, `status` (`draft` or `final`),
`effective` (empty for a draft) and an optional `review`. The body is a small Markdown
subset: `##` and `###` headings (an optional `{#anchor}` at the end), `- ` and `1. ` list
items (one line each), `> ` notes, pipe tables and paragraphs. Inline: `**bold**`,
`` `code` ``, `[text](https://…)`, `[text](mailto:…)`, `[text](/page)` and `{{field}}`.
Anything else fails the tests and the page (`src/lib/legal.mjs`), so a typo never ships.

Keep payment-method details out of the privacy policy and the user agreement: they
belong in the offer, which store builds never link (LR-67, LR-68).
