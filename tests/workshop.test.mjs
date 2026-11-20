import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp, rm, symlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  parseWorkshopCatalog,
  parseClassBuild,
  defaultBuild,
  combatTestPreset,
  buildIssues,
  derivedAssetRequirements,
  safeLibraryVerificationUrl,
  MAX_BUILD_BYTES,
} from "../src/lib/workshop.mjs";
import { readWorkshopSnapshot } from "../scripts/import-workshop.mjs";
import { allowedPath } from "../src/lib/security.mjs";
const raw = await readFile("public/workshop/catalog.json", "utf8"),
  catalog = parseWorkshopCatalog(raw),
  assets = JSON.parse(
    await readFile("public/asset-catalog/catalog.json", "utf8"),
  );
test("game-owned workshop has12cores48skills and each native preset validates", async () => {
  assert.equal(catalog.cores.length, 12);
  assert.equal(catalog.skills.length, 48);
  assert.equal(catalog.gameplayRevision, assets.source.gameplayRevision);
  for (const c of catalog.cores)
    assert.deepEqual(buildIssues(defaultBuild(catalog, c.id), catalog), []);
  await readWorkshopSnapshot("public/workshop/catalog.json");
});
test("mixed recipes preserve original unlock levels and separate appearance", () => {
  const d = defaultBuild(catalog, "dawnweaver");
  d.recipe.skills = ["dawn_ray", "rift_needle", "wild_zap", "dawn_bind"];
  parseClassBuild(d, catalog);
  assert.equal(
    catalog.skills.find((s) => s.id === d.recipe.skills[0]).unlockLevel,
    6,
  );
  const requirements = derivedAssetRequirements(d, assets);
  assert.ok(requirements.some((r) => r.id === "dawnweaver.handheld.scepter"));
  assert.equal(
    requirements.some((r) => r.id === "wildspark.handheld.repeater"),
    false,
  );
  const preset = combatTestPreset(d, catalog);
  assert.equal(preset.player.hero, "dawnweaver");
  assert.deepEqual(preset.player.recipe, d.recipe);
  assert.equal(
    preset.player.max_hp,
    catalog.cores.find((c) => c.id === "dawnweaver").baseHp,
  );
  assert.equal(preset.player.avatar, null);
  assert.equal(preset.player.god_mode, false);
  assert.equal(preset.player.no_cooldowns, false);
  assert.equal(preset.player.infinite_resource, false);
  assert.equal(preset.dummy.enabled, true);
  assert.equal(preset.enemy.enabled, false);
  assert.equal(catalog.sandboxTemplate.player.recipe.skills[0], "dawn_bind");
});
test("strict build imports fail closed without rewriting input", async (t) => {
  const cases = {
    unknownField: (d) => (d.owner = "attacker"),
    unknownRecipeField: (d) => (d.recipe.damage = 999),
    schema: (d) => (d.schema = "omoba.class-build.v2"),
    recipeSchema: (d) => (d.recipe.schema_version = 2),
    revision: (d) => (d.recipe.catalog_revision = "future"),
    legacyCore: (d) => (d.recipe.core = "warrior"),
    legacySkill: (d) => (d.recipe.skills[0] = "shield_bash"),
    duplicate: (d) => (d.recipe.skills[1] = d.recipe.skills[0]),
    count: (d) => d.recipe.skills.pop(),
    passive: (d) => (d.recipe.passive = "fake"),
    weaponToggle: (d) => (d.recipe.skills[0] = "wild_switch"),
    orbDependency: (d) => (d.recipe.skills[0] = "orbital_collapse"),
    emptyName: (d) => (d.name = " "),
    longName: (d) => (d.name = "a".repeat(81)),
    longDescription: (d) => (d.description = "a".repeat(1001)),
    nameControl: (d) => (d.name = "hello\nthere"),
  };
  for (const [name, mutate] of Object.entries(cases))
    await t.test(name, () => {
      const d = defaultBuild(catalog);
      mutate(d);
      const before = structuredClone(d);
      assert.throws(() => parseClassBuild(d, catalog));
      assert.deepEqual(d, before);
    });
  assert.throws(() => parseClassBuild("{", catalog));
  assert.throws(() =>
    parseClassBuild(" ".repeat(MAX_BUILD_BYTES + 1), catalog),
  );
});
test("orb dependency, repeater profile and imported passive follow native rules", () => {
  const d = defaultBuild(catalog, "dawnweaver");
  d.recipe.skills = [
    "orbital_collapse",
    "orbital_guard",
    "wild_zap",
    "dawn_bind",
  ];
  d.recipe.passive = "momentum";
  assert.deepEqual(parseClassBuild(d, catalog), d);
  const wild = defaultBuild(catalog, "wildspark");
  assert.deepEqual(buildIssues(wild, catalog), []);
  const d2 = defaultBuild(catalog);
  d2.name = "😀".repeat(80);
  parseClassBuild(d2, catalog);
  d2.name += "😀";
  assert.throws(() => parseClassBuild(d2, catalog));
});
test("workshop snapshot rejects mutated revision, symlink and unsafe template", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "workshop-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const changed = JSON.parse(raw);
  changed.skills[0].manaCost++;
  await writeFile(join(dir, "catalog.json"), JSON.stringify(changed));
  await assert.rejects(
    readWorkshopSnapshot(join(dir, "catalog.json")),
    /revision does not match/,
  );
  await symlink(join(dir, "catalog.json"), join(dir, "link.json"));
  await assert.rejects(
    readWorkshopSnapshot(join(dir, "link.json")),
    /regular file/,
  );
  const unsafe = JSON.parse(raw);
  unsafe.sandboxTemplate.player.god_mode = true;
  assert.throws(() => parseWorkshopCatalog(unsafe), /Unsafe/);
});
test("BFF workshop routes stay exact and preserve method boundary", () => {
  for (const path of [
    "me/class-builds",
    "me/class-builds/" + "a".repeat(64),
    "me/ekza-library",
  ])
    assert.equal(allowedPath(path, "GET"), true);
  assert.equal(allowedPath("me/class-builds", "POST"), true);
  assert.equal(allowedPath("me/class-builds/" + "a".repeat(64), "PATCH"), true);
  assert.equal(
    allowedPath("me/class-builds/" + "a".repeat(64), "DELETE"),
    true,
  );
  for (const path of [
    "me/class-builds/admin",
    "me/class-builds/" + "a".repeat(63),
    "workshop/publish",
    "me/ekza-library/token",
  ])
    for (const method of ["GET", "POST", "PATCH", "DELETE"])
      assert.equal(allowedPath(path, method), false);
  assert.equal(allowedPath("me/class-builds", "PATCH"), false);
  assert.equal(allowedPath("me/ekza-library", "PATCH"), false);
});
test("verification links only accept real studio or explicitly labelled local fixture", () => {
  const prod = { studio: "https://hub.ekza.io" };
  assert.ok(
    safeLibraryVerificationUrl(
      "https://hub.ekza.io/studio?view=connect&code=ABC",
      prod,
    ),
  );
  for (const url of [
    "javascript:alert(1)",
    "https://evil.example/studio?view=connect",
    "https://u:p@hub.ekza.io/studio?view=connect",
    "http://127.0.0.1:40561/studio?view=connect",
    "https://hub.dev.ekza.io/studio?view=connect&code=ABC",
  ])
    assert.equal(safeLibraryVerificationUrl(url, prod), null);
  // The Studio is the active contour's (studioOrigin()); none means no hosted link.
  const dev = { studio: "https://hub.dev.ekza.io" };
  assert.ok(safeLibraryVerificationUrl("https://hub.dev.ekza.io/studio?view=connect&code=ABC", dev));
  assert.equal(safeLibraryVerificationUrl("https://hub.ekza.io/studio?view=connect&code=ABC", dev), null);
  for (const context of [{}, { studio: null }, undefined])
    assert.equal(safeLibraryVerificationUrl("https://hub.ekza.io/studio?view=connect&code=ABC", context), null);
  assert.ok(
    safeLibraryVerificationUrl(
      "http://127.0.0.1:40561/studio?view=connect&code=ABC",
      { prototype: true, loopback: true },
    ),
  );
  assert.equal(
    safeLibraryVerificationUrl("http://127.0.0.1:40561/studio?view=connect", {
      prototype: true,
      loopback: false,
    }),
    null,
  );
});

test("imports match shared Unicode and duplicate-key behavior", () => {
  const d = defaultBuild(catalog);
  d.description = "A first line\nA second line";
  assert.equal(
    parseClassBuild(JSON.stringify(d), catalog).description,
    d.description,
  );
  d.name = "Bad\u0085name";
  assert.throws(() => parseClassBuild(d, catalog), /control/);
  d.name = "Good";
  const raw = JSON.stringify(d);
  for (const field of ["name", "description"]) {
    assert.throws(
      () => parseClassBuild({ ...d, [field]: "Bad\ud800value" }, catalog),
      /surrogate/,
    );
    assert.throws(
      () =>
        parseClassBuild(
          JSON.stringify({ ...d, [field]: "Bad\udc00value" }),
          catalog,
        ),
      /surrogate/,
    );
  }
  for (const spelling of ["1.0", "1e0", "1E+0"]) {
    assert.throws(
      () =>
        parseClassBuild(
          raw.replace('"schema_version":1', '"schema_version":' + spelling),
          catalog,
        ),
      /integer JSON literal/,
    );
  }
  assert.throws(
    () =>
      parseClassBuild(
        raw.replace('"name":"Good"', '"name":"Old","name":"Good"'),
        catalog,
      ),
    /Duplicate JSON field/,
  );
  assert.throws(
    () =>
      parseClassBuild(
        raw.replace('"name":"Good"', '"n\\u0061me":"Old","name":"Good"'),
        catalog,
      ),
    /Duplicate JSON field/,
  );
  assert.throws(
    () =>
      parseClassBuild(
        raw.replace(
          '"core":"dawnweaver"',
          '"core":"wildspark","core":"dawnweaver"',
        ),
        catalog,
      ),
    /Duplicate JSON field/,
  );
  assert.throws(
    () =>
      parseClassBuild(
        { ...d, untrusted: "a".repeat(MAX_BUILD_BYTES) },
        catalog,
      ),
    /too large/,
  );
});
