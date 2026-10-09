"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api, ApiFailure } from "@/lib/client-api";
import type { Account } from "@/lib/types";
import type { AssetCatalog, CatalogIcon } from "@/lib/asset-catalog-types";
import type {
  ClassBuildDocument,
  WorkshopCatalog,
  SavedClassBuild,
  EkzaLibraryState,
} from "@/lib/workshop-types";
import {
  buildIssues,
  combatTestPreset,
  defaultBuild,
  derivedAssetRequirements,
  MAX_BUILD_BYTES,
  parseClassBuild,
  safeLibraryVerificationUrl,
} from "@/lib/workshop.mjs";
const RECOVERY_KEY = "omoba.workshop.recovery.v1",
  SAVED_KEY = "omoba.workshop.saved.v1";
const slots = ["Q", "W", "E", "R"];
function SkillIcon({ icon }: { icon?: CatalogIcon }) {
  return icon ? (
    <span
      className="creator-skill-icon"
      aria-hidden="true"
      style={{
        backgroundImage: `url("${icon.url}")`,
        backgroundSize: `${(icon.atlasWidth / icon.width) * 100}% ${(icon.atlasHeight / icon.height) * 100}%`,
        backgroundPosition: `${(icon.x / (icon.atlasWidth - icon.width || 1)) * 100}% ${(icon.y / (icon.atlasHeight - icon.height || 1)) * 100}%`,
      }}
    />
  ) : (
    <span className="creator-skill-icon creator-icon-empty" aria-hidden="true">
      ✦
    </span>
  );
}
function download(value: unknown, name: string, raw = false) {
  const url = URL.createObjectURL(
    new Blob([raw ? String(value) : JSON.stringify(value, null, 2) + "\n"], {
      type: "application/json",
    }),
  );
  const a = window.document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function Workshop({
  catalog,
  assets,
  initialAccount,
  initiallyUnavailable,
}: {
  catalog: WorkshopCatalog;
  assets: AssetCatalog;
  initialAccount: Account | null;
  initiallyUnavailable: boolean;
}) {
  const [document, setDocument] = useState<ClassBuildDocument>(() =>
    defaultBuild(catalog, "dawnweaver"),
  );
  const [activeSlot, setActiveSlot] = useState(0),
    [search, setSearch] = useState(""),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [hydrated, setHydrated] = useState(false),
    [recoveryWritable, setRecoveryWritable] = useState(false),
    [failedRecovery, setFailedRecovery] = useState<string | null>(null),
    [localSaved, setLocalSaved] = useState(false);
  const [account, setAccount] = useState<Account | null>(initialAccount),
    [accountState, setAccountState] = useState<
      "guest" | "connected" | "unavailable"
    >(
      initiallyUnavailable
        ? "unavailable"
        : initialAccount
          ? "connected"
          : "guest",
    );
  const [builds, setBuilds] = useState<SavedClassBuild[]>([]),
    [selectedBuild, setSelectedBuild] = useState<{
      id: string;
      version: string;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [library, setLibrary] = useState<EkzaLibraryState | null>(null),
    [libraryBusy, setLibraryBusy] = useState(false);
  const [pendingOperation] = useState<{ fingerprint?: string; key?: string }>(
    {},
  );
  const fileInput = useRef<HTMLInputElement>(null);
  const editorContext = useRef(0);
  const issues = buildIssues(document, catalog),
    core = catalog.cores.find((c) => c.id === document.recipe.core)!;
  const needs = derivedAssetRequirements(document, assets),
    coreAssets = assets.classes.find((c) => c.id === document.recipe.core);
  const selectedSkill = catalog.skills.find(
    (s) => s.id === document.recipe.skills[activeSlot],
  )!;
  const matches = catalog.skills.filter(
    (s) =>
      !search.trim() ||
      [s.name, s.description, s.id, s.targeting].some((v) =>
        v.toLowerCase().includes(search.trim().toLowerCase()),
      ),
  );
  function feedback(message: string) {
    setError("");
    setNotice(message);
  }
  function accountError(cause: unknown) {
    if (cause instanceof ApiFailure) {
      if (cause.status === 401) {
        setAccount(null);
        setAccountState("guest");
        setBuilds([]);
        setLibrary(null);
        setSelectedBuild(null);
        return "Your account session ended. Your browser draft is still here. Sign in to save it to your account.";
      }
      if (cause.status === 409)
        return cause.code === "class_build_limit"
          ? "Your account draft limit is reached. Delete an old saved build or keep this one in your browser."
          : "This account build changed elsewhere. Your edits are preserved. Refresh saved builds, then load that version or save your edits as a copy.";
      if (cause.status >= 500) {
        setAccountState("unavailable");
        return "Account service is unavailable. Your browser draft is preserved; you can keep editing and export JSON.";
      }
      if (cause.status === 429)
        return "Too many account requests. Keep your draft and try again shortly.";
      if (cause.status === 400)
        return "The game rejected this build. Check its skill dependencies and gameplay revision.";
    }
    return "The request could not be completed. Your draft is preserved.";
  }
  function replace(next: ClassBuildDocument, message: string) {
    editorContext.current++;
    setDocument(next);
    setSelectedBuild(null);
    feedback(message);
  }
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(RECOVERY_KEY);
      if (raw) setDocument(parseClassBuild(raw, catalog));
      setLocalSaved(Boolean(localStorage.getItem(SAVED_KEY)));
      setRecoveryWritable(true);
    } catch {
      setFailedRecovery(raw);
      setRecoveryWritable(false);
      setError(
        "The browser recovery draft could not be read or is incompatible. Automatic recovery is paused so the original is preserved. Save a separate browser draft or download your current build.",
      );
    }
    setHydrated(true);
  }, [catalog]);
  useEffect(() => {
    if (!hydrated || !recoveryWritable || issues.length) return;
    try {
      localStorage.setItem(RECOVERY_KEY, JSON.stringify(document));
    } catch {
      setError(
        "Browser storage is unavailable. Download your build JSON to keep it.",
      );
    }
  }, [document, hydrated, recoveryWritable, catalog, issues.length]);
  async function refreshBuilds() {
    try {
      const result = await api<{ builds: SavedClassBuild[] }>(
        "me/class-builds",
      );
      setBuilds(result.builds);
      setAccountState("connected");
    } catch (cause) {
      setError(accountError(cause));
    }
  }
  async function refreshLibrary() {
    try {
      setLibrary(await api<EkzaLibraryState>("me/ekza-library"));
    } catch {
      setLibrary({ state: "unavailable" });
    }
  }
  useEffect(() => {
    if (!account) return;
    void refreshBuilds();
    void refreshLibrary();
  }, [account?.profile.profile_id]);
  async function refreshAccount() {
    setBusy(true);
    try {
      const result = await api<Account>("me");
      setAccount(result);
      setAccountState("connected");
      await refreshBuilds();
      await refreshLibrary();
      feedback("Account connection refreshed. Your editor was kept.");
    } catch (cause) {
      setError(accountError(cause));
    } finally {
      setBusy(false);
    }
  }
  function chooseCore(id: string) {
    editorContext.current++;
    const next = catalog.cores.find((c) => c.id === id)!;
    setDocument((current) => ({
      ...current,
      recipe: structuredClone(next.preset),
    }));
    setSelectedBuild(null);
    feedback(
      "Core preset loaded. Name and notes were kept; QWER now use the core defaults.",
    );
  }
  function saveLocal() {
    try {
      parseClassBuild(document, catalog);
      localStorage.setItem(SAVED_KEY, JSON.stringify(document));
      setLocalSaved(true);
      feedback("Saved in this browser. It has not been uploaded.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save browser draft.",
      );
    }
  }
  function loadLocal() {
    try {
      const raw = localStorage.getItem(SAVED_KEY);
      if (!raw) throw new Error("No saved browser draft yet.");
      replace(parseClassBuild(raw, catalog), "Loaded your browser draft.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not load browser draft.",
      );
    }
  }
  async function importFile(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > MAX_BUILD_BYTES)
        throw new Error("Build files must be no larger than 8 KiB.");
      const bytes = await file.arrayBuffer();
      let source: string;
      try {
        source = new TextDecoder("utf-8", {
          fatal: true,
          ignoreBOM: true,
        }).decode(bytes);
      } catch {
        throw new Error("Build files must contain valid UTF-8 text.");
      }
      replace(
        parseClassBuild(source, catalog),
        "Imported a compatible build. Save it in your browser or account when ready.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not import this build.",
      );
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  async function saveAccount(asCopy = false) {
    if (issues.length || !account || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    const startedContext = editorContext.current;
    const target = !asCopy ? selectedBuild : null;
    const path = target ? "me/class-builds/" + target.id : "me/class-builds";
    const body = target
      ? { expected_version: target.version, document }
      : { document };
    const fingerprint = JSON.stringify({ path, body });
    if (pendingOperation.fingerprint !== fingerprint) {
      pendingOperation.fingerprint = fingerprint;
      pendingOperation.key = crypto.randomUUID();
    }
    try {
      const result = await api<{ build: SavedClassBuild }>(
        path,
        target ? "PATCH" : "POST",
        body,
        pendingOperation.key,
      );
      if (editorContext.current === startedContext)
        setSelectedBuild({
          id: result.build.id,
          version: result.build.version,
        });
      pendingOperation.fingerprint = undefined;
      await refreshBuilds();
      feedback(
        editorContext.current === startedContext
          ? "Saved privately to your OMOBA account. This does not publish or equip the build."
          : "The earlier build was saved. Your replacement editor remains a separate draft.",
      );
    } catch (cause) {
      setError(accountError(cause));
    } finally {
      setBusy(false);
    }
  }
  function loadAccount(build: SavedClassBuild) {
    try {
      const valid = parseClassBuild(build.document, catalog);
      editorContext.current++;
      setDocument(valid);
      setSelectedBuild({ id: build.id, version: build.version });
      feedback(
        "Loaded account build version " +
          build.version +
          ". Your browser recovery draft will follow this editor.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Saved build is incompatible.",
      );
    }
  }
  async function deleteAccount(build: SavedClassBuild) {
    setBusy(true);
    try {
      await api(
        "me/class-builds/" +
          build.id +
          "?version=" +
          encodeURIComponent(build.version),
        "DELETE",
      );
      if (selectedBuild?.id === build.id) setSelectedBuild(null);
      await refreshBuilds();
      feedback(
        "Deleted the account copy. The current editor and browser draft were kept.",
      );
    } catch (cause) {
      setError(accountError(cause));
    } finally {
      setBusy(false);
    }
  }
  async function libraryAction(action: "connect" | "poll" | "disconnect") {
    setLibraryBusy(true);
    try {
      const result = await api<EkzaLibraryState>(
        action === "disconnect"
          ? "me/ekza-library"
          : "me/ekza-library/" + action,
        action === "disconnect" ? "DELETE" : "POST",
        action === "disconnect" ? undefined : {},
      );
      setLibrary(result);
    } catch (cause) {
      setError(accountError(cause));
      setLibrary((current) => ({ ...current, state: "unavailable" }));
    } finally {
      setLibraryBusy(false);
    }
  }
  const verificationUrl = library?.verificationUrl
    ? safeLibraryVerificationUrl(library.verificationUrl, {
        prototype: library.prototype === true,
        loopback:
          hydrated &&
          ["127.0.0.1", "localhost", "[::1]"].includes(
            window.location.hostname,
          ),
      })
    : null;
  return (
    <div className="creator-page workshop-page" lang="en">
      <a className="creator-skip" href="#workshop-content">
        Skip to class editor
      </a>
      <header className="creator-header">
        <Link href="/creators" className="creator-brand">
          <span aria-hidden="true">O</span> OMOBA <small>WORKSHOP</small>
        </Link>
        <nav aria-label="Workshop navigation">
          <Link href="/creators">Asset library</Link>
          <Link href="/" prefetch={false}>
            Player portal
          </Link>
          <a href="#workshop-account">
            {account ? "My account" : "Browser draft"}
          </a>
        </nav>
      </header>
      <main id="workshop-content">
        <section className="workshop-heading">
          <div>
            <span className="creator-overline">
              CLASS WORKSHOP / LOCAL COMBAT TEST
            </span>
            <h1>
              Your next class
              <br />
              starts with a combination<span>.</span>
            </h1>
            <p>
              Choose a core and arrange four skills from the game’s own rules.
              Keep a browser draft, save it privately to your account, and test
              the build in the native game.
            </p>
          </div>
          <div className="workshop-version">
            <span className="creator-overline">GAME COMPATIBILITY</span>
            <strong>
              {catalog.cores.length} cores / {catalog.skills.length} skills
            </strong>
            <span>
              Recipe v{catalog.recipeSchemaVersion} · {catalog.gameplayRevision}
            </span>
            <span>Protocol {catalog.protocolVersion}</span>
            <small>
              The asset library covers {assets.classes.length} classes and{" "}
              {assets.skills.length} skills. This editor exposes the composable
              set.
            </small>
          </div>
        </section>
        <div className="workshop-notice">
          Private drafts and local Combat Test only. Public matchmaking and
          ranked play do not accept custom workshop builds. Avatar appearance
          and cosmetic equipment remain separate.
        </div>
        {notice ? (
          <p className="workshop-feedback" role="status">
            {notice}
          </p>
        ) : null}
        {error ? (
          <p className="workshop-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="workshop-layout">
          <section className="workshop-editor" aria-label="Class editor">
            <div className="workshop-section-title">
              <span className="creator-overline">01 / COMPOSE</span>
              <span>
                {selectedBuild
                  ? "Account v" + selectedBuild.version
                  : "Browser editor"}
              </span>
            </div>
            <div className="workshop-form">
              <label>
                Build name
                <input
                  value={document.name}
                  maxLength={160}
                  onChange={(e) =>
                    setDocument({ ...document, name: e.target.value })
                  }
                />
              </label>
              <label>
                Core
                <select
                  value={document.recipe.core}
                  onChange={(e) => chooseCore(e.target.value)}
                >
                  {catalog.cores.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="workshop-description">
                Design notes
                <textarea
                  rows={2}
                  value={document.description}
                  maxLength={2000}
                  placeholder="What makes this combination interesting?"
                  onChange={(e) =>
                    setDocument({ ...document, description: e.target.value })
                  }
                />
              </label>
            </div>
            <div className="workshop-core">
              <strong>{core.name}</strong>
              <p>{core.description}</p>
              <div>
                <span>{core.baseHp} base HP</span>
                <span>{core.attackProfile.replaceAll("_", " ")} attacks</span>
                <span>
                  Passive:{" "}
                  {
                    catalog.passives.find(
                      (p) => p.id === document.recipe.passive,
                    )?.name
                  }
                </span>
              </div>
              <small>
                Changing core loads its full preset.{" "}
                {document.recipe.passive === core.defaultPassive
                  ? "The passive uses the core default."
                  : "The imported passive is preserved; changing core restores its default."}
              </small>
            </div>
            <div
              className="workshop-slot-grid"
              role="group"
              aria-label="Assigned QWER skills"
            >
              {document.recipe.skills.map((id, index) => {
                const s = catalog.skills.find((s) => s.id === id)!;
                return (
                  <button
                    key={index}
                    className={activeSlot === index ? "is-active" : ""}
                    onClick={() => setActiveSlot(index)}
                    aria-pressed={activeSlot === index}
                    aria-label={`Edit ${slots[index]}: ${s.name}`}
                  >
                    <span className="workshop-slot-key">{slots[index]}</span>
                    <SkillIcon
                      icon={assets.skills.find((a) => a.id === id)?.icon}
                    />
                    <strong>{s.name}</strong>
                    <small>Unlock level {s.unlockLevel}</small>
                  </button>
                );
              })}
            </div>
            <div className="workshop-skill-detail">
              <div>
                <span className="creator-overline">
                  ASSIGNED TO {slots[activeSlot]}
                </span>
                <h2>{selectedSkill.name}</h2>
                <p>{selectedSkill.description}</p>
              </div>
              <dl>
                <div>
                  <dt>Mana</dt>
                  <dd>
                    {selectedSkill.manaCost}
                    {selectedSkill.recastManaCost
                      ? ` / ${selectedSkill.recastManaCost} recast`
                      : ""}
                  </dd>
                </div>
                <div>
                  <dt>Cooldown</dt>
                  <dd>{selectedSkill.cooldownSecs}s</dd>
                </div>
                <div>
                  <dt>Range</dt>
                  <dd>{selectedSkill.castRange}</dd>
                </div>
                <div>
                  <dt>Unlock</dt>
                  <dd>Level {selectedSkill.unlockLevel}</dd>
                </div>
              </dl>
              <p className="workshop-small">
                {selectedSkill.targeting.replaceAll("_", " ")} · rank cap{" "}
                {selectedSkill.maxRank}. Unlock follows the original skill, even
                in a different QWER position.
              </p>
            </div>
            {issues.length ? (
              <div className="workshop-validation" role="alert">
                <strong>Resolve before saving or exporting</strong>
                <ul>
                  {issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="workshop-valid" role="status">
                ✓ Compatible with this game’s recipe rules. Balance is yours to
                explore.
              </p>
            )}
            <div className="workshop-picker">
              <div className="workshop-section-title">
                <h2>Choose a skill for {slots[activeSlot]}</h2>
                <span>{matches.length} skills</span>
              </div>
              <label>
                Search composable skills
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, effect or targeting…"
                  maxLength={100}
                />
              </label>
              <div className="workshop-skill-list">
                {matches.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      const next = [
                        ...document.recipe.skills,
                      ] as ClassBuildDocument["recipe"]["skills"];
                      next[activeSlot] = s.id;
                      setDocument({
                        ...document,
                        recipe: { ...document.recipe, skills: next },
                      });
                      setNotice("");
                    }}
                    aria-label={`Assign ${s.name} to ${slots[activeSlot]}`}
                    aria-pressed={document.recipe.skills[activeSlot] === s.id}
                  >
                    <SkillIcon
                      icon={assets.skills.find((a) => a.id === s.id)?.icon}
                    />
                    <span>
                      <strong>{s.name}</strong>
                      <small>
                        {s.manaCost} mana · {s.cooldownSecs}s · level{" "}
                        {s.unlockLevel}
                      </small>
                    </span>
                    {document.recipe.skills.includes(s.id) ? (
                      <em>In kit</em>
                    ) : null}
                  </button>
                ))}
              </div>
              {!matches.length ? (
                <p className="workshop-small" role="status">
                  No matching skills. Try another name or effect.
                </p>
              ) : null}
            </div>
          </section>
          <aside className="workshop-side">
            <section className="workshop-panel">
              <span className="creator-overline">02 / KEEP & TEST</span>
              <h2>Keep your build</h2>
              <p>
                {recoveryWritable
                  ? "Valid edits recover automatically in this browser. Save a separate local copy or download portable JSON."
                  : "Automatic recovery is paused to protect the previous draft. Save a separate browser copy or download your current build."}
              </p>
              <div className="workshop-actions">
                {failedRecovery !== null ? (
                  <button
                    onClick={() =>
                      download(
                        failedRecovery,
                        "omoba-previous-recovery.json",
                        true,
                      )
                    }
                  >
                    Download previous recovery
                  </button>
                ) : null}
                <button onClick={saveLocal} disabled={!!issues.length}>
                  Save browser draft
                </button>
                <button onClick={loadLocal} disabled={!localSaved}>
                  Load browser draft
                </button>
                <button onClick={() => fileInput.current?.click()}>
                  Import build JSON
                </button>
                <button
                  onClick={() =>
                    download(
                      parseClassBuild(document, catalog),
                      "omoba-class-build.json",
                    )
                  }
                  disabled={!!issues.length}
                >
                  Download build JSON ↓
                </button>
                <button
                  className="workshop-primary"
                  onClick={() =>
                    download(
                      combatTestPreset(document, catalog),
                      "omoba-combat-test.json",
                    )
                  }
                  disabled={!!issues.length}
                >
                  Download Combat Test ↓
                </button>
              </div>
              <input
                ref={fileInput}
                className="workshop-file-input"
                type="file"
                accept="application/json,.json"
                aria-label="Import class build file"
                onChange={(e) => void importFile(e.target.files?.[0])}
              />
              <details>
                <summary>Play this build in the game</summary>
                <p>
                  Use a matching game checkout and start the exported safe
                  preset:
                </p>
                <code>
                  python3 scripts/combat_test.py --hero {document.recipe.core}{" "}
                  --preset /path/to/omoba-combat-test.json
                </code>
                <p>
                  The native game validates the full recipe again. The template
                  enables a target dummy and normal resources.
                </p>
              </details>
            </section>
            <section className="workshop-panel" id="workshop-account">
              <span className="creator-overline">03 / OMOBA ACCOUNT</span>
              <h2>
                {account ? account.profile.nickname : "Your private workshop"}
              </h2>
              <p className={"workshop-account-state " + accountState}>
                {accountState === "connected"
                  ? "Connected to your central OMOBA account"
                  : accountState === "unavailable"
                    ? "Account service unavailable"
                    : "Guest · saved only in this browser"}
              </p>
              {!account ? (
                <>
                  <p>
                    Sign in through the game to save and reopen private builds
                    on another browser. The draft here stays intact.
                  </p>
                  <Link
                    className="creator-primary"
                    href="/login?returnTo=/workshop"
                    prefetch={false}
                  >
                    Sign in with game account ↗
                  </Link>
                  <button
                    className="workshop-text-button"
                    onClick={() => void refreshAccount()}
                    disabled={busy}
                  >
                    Refresh account connection
                  </button>
                </>
              ) : (
                <>
                  <div className="workshop-actions">
                    <button
                      className="workshop-primary"
                      disabled={busy || !!issues.length}
                      onClick={() => void saveAccount()}
                    >
                      {selectedBuild
                        ? "Update account build"
                        : "Save to account"}
                    </button>
                    {selectedBuild ? (
                      <button
                        disabled={busy || !!issues.length}
                        onClick={() => void saveAccount(true)}
                      >
                        Save as account copy
                      </button>
                    ) : null}
                    <button
                      disabled={busy}
                      onClick={() => void refreshAccount()}
                    >
                      Refresh saved builds
                    </button>
                  </div>
                  <p className="workshop-small">
                    Private account preferences; saving does not publish or
                    equip a class.
                  </p>
                  <div className="workshop-saved-list">
                    {builds.map((build) => (
                      <article key={build.id}>
                        <strong>{build.document.name}</strong>
                        <small>
                          Version {build.version} · {build.document.recipe.core}
                        </small>
                        <div>
                          <button
                            onClick={() => loadAccount(build)}
                            disabled={busy}
                            aria-label={`Load account build ${build.document.name}`}
                          >
                            Load
                          </button>
                          <button
                            onClick={() => void deleteAccount(build)}
                            disabled={busy}
                            aria-label={`Delete account build ${build.document.name}`}
                          >
                            Delete account copy
                          </button>
                        </div>
                      </article>
                    ))}
                    {!builds.length ? (
                      <p className="workshop-small">
                        No account builds loaded yet.
                      </p>
                    ) : null}
                  </div>
                </>
              )}
            </section>
            {account ? (
              <section
                className="workshop-panel"
                aria-label="Ekza library connection"
              >
                <span className="creator-overline">EKZA LIBRARY</span>
                <h2>
                  {library?.state === "connected"
                    ? "Library connected"
                    : "Connect your creative library"}
                </h2>
                {library?.prototype ? (
                  <p className="workshop-fixture">
                    LOCAL PROTOTYPE · synthetic Registry fixture. This does not
                    connect a hosted Ekza account.
                  </p>
                ) : null}
                <p>
                  OMOBA owns your saved builds. A separate Ekza library
                  connection grants read-only library access; it does not
                  approve game assets or create unified sign-in.
                </p>
                {library?.state === "connected" ? (
                  <>
                    <p className="workshop-valid">
                      Verified library: {library.username}
                    </p>
                    <button
                      disabled={libraryBusy}
                      onClick={() => void libraryAction("disconnect")}
                    >
                      Disconnect Ekza library
                    </button>
                  </>
                ) : library?.state === "pending" ? (
                  <>
                    <p>
                      Enter code{" "}
                      <strong className="workshop-pair-code">
                        {library.userCode}
                      </strong>{" "}
                      on the verification page.
                    </p>
                    {verificationUrl ? (
                      <a
                        className="creator-primary"
                        href={verificationUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {library.prototype
                          ? "Approve synthetic fixture"
                          : "Open Ekza verification"}{" "}
                        ↗
                      </a>
                    ) : (
                      <p className="workshop-error">
                        Verification link is unavailable or not trusted.
                      </p>
                    )}
                    <button
                      disabled={libraryBusy}
                      onClick={() => void libraryAction("poll")}
                    >
                      Check connection
                    </button>
                  </>
                ) : (
                  <>
                    {library?.state === "unavailable" ? (
                      <p className="workshop-error">
                        Library status is unavailable. An existing connection
                        has not been removed.
                      </p>
                    ) : null}
                    <button
                      disabled={libraryBusy}
                      onClick={() => void libraryAction("connect")}
                    >
                      Connect Ekza library
                    </button>
                    <button
                      className="workshop-text-button"
                      disabled={libraryBusy}
                      onClick={() => void refreshLibrary()}
                    >
                      Refresh library status
                    </button>
                  </>
                )}
              </section>
            ) : null}
          </aside>
        </div>
        <section className="workshop-asset-section">
          <div className="workshop-section-title">
            <div>
              <span className="creator-overline">04 / CREATIVE REFERENCES</span>
              <h2>Visual needs for this combination</h2>
            </div>
            <Link href={"/creators?class=" + document.recipe.core}>
              Explore {core.name} defaults ↗
            </Link>
          </div>
          <p className="workshop-small">
            Core basic attack plus your selected skills. Borrowing a skill does
            not equip its home class’s weapon. These references do not grant
            cosmetic approval.
          </p>
          <div className="workshop-asset-list">
            {needs.map((r) => (
              <article key={r.id}>
                {r.baseline.preview ? (
                  <img
                    src={r.baseline.preview.url}
                    alt={r.name + " default model"}
                    width={120}
                    height={90}
                    loading="lazy"
                  />
                ) : (
                  <span
                    className="workshop-reference-symbol"
                    aria-hidden="true"
                  >
                    {r.role === "animation_reference" ? "↝" : "✧"}
                  </span>
                )}
                <div>
                  <strong>{r.name}</strong>
                  <span>
                    {r.role.replaceAll("_", " ")} ·{" "}
                    {r.status === "supported"
                      ? "static handheld"
                      : r.status === "planned"
                        ? "planned"
                        : "engine reference"}
                  </span>
                  <small>
                    {coreAssets?.basicAttack.requirementIds.includes(r.id)
                      ? "Core basic attack"
                      : "Selected skill reference"}
                  </small>
                </div>
              </article>
            ))}
          </div>
        </section>
        <footer className="creator-footer">
          <div>
            <strong>OMOBA / CLASS WORKSHOP</strong>
            <p>Private drafts. Real game rules. Local experiments.</p>
          </div>
          <details>
            <summary>Source & compatibility</summary>
            <p>
              Game rules: {catalog.gameplayRevision} / protocol{" "}
              {catalog.protocolVersion}
            </p>
            <p>
              Workshop source:{" "}
              <code>
                {catalog.source?.commit ||
                  "See the game-owned workshop snapshot"}
              </code>
            </p>
            <p>
              Visual source: <code>{assets.source.commit}</code>
            </p>
            <a href="/workshop/catalog.json" download>
              Download game rules snapshot ↓
            </a>
          </details>
        </footer>
      </main>
    </div>
  );
}
