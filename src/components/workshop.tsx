"use client";
import { DEFAULT_SITE_URL } from "@/lib/navigation.mjs";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api, ApiFailure } from "@/lib/client-api";
import { Brand } from "@/components/brand";
import { LanguageSelector, useLocale } from "@/components/locale-provider";
import { useMarket } from "@/components/market-profile";
import { LegalLinks } from "@/components/legal";
import { creatorText } from "@/lib/creator-translations";
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
  accountDisabled = false,
  siteUrl = DEFAULT_SITE_URL,
  studioUrl,
}: {
  catalog: WorkshopCatalog;
  assets: AssetCatalog;
  initialAccount: Account | null;
  initiallyUnavailable: boolean;
  accountDisabled?: boolean;
  siteUrl?: string;
  /** Studio of the active contour; null hides hosted approval links. */
  studioUrl: string | null;
}) {
  const { locale, t } = useLocale();
  // Without the Ekza feature (ru, cn): no Ekza library panel, no asset library, market or Studio links.
  const { ekza, vkSignIn } = useMarket().features;
  const ct = (source: string | undefined, values: Record<string, string | number> = {}) => creatorText(locale, source, values);
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
  const coreWeapon = assets.requirements.find(
    (r) =>
      coreAssets?.basicAttack.requirementIds.includes(r.id) &&
      r.baseline.preview,
  );
  const selectedSkill = catalog.skills.find(
    (s) => s.id === document.recipe.skills[activeSlot],
  )!;
  const matches = catalog.skills.filter(
    (s) =>
      !search.trim() ||
      [s.name, s.description, s.id, s.targeting, ct(s.name), ct(s.description), ct(s.targeting.replaceAll("_", " "))].some((v) =>
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
    if (ekza) void refreshLibrary();
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
        studio: studioUrl,
        prototype: library.prototype === true,
        loopback:
          hydrated &&
          ["127.0.0.1", "localhost", "[::1]"].includes(
            window.location.hostname,
          ),
      })
    : null;
  return (
    <div className="creator-page workshop-page" lang={locale === "zh" ? "zh-CN" : locale}>
      <a className="creator-skip" href="#workshop-content">{t("Skip to class editor")}</a>
      <header className="creator-header">
        <Link href={ekza ? "/creators" : "/workshop"} className="creator-brand">
          <Brand section={t("Class workshop")} />
        </Link>
        <nav aria-label={t("Workshop navigation")}>
          <a href={siteUrl}>{t("OMOBA website ↗")}</a>
          {ekza ? <Link href="/creators">{t("Asset library")}</Link> : null}
          {ekza ? <Link href="/market">{t("Market")}</Link> : null}
          <Link href="/me" prefetch={false}>{t("Player portal")}</Link>
          <a href="#workshop-account">
            {account ? t("My account") : t("Browser draft")}
          </a>
        </nav>
        <LanguageSelector />
      </header>
      <main id="workshop-content">
        <section className="workshop-heading">
          <div>
            <span className="creator-overline">{t("OMOBA / CLASS WORKSHOP")}</span>
            <h1>{t("Build your next class")}<span>.</span>
            </h1>
            <p>{t("Choose a core and arrange four skills from the game’s own rules.")}{" "}
              {accountDisabled
                ? t("Keep a browser draft, download the build, and test it in the native game.")
                : t("Keep a browser draft, save it privately to your account, and test the build in the native game.")}
            </p>
          </div>
          <div className="workshop-version">
            <span className="creator-overline">{t("YOUR NEXT COMBINATION")}</span>
            <strong>
              {catalog.cores.length}{" "}{t("cores /")}{" "}{catalog.skills.length}{" "}{t("skills")}</strong>
            <small>{t("Game-owned rules. Your choice of Q, W, E and R.")}</small>
          </div>
        </section>
        <nav className="workshop-steps" aria-label={t("Workshop sections")}>
          <a href="#workshop-core">
            <span>01</span>{" "}{t("Choose a core")}</a>
          <a href="#workshop-kit">
            <span>02</span>{" "}{t("Arrange QWER")}</a>
          <a href="#workshop-assets">
            <span>03</span>{" "}{t("Explore visuals")}</a>
          <a href="#workshop-save">
            <span>04</span>{" "}{t("Save & test")}</a>
        </nav>
        <div className="workshop-notice">{t("Private drafts and local Combat Test only. Public matchmaking and ranked play do not accept custom workshop builds. Avatar appearance and cosmetic equipment remain separate.")}</div>
        {notice ? (
          <p className="workshop-feedback" role="status">
            {ct(notice)}
          </p>
        ) : null}
        {error ? (
          <p className="workshop-error" role="alert">
            {ct(error)}
          </p>
        ) : null}
        <div className="workshop-layout">
          <aside className="workshop-core-rail" aria-label={t("Class presets")}>
            <span className="creator-overline">{t("CHOOSE YOUR CORE")}</span>
            <p>{t("Start with a playstyle.")}</p>
            {catalog.cores.map((c) => (
              <button
                key={c.id}
                onClick={() => chooseCore(c.id)}
                aria-pressed={document.recipe.core === c.id}
              >
                <SkillIcon
                  icon={
                    assets.skills.find((s) => s.id === c.preset.skills[0])?.icon
                  }
                />
                <span>
                  <strong>{ct(c.name)}</strong>
                  <small>{ct(c.attackProfile.replaceAll("_", " "))}</small>
                </span>
              </button>
            ))}
            <small>{t("Choosing a core loads its full preset.")}</small>
          </aside>
          <section
            className="workshop-editor"
            id="workshop-core"
            aria-label={t("Class editor")}
          >
            <div className="workshop-section-title">
              <span className="creator-overline">{t("01 / COMPOSE")}</span>
              <span>
                {selectedBuild
                  ? t("Account v") + selectedBuild.version
                  : t("Browser editor")}
              </span>
            </div>
            <div className="workshop-form">
              <label>{t("Build name")}<input
                  value={document.name}
                  maxLength={160}
                  onChange={(e) =>
                    setDocument({ ...document, name: e.target.value })
                  }
                />
              </label>
              <label>{t("Core")}<select
                  value={document.recipe.core}
                  onChange={(e) => chooseCore(e.target.value)}
                >
                  {catalog.cores.map((c) => (
                    <option key={c.id} value={c.id}>
                      {ct(c.name)}
                    </option>
                  ))}
                </select>
              </label>
              <details className="workshop-design-notes">
                <summary>{t("Design notes (optional)")}</summary>
                <label className="workshop-description">{t("Design notes")}<textarea
                    rows={2}
                    value={document.description}
                    maxLength={2000}
                    placeholder={t("What makes this combination interesting?")}
                    onChange={(e) =>
                      setDocument({ ...document, description: e.target.value })
                    }
                  />
                </label>
              </details>
            </div>
            <div className="workshop-core-stage">
              <div className="workshop-core">
                <strong>{ct(core.name)}</strong>
                <p>{ct(core.description)}</p>
                <div>
                  <span>{core.baseHp}{" "}{t("base HP")}</span>
                  <span>{ct(core.attackProfile.replaceAll("_", " "))}{" "}{t("attacks")}</span>
                  <span>{t("Passive:")}{" "}
                    {
                      ct(catalog.passives.find(
                        (p) => p.id === document.recipe.passive,
                      )?.name)
                    }
                  </span>
                </div>
                <small>{t("Changing core loads its full preset.")}{" "}
                  {document.recipe.passive === core.defaultPassive
                    ? t("The passive uses the core default.")
                    : t("The imported passive is preserved; changing core restores its default.")}
                </small>
              </div>
              {coreWeapon?.baseline.preview ? (
                <figure className="workshop-core-preview">
                  <img
                    src={coreWeapon.baseline.preview.url}
                    alt={ct("{name} default model reference", {name: ct(coreWeapon.name)})}
                    width={240}
                    height={180}
                  />
                  <figcaption>{ct(coreWeapon.name)}{" "}{t("· default model")}</figcaption>
                </figure>
              ) : null}
            </div>
            <div
              className="workshop-slot-grid"
              id="workshop-kit"
              role="group"
              aria-label={t("Assigned QWER skills")}
            >
              {document.recipe.skills.map((id, index) => {
                const s = catalog.skills.find((s) => s.id === id)!;
                return (
                  <button
                    key={index}
                    className={activeSlot === index ? "is-active" : ""}
                    onClick={() => setActiveSlot(index)}
                    aria-pressed={activeSlot === index}
                    aria-label={ct("Edit {slot}: {name}", {slot: slots[index], name: ct(s.name)})}
                  >
                    <span className="workshop-slot-key">{slots[index]}</span>
                    <SkillIcon
                      icon={assets.skills.find((a) => a.id === id)?.icon}
                    />
                    <strong>{ct(s.name)}</strong>
                    <small>{t("Unlock level")}{" "}{s.unlockLevel}</small>
                  </button>
                );
              })}
            </div>
            <div className="workshop-skill-detail">
              <div>
                <span className="creator-overline">{t("ASSIGNED TO")}{" "}{slots[activeSlot]}
                </span>
                <h2>{ct(selectedSkill.name)}</h2>
                <p>{ct(selectedSkill.description)}</p>
              </div>
              <dl>
                <div>
                  <dt>{t("Mana")}</dt>
                  <dd>
                    {selectedSkill.manaCost}
                    {selectedSkill.recastManaCost
                      ? ` / ${selectedSkill.recastManaCost} ${t("recast")}`
                      : ""}
                  </dd>
                </div>
                <div>
                  <dt>{t("Cooldown")}</dt>
                  <dd>{selectedSkill.cooldownSecs}{t("s")}</dd>
                </div>
                <div>
                  <dt>{t("Range")}</dt>
                  <dd>{selectedSkill.castRange}</dd>
                </div>
                <div>
                  <dt>{t("Unlock")}</dt>
                  <dd>{t("Level")}{" "}{selectedSkill.unlockLevel}</dd>
                </div>
              </dl>
              <p className="workshop-small">
                {ct(selectedSkill.targeting.replaceAll("_", " "))}{" "}{t("· rank cap")}{" "}
                {selectedSkill.maxRank}{t(". Unlock follows the original skill, even in a different QWER position.")}</p>
            </div>
            {issues.length ? (
              <div className="workshop-validation" role="alert">
                <strong>{t("Resolve before saving or exporting")}</strong>
                <ul>
                  {issues.map((issue) => (
                    <li key={ct(issue)}>{ct(issue)}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="workshop-valid" role="status">{t("✓ Compatible with this game’s recipe rules. Balance is yours to explore.")}</p>
            )}
            <div className="workshop-picker">
              <div className="workshop-section-title">
                <h2>{t("Choose a skill for")}{" "}{slots[activeSlot]}</h2>
                <span>{matches.length}{" "}{t("skills")}</span>
              </div>
              <label>{t("Search composable skills")}<input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("Search name, effect or targeting…")}
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
                    aria-label={ct("Assign {name} to {slot}", {name: ct(s.name), slot: slots[activeSlot]})}
                    aria-pressed={document.recipe.skills[activeSlot] === s.id}
                  >
                    <SkillIcon
                      icon={assets.skills.find((a) => a.id === s.id)?.icon}
                    />
                    <span>
                      <strong>{ct(s.name)}</strong>
                      <small>
                        {s.manaCost}{" "}{t("mana ·")}{" "}{s.cooldownSecs}{t("s · level")}{" "}
                        {s.unlockLevel}
                      </small>
                    </span>
                    {document.recipe.skills.includes(s.id) ? (
                      <em>{t("In kit")}</em>
                    ) : null}
                  </button>
                ))}
              </div>
              {!matches.length ? (
                <p className="workshop-small" role="status">{t("No matching skills. Try another name or effect.")}</p>
              ) : null}
            </div>
          </section>
          <aside className="workshop-side">
            <section className="workshop-panel" id="workshop-save">
              <span className="creator-overline">{t("02 / KEEP & TEST")}</span>
              <h2>{t("Keep your build")}</h2>
              <div
                className="workshop-build-summary"
                aria-label={t("Current build summary")}
              >
                <strong>{document.name || t("Untitled build")}</strong>
                <span>
                  {ct(core.name)} ·{" "}
                  {issues.length
                    ? t("Needs attention")
                    : t("Ready for local testing")}
                </span>
                <div>
                  {document.recipe.skills.map((id, i) => (
                    <span
                      key={i}
                      title={ct(catalog.skills.find((s) => s.id === id)?.name)}
                    >
                      <SkillIcon
                        icon={assets.skills.find((s) => s.id === id)?.icon}
                      />
                      <b>{slots[i]}</b>
                    </span>
                  ))}
                </div>
              </div>
              <p>
                {recoveryWritable
                  ? t("Valid edits recover automatically in this browser. Save a separate local copy or download portable JSON.")
                  : t("Automatic recovery is paused to protect the previous draft. Save a separate browser copy or download your current build.")}
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
                  >{t("Download previous recovery")}</button>
                ) : null}
                <button onClick={saveLocal} disabled={!!issues.length}>{t("Save browser draft")}</button>
                <button onClick={loadLocal} disabled={!localSaved}>{t("Load browser draft")}</button>
                <button onClick={() => fileInput.current?.click()}>{t("Import build JSON")}</button>
                <button
                  onClick={() =>
                    download(
                      parseClassBuild(document, catalog),
                      "omoba-class-build.json",
                    )
                  }
                  disabled={!!issues.length}
                >{t("Download build JSON ↓")}</button>
                <button
                  className="workshop-primary"
                  onClick={() =>
                    download(
                      combatTestPreset(document, catalog),
                      "omoba-combat-test.json",
                    )
                  }
                  disabled={!!issues.length}
                >{t("Download Combat Test ↓")}</button>
              </div>
              <input
                ref={fileInput}
                className="workshop-file-input"
                type="file"
                accept="application/json,.json"
                aria-label={t("Import class build file")}
                onChange={(e) => void importFile(e.target.files?.[0])}
              />
              <details>
                <summary>{t("Play this build in the game")}</summary>
                <p>{t("Use a matching game checkout and start the exported safe preset:")}</p>
                <code>
                  python3 scripts/combat_test.py --hero {document.recipe.core}{" "}
                  --preset /path/to/omoba-combat-test.json
                </code>
                <p>{t("The native game validates the full recipe again. The template enables a target dummy and normal resources.")}</p>
              </details>
            </section>
            <section className="workshop-panel" id="workshop-account">
              <span className="creator-overline">{t("03 / OMOBA ACCOUNT")}</span>
              <h2>
                {account ? account.profile.nickname : t("Your private workshop")}
              </h2>
              <p className={"workshop-account-state " + accountState}>
                {accountDisabled
                  ? t("Guest prototype · account service is not connected")
                  : accountState === "connected"
                    ? t("Connected to your central OMOBA account")
                    : accountState === "unavailable"
                      ? t("Account service unavailable")
                      : t("Guest · saved only in this browser")}
              </p>
              {accountDisabled ? (
                <p>{ekza
                  ? t("Browser drafts and JSON downloads work here. Sign-in, account saves and Ekza library connection are unavailable in this public prototype.")
                  : t("Browser drafts and JSON downloads work here. Sign-in and account saves are unavailable in this public prototype.")}</p>
              ) : !account ? (
                <>
                  <p>{vkSignIn
                    ? t("Sign in to save and reopen private builds on another browser. The draft here stays intact.")
                    : t("Sign in through the game to save and reopen private builds on another browser. The draft here stays intact.")}</p>
                  <Link
                    className="creator-primary"
                    href="/login?returnTo=/workshop"
                    prefetch={false}
                  >{vkSignIn ? t("Sign in ↗") : t("Sign in with game account ↗")}</Link>
                  <button
                    className="workshop-text-button"
                    onClick={() => void refreshAccount()}
                    disabled={busy}
                  >{t("Refresh account connection")}</button>
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
                        ? t("Update account build")
                        : t("Save to account")}
                    </button>
                    {selectedBuild ? (
                      <button
                        disabled={busy || !!issues.length}
                        onClick={() => void saveAccount(true)}
                      >{t("Save as account copy")}</button>
                    ) : null}
                    <button
                      disabled={busy}
                      onClick={() => void refreshAccount()}
                    >{t("Refresh saved builds")}</button>
                  </div>
                  <p className="workshop-small">{t("Private account preferences; saving does not publish or equip a class.")}</p>
                  <div className="workshop-saved-list">
                    {builds.map((build) => (
                      <article key={build.id}>
                        <strong>{build.document.name}</strong>
                        <small>{t("Version")}{" "}{build.version} · {build.document.recipe.core}
                        </small>
                        <div>
                          <button
                            onClick={() => loadAccount(build)}
                            disabled={busy}
                            aria-label={ct("Load account build {name}", {name: build.document.name})}
                          >{t("Load")}</button>
                          <button
                            onClick={() => void deleteAccount(build)}
                            disabled={busy}
                            aria-label={ct("Delete account build {name}", {name: build.document.name})}
                          >{t("Delete account copy")}</button>
                        </div>
                      </article>
                    ))}
                    {!builds.length ? (
                      <p className="workshop-small">{t("No account builds loaded yet.")}</p>
                    ) : null}
                  </div>
                </>
              )}
            </section>
            {account && ekza ? (
              <section
                className="workshop-panel"
                aria-label={t("Ekza library connection")}
              >
                <span className="creator-overline">{t("EKZA LIBRARY")}</span>
                <h2>
                  {library?.state === "connected"
                    ? t("Library connected")
                    : t("Connect your creative library")}
                </h2>
                {library?.prototype ? (
                  <p className="workshop-fixture">{t("LOCAL PROTOTYPE · synthetic Registry fixture. This does not connect a hosted Ekza account.")}</p>
                ) : null}
                <p>{t("OMOBA owns your saved builds. A separate Ekza library connection grants read-only library access; it does not approve game assets or create unified sign-in.")}</p>
                {library?.state === "connected" ? (
                  <>
                    <p className="workshop-valid">{t("Verified library:")}{" "}{library.username}
                    </p>
                    <button
                      disabled={libraryBusy}
                      onClick={() => void libraryAction("disconnect")}
                    >{t("Disconnect Ekza library")}</button>
                  </>
                ) : library?.state === "pending" ? (
                  <>
                    <p>{t("Enter code")}{" "}
                      <strong className="workshop-pair-code">
                        {library.userCode}
                      </strong>{" "}{t("on the verification page.")}</p>
                    {verificationUrl ? (
                      <a
                        className="creator-primary"
                        href={verificationUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {library.prototype
                          ? t("Approve synthetic fixture")
                          : t("Open Ekza verification")}{" "}
                        ↗
                      </a>
                    ) : (
                      <p className="workshop-error">{t("Verification link is unavailable or not trusted.")}</p>
                    )}
                    <button
                      disabled={libraryBusy}
                      onClick={() => void libraryAction("poll")}
                    >{t("Check connection")}</button>
                  </>
                ) : (
                  <>
                    {library?.state === "unavailable" ? (
                      <p className="workshop-error">{t("Library status is unavailable. An existing connection has not been removed.")}</p>
                    ) : null}
                    <button
                      disabled={libraryBusy}
                      onClick={() => void libraryAction("connect")}
                    >{t("Connect Ekza library")}</button>
                    <button
                      className="workshop-text-button"
                      disabled={libraryBusy}
                      onClick={() => void refreshLibrary()}
                    >{t("Refresh library status")}</button>
                  </>
                )}
              </section>
            ) : null}
          </aside>
        </div>
        <section className="workshop-asset-section" id="workshop-assets">
          <div className="workshop-section-title">
            <div>
              <span className="creator-overline">{t("04 / CREATIVE REFERENCES")}</span>
              <h2>{t("Visual needs for this combination")}</h2>
            </div>
            {ekza ? <Link href={"/creators?class=" + document.recipe.core}>{t("Explore")}{" "}{ct(core.name)}{" "}{t("defaults ↗")}</Link> : null}
          </div>
          <p className="workshop-small">{t("Core basic attack plus your selected skills. Borrowing a skill does not equip its home class’s weapon. These references do not grant cosmetic approval.")}</p>
          <div className="workshop-asset-list">
            {needs.map((r) => (
              <article key={r.id}>
                {r.baseline.preview ? (
                  <img
                    src={r.baseline.preview.url}
                    alt={ct("{name} default model", {name: ct(r.name)})}
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
                  <strong>{ct(r.name)}</strong>
                  <span>
                    {ct(r.role.replaceAll("_", " "))} ·{" "}
                    {r.status === "supported"
                      ? t("static handheld")
                      : r.status === "planned"
                        ? t("planned")
                        : t("engine reference")}
                  </span>
                  <small>
                    {coreAssets?.basicAttack.requirementIds.includes(r.id)
                      ? t("Core basic attack")
                      : t("Selected skill reference")}
                  </small>
                </div>
              </article>
            ))}
          </div>
        </section>
        <footer className="creator-footer">
          <div>
            <strong>{t("OMOBA / CLASS WORKSHOP")}</strong>
            <p>{t("Private drafts. Real game rules. Local experiments.")}</p>
            <LegalLinks />
          </div>
          <details>
            <summary>{t("Source & compatibility")}</summary>
            <p>{t("Game rules:")}{" "}{catalog.gameplayRevision}{" "}{t("/ protocol")}{" "}
              {catalog.protocolVersion}
            </p>
            <p>{t("Workshop source:")}{" "}
              <code>
                {catalog.source?.commit ||
                  t("See the game-owned workshop snapshot")}
              </code>
            </p>
            <p>{t("Visual source:")}{" "}<code>{assets.source.commit}</code>
            </p>
            <a href="/workshop/catalog.json" download>{t("Download game rules snapshot ↓")}</a>
          </details>
        </footer>
      </main>
    </div>
  );
}
