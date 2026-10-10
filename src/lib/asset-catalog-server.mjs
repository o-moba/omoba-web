import { createHash } from "node:crypto";
// v1 exporter canonicalization: recursively sorted ASCII keys, UTF-8 JSON,
// integral floats normalized to integers; finite JS-safe numeric range only.
function canonical(value) {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value !== null && typeof value === "object")
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map((key) => JSON.stringify(key) + ":" + canonical(value[key]))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
export function catalogRevision(catalog) {
  const { revision: _revision, ...body } = catalog;
  return (
    "sha256-" +
    createHash("sha256").update(canonical(body), "utf8").digest("hex")
  );
}
export function verifyCatalogRevision(catalog) {
  if (catalog.revision !== catalogRevision(catalog))
    throw new Error("Catalogue revision does not match its content");
  return catalog;
}
