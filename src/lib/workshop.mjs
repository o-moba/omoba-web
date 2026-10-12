export const MAX_BUILD_BYTES = 8192;
export const MAX_WORKSHOP_BYTES = 512 * 1024;
function fail(message) {
  throw new Error(message);
}
function object(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail(name + " must be an object.");
}
function exact(value, keys, name) {
  object(value, name);
  if (Object.keys(value).sort().join(",") !== [...keys].sort().join(","))
    fail(name + " has missing or unsupported fields.");
}
function text(value, name, min, max, controlsAllowed = false) {
  if (
    typeof value === "string" &&
    [...value].some((character) => {
      const point = character.codePointAt(0);
      return point >= 0xd800 && point <= 0xdfff;
    })
  )
    fail(`${name} contains an unpaired Unicode surrogate.`);
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    [...value].length > max ||
    (!controlsAllowed && /\p{Cc}/u.test(value))
  )
    fail(
      `${name} must contain ${min}–${max} characters without control characters.`,
    );
}
function id(value, name) {
  if (typeof value !== "string" || !/^[a-z][a-z0-9_]{0,63}$/.test(value))
    fail("Invalid " + name + ".");
}
function number(value, name, minimum = 0) {
  if (!Number.isFinite(value) || value < minimum || value > 100000)
    fail("Invalid " + name + ".");
}
// A bounded structural scan catches duplicate (including escaped) object keys
// before JSON.parse can silently discard them. JSON.parse still owns grammar.
function uniqueKeys(source) {
  let position = 0;
  const whitespace = () => {
    while (/[ \t\n\r]/.test(source[position] || "x")) position++;
  };
  const string = () => {
    const start = position++;
    while (position < source.length) {
      const character = source[position++];
      if (character === "\\") position++;
      else if (character === '"')
        return JSON.parse(source.slice(start, position));
    }
    fail("This file is not valid JSON.");
  };
  function value(depth = 0, field) {
    if (depth > 24) fail("JSON nesting is too deep.");
    whitespace();
    const first = source[position];
    if (first === '"') {
      string();
      return;
    }
    if (first === "{") {
      position++;
      whitespace();
      const seen = new Set();
      if (source[position] === "}") {
        position++;
        return;
      }
      for (;;) {
        whitespace();
        if (source[position] !== '"') fail("This file is not valid JSON.");
        const key = string();
        if (seen.has(key)) fail("Duplicate JSON field: " + key);
        seen.add(key);
        whitespace();
        if (source[position++] !== ":") fail("This file is not valid JSON.");
        value(depth + 1, key);
        whitespace();
        const separator = source[position++];
        if (separator === "}") return;
        if (separator !== ",") fail("This file is not valid JSON.");
      }
    }
    if (first === "[") {
      position++;
      whitespace();
      if (source[position] === "]") {
        position++;
        return;
      }
      for (;;) {
        value(depth + 1);
        whitespace();
        const separator = source[position++];
        if (separator === "]") return;
        if (separator !== ",") fail("This file is not valid JSON.");
      }
    }
    const start = position;
    while (position < source.length && !/[\s,}\]]/.test(source[position]))
      position++;
    if (position === start) fail("This file is not valid JSON.");
    if (
      field === "schema_version" &&
      !/^(0|[1-9][0-9]*)$/.test(source.slice(start, position))
    )
      fail("Recipe schema_version must use an integer JSON literal.");
  }
  value();
  whitespace();
  if (position !== source.length) fail("This file is not valid JSON.");
}
function json(value, limit) {
  let source;
  try {
    source = typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    fail("This value cannot be represented as JSON.");
  }
  if (typeof source !== "string") fail("This file is not valid JSON.");
  if (new TextEncoder().encode(source).length > limit)
    fail("This JSON file is too large.");
  if (typeof value === "string") {
    uniqueKeys(source);
    try {
      return JSON.parse(source);
    } catch {
      fail("This file is not valid JSON.");
    }
  }
  return value;
}
function rows(value, name, max) {
  if (!Array.isArray(value) || value.length < 1 || value.length > max)
    fail("Invalid " + name + ".");
  const seen = new Set();
  for (const row of value) {
    object(row, name);
    id(row.id, name + " ID");
    if (seen.has(row.id)) fail("Duplicate " + name + " ID.");
    seen.add(row.id);
  }
  return value;
}
export function parseWorkshopCatalog(input) {
  const c = json(input, MAX_WORKSHOP_BYTES);
  object(c, "Workshop catalogue");
  if (
    c.schema !== "omoba.workshop.v1" ||
    c.schemaVersion !== 1 ||
    c.recipeSchemaVersion !== 1
  )
    fail("Unsupported workshop catalogue version.");
  text(c.gameplayRevision, "Gameplay revision", 1, 80);
  number(c.protocolVersion, "Protocol version", 1);
  rows(c.cores, "cores", 64);
  rows(c.passives, "passives", 64);
  rows(c.skills, "skills", 256);
  for (const p of c.passives) text(p.name, "Passive name", 1, 128);
  for (const s of c.skills) {
    text(s.name, "Skill name", 1, 128);
    text(s.description, "Skill description", 1, 1000);
    text(s.targeting, "Targeting", 1, 80);
    if (!["q", "w", "e", "r"].includes(s.defaultSlot))
      fail("Unknown original skill slot.");
    for (const field of [
      "unlockLevel",
      "manaCost",
      "recastManaCost",
      "cooldownSecs",
      "castRange",
      "maxRank",
    ])
      number(s[field], "skill " + field);
    object(s.requirements, "Skill requirements");
    if (s.requirements.attackProfile !== null)
      id(s.requirements.attackProfile, "required attack profile");
    if (
      !Array.isArray(s.requirements.anyOfSkills) ||
      s.requirements.anyOfSkills.some(
        (id) => !c.skills.some((other) => other.id === id),
      )
    )
      fail("Unknown skill dependency.");
  }
  for (const core of c.cores) {
    text(core.name, "Core name", 1, 128);
    text(core.description, "Core description", 1, 1000);
    id(core.attackProfile, "attack profile");
    number(core.baseHp, "base health", 1);
    if (!c.passives.some((p) => p.id === core.defaultPassive))
      fail("Unknown default passive.");
    const problems = recipeIssues(core.preset, c);
    if (
      problems.length ||
      core.preset.core !== core.id ||
      core.preset.passive !== core.defaultPassive
    )
      fail("Invalid core preset: " + problems.join(" "));
  }
  object(c.sandboxTemplate, "Sandbox template");
  object(c.sandboxTemplate.player, "Sandbox player");
  if (
    c.sandboxTemplate.version !== 1 ||
    c.sandboxTemplate.player.god_mode !== false ||
    c.sandboxTemplate.player.infinite_resource !== false ||
    c.sandboxTemplate.player.no_cooldowns !== false ||
    c.sandboxTemplate.enemy?.enabled !== false ||
    c.sandboxTemplate.dummy?.enabled !== true ||
    c.sandboxTemplate.environment?.time_scale !== 1
  )
    fail("Unsafe or unsupported Combat Test template.");
  return c;
}
export function recipeIssues(recipe, catalog) {
  const issues = [];
  try {
    exact(
      recipe,
      ["schema_version", "catalog_revision", "core", "passive", "skills"],
      "Recipe",
    );
  } catch (error) {
    return [error.message];
  }
  if (recipe.schema_version !== catalog.recipeSchemaVersion)
    issues.push("This recipe schema is not supported by this game build.");
  if (recipe.catalog_revision !== catalog.gameplayRevision)
    issues.push(
      "Gameplay revision mismatch. Use a matching game build; the imported draft was not upgraded.",
    );
  const core = catalog.cores.find((c) => c.id === recipe.core);
  if (!core) issues.push("Choose a composable core from this game build.");
  if (!catalog.passives.some((p) => p.id === recipe.passive))
    issues.push("Unknown passive.");
  if (!Array.isArray(recipe.skills) || recipe.skills.length !== 4)
    return [...issues, "Choose exactly four skills for Q, W, E and R."];
  if (new Set(recipe.skills).size !== 4)
    issues.push("Each skill can be assigned only once.");
  for (const id of recipe.skills) {
    const skill = catalog.skills.find((s) => s.id === id);
    if (!skill) {
      issues.push(
        `Skill ${String(id).slice(0, 80)} is not composable in this catalogue.`,
      );
      continue;
    }
    if (
      skill.requirements.attackProfile &&
      core?.attackProfile !== skill.requirements.attackProfile
    )
      issues.push(
        `${skill.name} requires a ${skill.requirements.attackProfile} core attack profile.`,
      );
    if (
      skill.requirements.anyOfSkills.length &&
      !skill.requirements.anyOfSkills.some((id) => recipe.skills.includes(id))
    )
      issues.push(
        `${skill.name} needs ${skill.requirements.anyOfSkills.map((id) => catalog.skills.find((s) => s.id === id)?.name).join(" or ")} in the kit.`,
      );
  }
  return [...new Set(issues)];
}
export function buildIssues(document, catalog) {
  try {
    exact(document, ["schema", "name", "description", "recipe"], "Class build");
    if (document.schema !== "omoba.class-build.v1")
      fail("Unsupported class build format.");
    text(document.name, "Build name", 1, 80);
    text(document.description, "Description", 0, 1000, true);
  } catch (error) {
    return [error.message];
  }
  return recipeIssues(document.recipe, catalog);
}
export function parseClassBuild(input, catalog) {
  const document = json(input, MAX_BUILD_BYTES);
  const issues = buildIssues(document, catalog);
  if (issues.length) fail(issues.join(" "));
  return document;
}
export function defaultBuild(catalog, coreId) {
  const core = catalog.cores.find((c) => c.id === coreId) || catalog.cores[0];
  return {
    schema: "omoba.class-build.v1",
    name: core.name + " draft",
    description: "",
    recipe: structuredClone(core.preset),
  };
}
export function combatTestPreset(document, catalog) {
  parseClassBuild(document, catalog);
  const config = structuredClone(catalog.sandboxTemplate);
  config.player.hero = document.recipe.core;
  config.player.recipe = structuredClone(document.recipe);
  config.player.max_hp = catalog.cores.find(
    (c) => c.id === document.recipe.core,
  ).baseHp;
  return config;
}
export function derivedAssetRequirements(document, assets) {
  const core = assets.classes.find((c) => c.id === document.recipe.core);
  const coreNeeds = new Set(core?.basicAttack.requirementIds || []);
  const skillNeeds = new Set(
    document.recipe.skills.flatMap(
      (id) => assets.skills.find((s) => s.id === id)?.requirementIds || [],
    ),
  );
  return assets.requirements.filter(
    (r) =>
      coreNeeds.has(r.id) ||
      (skillNeeds.has(r.id) &&
        (r.role !== "held_weapon" ||
          r.classIds.includes(document.recipe.core))),
  );
}
/**
 * The Studio approval page of the active contour (`context.studio`, from
 * studioOrigin() on the server) or an explicitly labelled local fixture. No
 * Studio (a misconfigured contour) accepts nothing but the fixture.
 */
export function safeLibraryVerificationUrl(value, context = {}) {
  try {
    const url = new URL(value);
    const hosted =
      typeof context.studio === "string" &&
      url.protocol === "https:" &&
      url.origin === context.studio;
    const fixture =
      context.prototype === true &&
      context.loopback === true &&
      url.protocol === "http:" &&
      ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
    if (
      url.username ||
      url.password ||
      (!hosted && !fixture) ||
      url.pathname !== "/studio" ||
      url.searchParams.get("view") !== "connect"
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}
