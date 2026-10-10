export type CatalogFile = { url: string; sha256: string; bytes: number };
export type CatalogIcon = CatalogFile & {
  license: string;
  attribution: string;
  x: number;
  y: number;
  width: number;
  height: number;
  atlasWidth: number;
  atlasHeight: number;
};
export type AssetRequirement = {
  id: string;
  name: string;
  role:
    | "held_weapon"
    | "projectile"
    | "world_prop"
    | "engine_effect"
    | "animation_reference";
  classIds: string[];
  uses: {
    skillId?: string;
    basicAttackId?: string;
    state?: string;
    phase?: string;
  }[];
  brief: string;
  status: "supported" | "planned" | "engine_owned";
  profile: { id: string; version: number } | null;
  baseline: {
    kind: "model" | "procedural" | "reference";
    sourcePath: string;
    sha256: string;
    bytes: number;
    url?: string;
    license?: string;
    attribution?: string;
    preview: CatalogFile | null;
  };
};
export type CatalogSkill = {
  id: string;
  name: string;
  description: string;
  requirementIds: string[];
  icon?: CatalogIcon;
};
export type CatalogClass = {
  id: string;
  name: string;
  description: string;
  role: string;
  skills: { slot: "q" | "w" | "e" | "r"; id: string }[];
  basicAttack: { id: string; name: string; requirementIds: string[] };
  requirementIds: string[];
};
export type AssetCatalog = {
  schema: "omoba.asset-catalog.v1";
  schemaVersion: 1;
  projectId: "omoba";
  revision: string;
  source: { commit: string; inputsSha256: string; gameplayRevision: string };
  classes: CatalogClass[];
  skills: CatalogSkill[];
  requirements: AssetRequirement[];
};
