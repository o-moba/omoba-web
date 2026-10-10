import test from "node:test";
import assert from "node:assert/strict";
import {
  readFile,
  writeFile,
  mkdtemp,
  mkdir,
  cp,
  rm,
  symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import {
  parseAssetCatalog,
  contributionBrief,
  catalogFiles,
  MAX_CATALOG_BYTES,
} from "../src/lib/asset-catalog.mjs";
import { catalogRevision } from "../src/lib/asset-catalog-server.mjs";
import {
  validateExport,
  importCatalog,
} from "../scripts/import-asset-catalog.mjs";
const snapshot = JSON.parse(
  await readFile(
    new URL("../public/asset-catalog/catalog.json", import.meta.url),
    "utf8",
  ),
);
const valid = () => structuredClone(snapshot);
const model = (c) => c.requirements.find((r) => r.baseline.kind === "model");

test("reviewed snapshot covers every class and skill; files validate against SHA-256", async () => {
  const result = await validateExport(
    new URL("../public/asset-catalog/", import.meta.url).pathname,
  );
  assert.equal(result.catalog.classes.length, 17);
  assert.equal(result.catalog.skills.length, 68);
  assert.equal(result.catalog.classes.flatMap((c) => c.skills).length, 68);
  assert.ok(result.files.length >= 10);
  assert.equal(
    new Set(result.files.map((f) => f.relative)).size,
    result.files.length,
  );
});

test("parser rejects hostile and inconsistent snapshots", async (t) => {
  const cases = {
    "future schema": (c) => c.schemaVersion++,
    "foreign project": (c) => (c.projectId = "other"),
    "duplicate class": (c) => c.classes.push(c.classes[0]),
    "duplicate skill": (c) => c.skills.push(c.skills[0]),
    "duplicate requirement": (c) => c.requirements.push(c.requirements[0]),
    "unknown class skill": (c) => (c.classes[0].skills[0].id = "missing"),
    "missing skill requirement": (c) =>
      c.skills[0].requirementIds.push("missing"),
    "duplicate QWER slot": (c) => (c.classes[0].skills[0].slot = "w"),
    "invalid QWER slot": (c) => (c.classes[0].skills[0].slot = "z"),
    "missing QWER slot": (c) => c.classes[0].skills.pop(),
    "dangling class requirement": (c) =>
      c.classes[0].requirementIds.push("missing"),
    "dangling requirement class": (c) =>
      c.requirements[0].classIds.push("missing"),
    "dangling use skill": (c) =>
      c.requirements[0].uses.push({ skillId: "missing" }),
    "inconsistent reverse use": (c) =>
      c.skills[0].requirementIds.push(model(c).id),
    "inconsistent class use": (c) => (c.classes[0].requirementIds = []),
    "future approval status": (c) => (c.requirements[0].status = "approved"),
    "planned submission profile": (c) => {
      const r = model(c);
      r.status = "planned";
    },
    "supported animation": (c) => {
      const r = model(c);
      r.role = "animation_reference";
    },
    "unsupported profile version": (c) => model(c).profile.version++,
    "remote URL": (c) =>
      (model(c).baseline.url = "https://evil.example/model.glb"),
    "protocol-relative URL": (c) =>
      (model(c).baseline.url = "//evil.example/model.glb"),
    "path traversal URL": (c) =>
      (model(c).baseline.url = "/asset-catalog/files/../secret"),
    "encoded traversal URL": (c) =>
      (model(c).baseline.url = "/asset-catalog/files/%2e%2e/secret"),
    "external source path": (c) =>
      (model(c).baseline.sourcePath = "/etc/passwd"),
    "source traversal": (c) => (model(c).baseline.sourcePath = "../secret"),
    "backslash source path": (c) =>
      (model(c).baseline.sourcePath = "client\\secret"),
    "missing model license": (c) => delete model(c).baseline.license,
    "missing attribution": (c) => delete model(c).baseline.attribution,
    "unlicensed model": (c) => (model(c).baseline.license = "unknown"),
    "missing explicit preview": (c) => delete model(c).baseline.preview,
    "invalid file size": (c) => (model(c).baseline.bytes = -1),
    "oversized file": (c) => (model(c).baseline.bytes = 100 * 1024 * 1024),
    "invalid hash": (c) => (model(c).baseline.sha256 = "nope"),
    "array hash": (c) =>
      (model(c).baseline.sha256 = [model(c).baseline.sha256]),
    "array revision": (c) => (c.revision = [c.revision]),
    "array commit": (c) => (c.source.commit = [c.source.commit]),
    "unsafe semantic id": (c) => (c.classes[0].id = "../class"),
    "invalid source commit": (c) => (c.source.commit = "latest"),
    "unbounded brief": (c) => (c.requirements[0].brief = "a".repeat(8193)),
    "unbounded class count": (c) => (c.classes = Array(65).fill(c.classes[0])),
    "bad sprite coordinates": (c) => (c.skills.find((s) => s.icon).icon.x = -1),
    "sprite outside atlas": (c) => {
      const i = c.skills.find((s) => s.icon).icon;
      i.x = i.atlasWidth;
    },
  };
  for (const [name, mutate] of Object.entries(cases))
    await t.test(name, () => {
      const c = valid();
      mutate(c);
      assert.throws(() => parseAssetCatalog(c));
    });
  assert.throws(() => parseAssetCatalog("{"));
  assert.throws(() => parseAssetCatalog(" ".repeat(MAX_CATALOG_BYTES + 1)));
});

test("brief pins source, slot, class, profile, references and manual workflow", () => {
  const c = parseAssetCatalog(valid()),
    r = model(c),
    classId = r.classIds[0];
  const brief = contributionBrief(c, r.id, classId);
  assert.equal(brief.catalogRevision, c.revision);
  assert.equal(brief.requirementId, r.id);
  assert.equal(brief.classId, classId);
  assert.deepEqual(brief.profile, r.profile);
  assert.equal(brief.source.commit, c.source.commit);
  assert.match(brief.workflow, /not exact-slot/);
  assert.throws(() => contributionBrief(c, r.id, "missing"));
  assert.throws(() => contributionBrief(c, "missing", classId));
});

test("import is repeatable and invalid inputs preserve the previous snapshot", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "omoba-catalog-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const input = join(dir, "input"),
    target = join(dir, "public", "asset-catalog");
  await cp(resolve("public/asset-catalog"), input, { recursive: true });
  await importCatalog(input, target);
  const before = await readFile(join(target, "catalog.json"));
  await importCatalog(input, target);
  assert.deepEqual(await readFile(join(target, "catalog.json")), before);
  const first = catalogFiles(snapshot)[0].url.slice("/asset-catalog/".length);
  await writeFile(join(input, first), "tampered");
  await assert.rejects(importCatalog(input, target), /digest\/size mismatch/);
  assert.deepEqual(await readFile(join(target, "catalog.json")), before);
  await rm(join(input, first));
  await assert.rejects(importCatalog(input, target), /ENOENT/);
  await symlink(join(target, first), join(input, first));
  await assert.rejects(importCatalog(input, target), /Symbolic link rejected/);
  await rm(join(input, first));
  await cp(join(target, first), join(input, first));
  await rm(join(input, "catalog.json"));
  await symlink(join(target, "catalog.json"), join(input, "catalog.json"));
  await assert.rejects(importCatalog(input, target), /Symbolic link rejected/);
});

test("malformed GLB fails even if its digest matches; extra files are never imported", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "omoba-catalog-format-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const input = join(dir, "input");
  await cp(resolve("public/asset-catalog"), input, { recursive: true });
  await writeFile(join(input, "private.txt"), "must not copy");
  const c = valid(),
    b = model(c).baseline,
    bytes = Buffer.from("not a glb but correctly hashed");
  const oldHash = b.sha256,
    newHash = createHash("sha256").update(bytes).digest("hex");
  for (const r of c.requirements)
    if (r.baseline.sha256 === oldHash)
      Object.assign(r.baseline, {
        sha256: newHash,
        bytes: bytes.length,
        url: "/asset-catalog/files/" + newHash + ".glb",
      });
  await writeFile(join(input, "files", newHash + ".glb"), bytes);
  c.revision = catalogRevision(c);
  await writeFile(join(input, "catalog.json"), JSON.stringify(c));
  await assert.rejects(validateExport(input), /Invalid GLB/);
  await writeFile(join(input, "catalog.json"), JSON.stringify(snapshot));
  await importCatalog(input, join(dir, "out"));
  await assert.rejects(readFile(join(dir, "out", "private.txt")), /ENOENT/);
});

test("semantic mutations cannot reuse a revision, and unmanaged destination files survive", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "omoba-catalog-identity-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const input = join(dir, "input"),
    target = join(dir, "target");
  await cp(resolve("public/asset-catalog"), input, { recursive: true });
  const changed = valid();
  changed.requirements[0].brief += " modified";
  await writeFile(join(input, "catalog.json"), JSON.stringify(changed));
  await assert.rejects(validateExport(input), /revision does not match/);
  await writeFile(join(input, "catalog.json"), JSON.stringify(snapshot));
  await importCatalog(input, target);
  await writeFile(join(target, "unrelated.txt"), "keep me");
  await assert.rejects(importCatalog(input, target), /unmanaged destination/);
  assert.equal(
    await readFile(join(target, "unrelated.txt"), "utf8"),
    "keep me",
  );
});
