# Changelog

## Unreleased

- Show a neutral remake for innocent players while retaining a proved leaver's
  individual ranked loss. Add a remake history filter and explain surrender
  separately from a base victory. The new terminal reason remains optional.
- Remake/surrender portal verification: 243 tests passed (3 expected skips),
  typecheck and production build passed; focused RU phone browser scenarios
  passed and their screenshots were inspected. Game-side completion remains
  tracked in the game TODO.

- Show a player's own forfeited loss separately from the team's victory, including
  ranked penalties after an unattended match ends. Preserve historical results
  that have no participation evidence.
- Show the profile's abandon total and a readable participation notice in match
  details. Explain interrupted-match penalties separately from ordinary awards.
  New Account API fields are optional for compatibility with older servers.
- Add a focused Russian 390×844 browser render check for profile and match details.
  Unit tests: 242 passed, 3 expected skips; typecheck, browser check and production build pass.
  Physical mobile and production deployment remain pending.
