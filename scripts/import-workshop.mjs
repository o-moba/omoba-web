#!/usr/bin/env node
import { lstat, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseWorkshopCatalog,
  MAX_WORKSHOP_BYTES,
} from "../src/lib/workshop.mjs";
import { verifyCatalogRevision } from "../src/lib/asset-catalog-server.mjs";
const target = fileURLToPath(
  new URL("../public/workshop/catalog.json", import.meta.url),
);
export async function readWorkshopSnapshot(path) {
  const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_WORKSHOP_BYTES)
    throw new Error("Workshop snapshot must be a bounded regular file");
  const raw = await readFile(path, "utf8");
  const catalog = verifyCatalogRevision(parseWorkshopCatalog(raw));
  if (
    !/^[0-9a-f]{40}$/.test(catalog.source?.commit || "") ||
    !/^[0-9a-f]{64}$/.test(catalog.source?.inputsSha256 || "")
  )
    throw new Error("Workshop source provenance is missing");
  return { raw, catalog };
}
async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1)
    throw new Error(
      "Usage: npm run workshop:import -- /absolute/path/to/game/shared/assets/catalog/workshop.json | --check",
    );
  const { raw, catalog } = await readWorkshopSnapshot(
    args[0] === "--check" ? target : resolve(args[0]),
  );
  if (args[0] !== "--check") {
    const dir = fileURLToPath(new URL("../public/workshop/", import.meta.url));
    await mkdir(dir, { recursive: true });
    const temporary = target + ".tmp-" + process.pid;
    await writeFile(temporary, raw, { flag: "wx" });
    await rename(temporary, target);
  }
  console.log(
    `${args[0] === "--check" ? "Verified" : "Imported"} workshop: ${catalog.cores.length} cores / ${catalog.skills.length} skills / ${catalog.revision}`,
  );
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
