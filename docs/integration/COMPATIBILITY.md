# Compatibility snapshot — 2026-09-15

Game base: e62b728ef27d621c2447b9b78f29535ee8fe08b4, main, version 0.19.0-rc.8.
Portal implementation: 0.20.0-rc.1 in `omoba-bevy-player-portal`, branch
`feature/player-portal-2026-09-15`. New web repository: `omoba-web`, 0.1.0.
No commit, push or merge performed for this task. The dedicated worktree is owned
by the existing mobile-beta clone; it does not overwrite canonical main.

The separate `omoba-bevy-iphone` packaging/assets changes remain untouched.
A native build from the new source is required for the new portal pairing panel.
Old clients retain their existing game identity; there is no automatic account
recreation or private-key export. Old guest-only sessions do not gain persistence.

Career schema remains version 1. Portal schema has independent version 1. Game
runtime now needs an owner-run explicit migration before startup; existing v1
career databases remain compatible. Runtime roles must use the documented grants.
The normal `cargo run -p server` command still chooses the server binary.

The existing landing receives only the reviewed conditional Player portal link,
`.env.example` and `BETA-ACCESS.md` notes. The external-workspace lease exception
was explicitly approved by the user. Baseline hashes and the exact patch are saved
in this directory; unrelated landing edits were preserved. Tests (4) and build pass.
No public portal URL, release artifact URL, secret or production ingress was changed.

Production dependencies were explicitly approved by the user. See
[resolved versions](../DEPENDENCIES.md). Public deployment and actual phone/Safari
acceptance remain external prerequisites, not inferred from desktop emulation.
