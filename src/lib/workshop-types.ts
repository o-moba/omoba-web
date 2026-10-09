export type BuildRecipe = {
  schema_version: 1;
  catalog_revision: string;
  core: string;
  passive: string;
  skills: [string, string, string, string];
};
export type ClassBuildDocument = {
  schema: "omoba.class-build.v1";
  name: string;
  description: string;
  recipe: BuildRecipe;
};
export type WorkshopSkill = {
  id: string;
  name: string;
  description: string;
  defaultSlot: "q" | "w" | "e" | "r";
  unlockLevel: number;
  manaCost: number;
  recastManaCost: number;
  cooldownSecs: number;
  castRange: number;
  targeting: string;
  maxRank: number;
  requirements: { attackProfile: string | null; anyOfSkills: string[] };
};
export type WorkshopCatalog = {
  schema: "omoba.workshop.v1";
  schemaVersion: 1;
  revision?: string;
  recipeSchemaVersion: 1;
  gameplayRevision: string;
  protocolVersion: number;
  source?: { commit: string; inputsSha256?: string };
  cores: {
    id: string;
    name: string;
    description: string;
    defaultPassive: string;
    attackProfile: string;
    baseHp: number;
    preset: BuildRecipe;
  }[];
  passives: { id: string; name: string }[];
  skills: WorkshopSkill[];
  sandboxTemplate: {
    version: number;
    player: {
      hero: string;
      recipe?: BuildRecipe;
      max_hp: number;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
};
export type SavedClassBuild = {
  id: string;
  version: string;
  document: ClassBuildDocument;
  created_at: string;
  updated_at: string;
};
export type EkzaLibraryState = {
  state: "not_connected" | "pending" | "connected" | "unavailable";
  username?: string;
  userCode?: string;
  verificationUrl?: string;
  expiresAt?: string;
  prototype?: boolean;
};
