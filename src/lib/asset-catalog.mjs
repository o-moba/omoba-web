// Portable read-only v1 SDK: no network, framework, or Account API dependencies.
export const MAX_CATALOG_BYTES = 2 * 1024 * 1024;
const HASH = /^[a-f0-9]{64}$/;
const ID = /^[a-z][a-z0-9_.-]{0,127}$/;
const LICENSES = new Set([
  "CC-BY-4.0",
  "CC0-1.0",
  "MIT",
  "Apache-2.0",
  "BSD-3-Clause",
]);
function fail(message) {
  throw new Error("Invalid asset catalogue: " + message);
}
function object(value, at) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail(at + " must be an object");
  return value;
}
function text(value, at, max = 8192) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value)
  )
    fail(at + " must be bounded text");
  return value;
}
function list(value, at, max = 1024) {
  if (!Array.isArray(value) || value.length > max)
    fail(at + " must be a bounded array");
  return value;
}
function id(value, at) {
  if (typeof value !== "string" || !ID.test(value))
    fail(at + " must be a semantic ID");
  return value;
}
function digest(value, at) {
  if (typeof value !== "string" || !HASH.test(value))
    fail(at + " must be SHA-256");
}
function integer(value, at, max = 64 * 1024 * 1024) {
  if (!Number.isSafeInteger(value) || value < 1 || value > max)
    fail(at + " is out of bounds");
}
function path(value, at) {
  text(value, at, 512);
  if (
    !/^[A-Za-z0-9_./-]+$/.test(value) ||
    value.startsWith("/") ||
    value.split("/").some((p) => !p || p === "." || p === "..")
  )
    fail(at + " must be a safe relative path");
}
function ids(value, at) {
  const all = list(value, at).map((v) => id(v, at));
  if (new Set(all).size !== all.length) fail(at + " contains duplicates");
  return all;
}
function index(values, at, max) {
  const map = new Map();
  for (const item of list(values, at, max)) {
    object(item, at);
    id(item.id, at);
    if (map.has(item.id)) fail("duplicate " + at + " ID: " + item.id);
    map.set(item.id, item);
  }
  if (!map.size) fail(at + " is empty");
  return map;
}
function ref(map, key, at) {
  if (!map.has(key)) fail("dangling " + at + ": " + key);
}
function file(value, at, extension) {
  object(value, at);
  digest(value.sha256, at);
  integer(value.bytes, at);
  if (value.url !== "/asset-catalog/files/" + value.sha256 + "." + extension)
    fail(at + " must use a local content-addressed URL");
}
function licensed(value, at) {
  if (!LICENSES.has(value.license))
    fail(at + " requires a recognized redistribution license");
  text(value.attribution, at + ".attribution", 512);
}
/** @returns {import('./asset-catalog-types').AssetCatalog} */
export function parseAssetCatalog(value) {
  if (typeof value === "string") {
    if (new TextEncoder().encode(value).length > MAX_CATALOG_BYTES)
      fail("snapshot too large");
    try {
      value = JSON.parse(value);
    } catch {
      fail("malformed JSON");
    }
  }
  object(value, "root");
  if (
    value.schema !== "omoba.asset-catalog.v1" ||
    value.schemaVersion !== 1 ||
    value.projectId !== "omoba"
  )
    fail("unsupported schema");
  if (
    typeof value.revision !== "string" ||
    !/^sha256-[a-f0-9]{64}$/.test(value.revision)
  )
    fail("revision");
  object(value.source, "source");
  if (
    typeof value.source.commit !== "string" ||
    !/^[a-f0-9]{40}$/.test(value.source.commit)
  )
    fail("source commit");
  digest(value.source.inputsSha256, "source inputs");
  text(value.source.gameplayRevision, "gameplay revision", 128);
  const classes = index(value.classes, "classes", 64),
    skills = index(value.skills, "skills", 256),
    requirements = index(value.requirements, "requirements", 1024),
    attacks = new Map();
  for (const c of classes.values()) {
    text(c.name, "class name", 128);
    text(c.description, "class description");
    text(c.role, "class role", 128);
    const slots = list(c.skills, "class skills", 4);
    if (slots.length !== 4 || new Set(slots.map((s) => s.slot)).size !== 4)
      fail("class needs unique QWER slots");
    for (const s of slots) {
      object(s, "class skill");
      if (!["q", "w", "e", "r"].includes(s.slot)) fail("unknown skill slot");
      ref(skills, s.id, "class skill");
    }
    object(c.basicAttack, "basic attack");
    id(c.basicAttack.id, "basic attack");
    text(c.basicAttack.name, "basic attack name", 128);
    if (attacks.has(c.basicAttack.id)) fail("duplicate basic attack");
    attacks.set(c.basicAttack.id, c);
    ids(c.basicAttack.requirementIds, "basic attack requirements").forEach(
      (r) => ref(requirements, r, "basic attack requirement"),
    );
    ids(c.requirementIds, "class requirements").forEach((r) =>
      ref(requirements, r, "class requirement"),
    );
  }
  for (const s of skills.values()) {
    text(s.name, "skill name", 128);
    text(s.description, "skill description");
    ids(s.requirementIds, "skill requirements").forEach((r) =>
      ref(requirements, r, "skill requirement"),
    );
    if (s.icon != null) {
      const i = s.icon;
      file(i, "icon", "png");
      licensed(i, "icon");
      for (const key of ["width", "height", "atlasWidth", "atlasHeight"])
        integer(i[key], "icon " + key, 32768);
      for (const key of ["x", "y"])
        if (!Number.isSafeInteger(i[key]) || i[key] < 0)
          fail("icon coordinate");
      if (i.x + i.width > i.atlasWidth || i.y + i.height > i.atlasHeight)
        fail("icon outside atlas");
    }
  }
  for (const r of requirements.values()) {
    text(r.name, "requirement name", 128);
    text(r.brief, "requirement brief");
    if (
      ![
        "held_weapon",
        "projectile",
        "world_prop",
        "engine_effect",
        "animation_reference",
      ].includes(r.role)
    )
      fail("requirement role");
    if (!["supported", "planned", "engine_owned"].includes(r.status))
      fail("requirement status");
    if (r.status === "supported") {
      if (
        r.role !== "held_weapon" ||
        r.profile?.id !== "handheld-glb-v1" ||
        r.profile?.version !== 1
      )
        fail("unsupported contribution profile");
    } else if (r.profile !== null)
      fail("non-supported requirement has a profile");
    const owners = ids(r.classIds, "requirement classes");
    if (!owners.length) fail("requirement has no class");
    owners.forEach((c) => {
      ref(classes, c, "requirement class");
      if (!classes.get(c).requirementIds.includes(r.id))
        fail("inconsistent class requirement");
    });
    for (const use of list(r.uses, "requirement uses", 256)) {
      object(use, "requirement use");
      if (!use.skillId && !use.basicAttackId && !use.state)
        fail("empty requirement use");
      if (use.skillId) {
        ref(skills, use.skillId, "requirement skill");
        if (!skills.get(use.skillId).requirementIds.includes(r.id))
          fail("inconsistent skill requirement");
        if (
          !owners.some((c) =>
            classes.get(c).skills.some((s) => s.id === use.skillId),
          )
        )
          fail("requirement skill outside classes");
      }
      if (use.basicAttackId) {
        ref(attacks, use.basicAttackId, "requirement attack");
        if (
          !attacks
            .get(use.basicAttackId)
            .basicAttack.requirementIds.includes(r.id) ||
          !owners.includes(attacks.get(use.basicAttackId).id)
        )
          fail("inconsistent basic attack requirement");
      }
      if (use.state) id(use.state, "state");
      if (use.phase) id(use.phase, "phase");
    }
    const b = object(r.baseline, "baseline");
    if (!["model", "procedural", "reference"].includes(b.kind))
      fail("baseline kind");
    path(b.sourcePath, "source path");
    digest(b.sha256, "baseline hash");
    integer(b.bytes, "baseline bytes");
    if (b.kind === "model") {
      file(b, "model", "glb");
      licensed(b, "model");
    } else if (b.url != null) fail("reference baseline cannot be downloadable");
    if (b.preview !== null) {
      file(b.preview, "preview", "png");
      if (b.kind !== "model") fail("only models have previews");
    }
  }
  for (const c of classes.values()) {
    const required = new Set([
      ...c.basicAttack.requirementIds,
      ...c.skills.flatMap((s) => skills.get(s.id).requirementIds),
    ]);
    // Shared motion/state references may be class-level additions.
    for (const r of required)
      if (!c.requirementIds.includes(r))
        fail("class missing skill requirement");
    for (const r of c.requirementIds)
      if (!requirements.get(r).classIds.includes(c.id))
        fail("inconsistent requirement class");
  }
  for (const s of skills.values())
    for (const r of s.requirementIds)
      if (!requirements.get(r).uses.some((u) => u.skillId === s.id))
        fail("missing reverse skill use");
  for (const c of classes.values())
    for (const r of c.basicAttack.requirementIds)
      if (
        !requirements
          .get(r)
          .uses.some((u) => u.basicAttackId === c.basicAttack.id)
      )
        fail("missing reverse attack use");
  return value;
}
export function catalogFiles(catalog) {
  const files = new Map();
  const add = (value) => {
    if (!value?.url) return;
    const old = files.get(value.url);
    if (old && (old.sha256 !== value.sha256 || old.bytes !== value.bytes))
      fail("conflicting file metadata");
    files.set(value.url, value);
  };
  for (const s of catalog.skills) add(s.icon);
  for (const r of catalog.requirements) {
    add(r.baseline);
    add(r.baseline.preview);
  }
  return [...files.values()];
}
export function contributionBrief(catalog, requirementId, classId) {
  const r = catalog.requirements.find((r) => r.id === requirementId);
  if (!r || !r.classIds.includes(classId)) fail("brief target");
  return {
    schema: "omoba.contribution-brief.v1",
    catalogRevision: catalog.revision,
    source: catalog.source,
    classId,
    requirementId: r.id,
    name: r.name,
    role: r.role,
    status: r.status,
    profile: r.profile,
    brief: r.brief,
    uses: r.uses,
    baseline: r.baseline,
    workflow:
      "Preparation only. Save this brief with your design. Studio drafts are not exact-slot submissions or approvals; publication and in-game equipping are not connected yet.",
  };
}
