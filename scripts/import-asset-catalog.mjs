#!/usr/bin/env node
import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { resolve, join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import {
  parseAssetCatalog,
  catalogFiles,
  MAX_CATALOG_BYTES,
} from "../src/lib/asset-catalog.mjs";
import { verifyCatalogRevision } from "../src/lib/asset-catalog-server.mjs";

// No recursive copying: only the validated manifest and its exact asset set cross the bridge.
async function regularFile(root, relative, limit) {
  let current = root;
  for (const segment of relative.split("/")) {
    current = join(current, segment);
    const stat = await lstat(current);
    if (stat.isSymbolicLink())
      throw new Error("Symbolic link rejected: " + relative);
  }
  const stat = await lstat(current);
  if (!stat.isFile() || stat.size > limit)
    throw new Error("Invalid or oversized file: " + relative);
  return readFile(current);
}
export async function validateExport(directory) {
  const root = resolve(directory);
  if ((await lstat(root)).isSymbolicLink())
    throw new Error("Export directory must not be a symlink");
  const raw = await regularFile(root, "catalog.json", MAX_CATALOG_BYTES);
  const catalog = verifyCatalogRevision(
    parseAssetCatalog(raw.toString("utf8")),
  );
  const files = [];
  let total = 0;
  for (const entry of catalogFiles(catalog)) {
    total += entry.bytes;
    if (total > 256 * 1024 * 1024)
      throw new Error("Catalogue file budget exceeded");
    const relative = entry.url.slice("/asset-catalog/".length);
    const bytes = await regularFile(root, relative, entry.bytes);
    if (
      bytes.length !== entry.bytes ||
      createHash("sha256").update(bytes).digest("hex") !== entry.sha256
    )
      throw new Error("Asset digest/size mismatch: " + relative);
    if (
      relative.endsWith(".png") &&
      !bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    )
      throw new Error("Invalid PNG: " + relative);
    if (
      relative.endsWith(".glb") &&
      (bytes.length < 12 ||
        bytes.toString("ascii", 0, 4) !== "glTF" ||
        bytes.readUInt32LE(4) !== 2 ||
        bytes.readUInt32LE(8) !== bytes.length)
    )
      throw new Error("Invalid GLB: " + relative);
    files.push({ relative, bytes });
  }
  return { catalog, raw, files };
}
async function assertManagedTarget(target) {
  try {
    await lstat(target);
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  const existing = await validateExport(target);
  const expected = new Set([
    "catalog.json",
    "files",
    ...existing.files.map((f) => f.relative),
  ]);
  async function inspect(relative = "") {
    for (const entry of await readdir(join(target, relative), {
      withFileTypes: true,
    })) {
      const path = relative ? relative + "/" + entry.name : entry.name;
      if (entry.isSymbolicLink() || !expected.has(path))
        throw new Error(
          "Refusing to replace unmanaged destination content: " + path,
        );
      if (entry.isDirectory()) await inspect(path);
    }
  }
  await inspect();
}
export async function importCatalog(directory, destination) {
  const { catalog, raw, files } = await validateExport(directory);
  const target = resolve(destination),
    parent = dirname(target);
  await mkdir(parent, { recursive: true });
  await assertManagedTarget(target);
  const staging = await mkdtemp(join(parent, ".asset-catalog-stage-"));
  const backup = staging + "-previous";
  let moved = false;
  try {
    await mkdir(join(staging, "files"));
    for (const file of files)
      await writeFile(join(staging, file.relative), file.bytes);
    await writeFile(join(staging, "catalog.json"), raw);
    try {
      await rename(target, backup);
      moved = true;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    try {
      await rename(staging, target);
    } catch (error) {
      if (moved) await rename(backup, target);
      throw error;
    }
    if (moved) await rm(backup, { recursive: true });
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
  return catalog;
}
async function main() {
  const args = process.argv.slice(2);
  let temporary;
  try {
    let exported;
    if (args.length === 1 && args[0] === "--check") {
      const result = await validateExport(
        fileURLToPath(new URL("../public/asset-catalog", import.meta.url)),
      );
      console.log("Verified catalogue " + result.catalog.revision);
      return;
    }
    if (
      args[0] === "--game" &&
      (args.length === 2 || (args.length === 4 && args[2] === "--preview-dir"))
    ) {
      const game = resolve(args[1]);
      temporary = await mkdtemp(join(tmpdir(), "omoba-catalog-export-"));
      const exporterArgs = [
        join(game, "scripts/export_asset_catalog.py"),
        "--output",
        temporary,
        "--public-prefix",
        "/asset-catalog",
      ];
      if (args[2]) exporterArgs.push("--preview-dir", resolve(args[3]));
      execFileSync("python3", exporterArgs, { stdio: "inherit" });
      exported = temporary;
    } else if (args.length === 1 && !args[0].startsWith("-"))
      exported = resolve(args[0]);
    else
      throw new Error(
        "Usage: npm run catalog:import -- <export-directory> | --game <explicit-game-checkout> [--preview-dir <directory>]",
      );
    const catalog = await importCatalog(
      exported,
      fileURLToPath(new URL("../public/asset-catalog", import.meta.url)),
    );
    console.log(
      `Imported ${catalog.classes.length} classes, ${catalog.skills.length} skills, ${catalog.requirements.length} requirements at ${catalog.revision}`,
    );
  } finally {
    if (temporary) await rm(temporary, { recursive: true, force: true });
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
