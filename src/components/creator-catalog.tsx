"use client";
import { DEFAULT_SITE_URL } from "@/lib/navigation.mjs";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type {
  AssetCatalog,
  AssetRequirement,
  CatalogIcon,
} from "@/lib/asset-catalog-types";
import { contributionBrief } from "@/lib/asset-catalog.mjs";
import { DEFAULT_STUDIO_URL, isWildsparkHandheld, studioDraftUrl } from "@/lib/market.mjs";
import { Brand } from "@/components/brand";
import { LanguageSelector, useLocale } from "@/components/locale-provider";
import { creatorText } from "@/lib/creator-translations";

const statusLabel = {
  supported: "Static handheld",
  planned: "Planned slot",
  engine_owned: "Engine reference",
};
const roleLabel = {
  held_weapon: "Held weapon",
  projectile: "Projectile",
  world_prop: "World prop",
  engine_effect: "Visual effect",
  animation_reference: "Motion reference",
};
function href(classId: string, skillId?: string, requirementId?: string) {
  const params = new URLSearchParams({ class: classId });
  if (skillId) params.set("skill", skillId);
  if (requirementId) params.set("requirement", requirementId);
  return "/creators?" + params;
}
function SkillIcon({ icon }: { icon?: CatalogIcon }) {
  return icon ? (
    <span
      className="creator-skill-icon"
      aria-hidden="true"
      style={{
        backgroundImage: `url("${icon.url}")`,
        backgroundSize: `${(icon.atlasWidth / icon.width) * 100}% ${(icon.atlasHeight / icon.height) * 100}%`,
        backgroundPosition: `${icon.atlasWidth === icon.width ? 0 : (icon.x / (icon.atlasWidth - icon.width)) * 100}% ${icon.atlasHeight === icon.height ? 0 : (icon.y / (icon.atlasHeight - icon.height)) * 100}%`,
      }}
    />
  ) : (
    <span className="creator-skill-icon creator-icon-empty" aria-hidden="true">
      ✦
    </span>
  );
}
function RequirementCard({
  requirement: r,
  catalog,
  classId,
  skillId,
  selected,
  studioUrl,
}: {
  requirement: AssetRequirement;
  catalog: AssetCatalog;
  classId: string;
  skillId?: string;
  selected: boolean;
  studioUrl: string;
}) {
  const { locale, t } = useLocale();
  const ct = (source: string | undefined, values: Record<string, string | number> = {}) => creatorText(locale, source, values);
  const [downloadError, setDownloadError] = useState(false);
  function downloadBrief() {
    try {
      const blob = new Blob(
        [
          JSON.stringify(contributionBrief(catalog, r.id, classId), null, 2) +
            "\n",
        ],
        { type: "application/json" },
      );
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = `omoba-${r.id}-${catalog.revision.slice(7, 19)}.brief.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDownloadError(false);
    } catch {
      setDownloadError(true);
    }
  }
  return (
    <article
      id={r.id}
      className={
        "creator-asset " +
        (!r.baseline.preview ? "creator-asset-reference " : "") +
        (selected ? "creator-asset-selected" : "")
      }
      aria-label={ct(r.name)}
    >
      <div className="creator-preview">
        {r.baseline.preview ? (
          <img
            src={r.baseline.preview.url}
            alt={ct("Default {name} model reference", {name: ct(r.name)})}
            loading="lazy"
            width={640}
            height={480}
          />
        ) : (
          <div className="creator-no-preview">
            <span aria-hidden="true">
              {r.role === "animation_reference"
                ? "↝"
                : r.baseline.kind === "procedural"
                  ? "✧"
                  : "◇"}
            </span>
            <strong>
              {r.baseline.kind === "procedural"
                ? t("Rendered by the game")
                : t("Reference only")}
            </strong>
            <span>{t("No static preview available")}</span>
          </div>
        )}
        <span className={"creator-status " + r.status}>
          {t(statusLabel[r.status])}
        </span>
        {r.baseline.preview ? (
          <span className="creator-preview-label">{t("DEFAULT · MODEL REFERENCE")}</span>
        ) : null}
      </div>
      <div className="creator-asset-body">
        <div className="creator-asset-title">
          <span className="creator-overline">{t(roleLabel[r.role])}</span>
          <a
            href={href(classId, skillId, r.id)}
            aria-label={ct("Link to {name}", {name: ct(r.name)})}
          >
            ↗
          </a>
        </div>
        <h3>{ct(r.name)}</h3>
        <p className="creator-brief">{ct(r.brief)}</p>
        <p className="creator-uses">
          <strong>{t("Used by")}</strong>{" "}
          {r.uses
            .map((u) =>
              u.skillId
                ? catalog.skills.find((s) => s.id === u.skillId)?.name
                : u.basicAttackId
                  ? catalog.classes.find(
                      (c) => c.basicAttack.id === u.basicAttackId,
                    )?.basicAttack.name
                  : u.state?.replaceAll("_", " "),
            )
            .filter(Boolean)
            .map((value) => ct(value))
            .join(" · ")}
          <span>
            {r.classIds
              .map((id) => ct(catalog.classes.find((c) => c.id === id)?.name))
              .join(" / ")}
          </span>
        </p>
        <div className="creator-asset-actions">
          <button onClick={downloadBrief}>{t("Download brief")}{" "}<span aria-hidden="true">↓</span>
          </button>
          {r.status === "supported" ? (
            <a
              className="creator-studio-link"
              href={studioDraftUrl(studioUrl, r.id)}
              target="_blank"
              rel="noreferrer"
            >{t("Start a Studio draft ↗")}</a>
          ) : null}
          {isWildsparkHandheld(r.id) ? (
            <Link className="creator-studio-link" href="/market#wildspark">{t("Community sets in the market ↗")}</Link>
          ) : null}
        </div>
        {downloadError ? (
          <p role="alert">{t("The brief could not be prepared. Please try again.")}</p>
        ) : null}
        <details className="creator-provenance">
          <summary>{t("Default & technical reference")}</summary>
          <dl>
            <dt>{t("Requirement")}</dt>
            <dd>
              <code>{r.id}</code>
            </dd>
            <dt>{t("Baseline")}</dt>
            <dd>{t(r.baseline.kind)}</dd>
            <dt>{t("Source")}</dt>
            <dd>
              <code>{r.baseline.sourcePath}</code>
            </dd>
            <dt>SHA-256</dt>
            <dd>
              <code>{r.baseline.sha256}</code>
            </dd>
            <dt>{t("Profile")}</dt>
            <dd>
              {r.profile
                ? `${r.profile.id} · v${r.profile.version}`
                : t("No submission profile yet")}
            </dd>
            {r.baseline.license ? (
              <>
                <dt>{t("License")}</dt>
                <dd>
                  {r.baseline.license} · {r.baseline.attribution}
                </dd>
              </>
            ) : null}
          </dl>
          {r.baseline.url && r.baseline.license ? (
            <a className="creator-file-link" href={r.baseline.url} download>{t("Download baseline GLB ·")}{" "}{(r.baseline.bytes / 1024).toFixed(0)} KB
              ↓
            </a>
          ) : null}
          {r.profile ? (
            <p>
              <a
                href={`https://github.com/o-moba/omoba-bevy/blob/${catalog.source.commit}/docs/profiles/handheld-glb-v1.json`}
                target="_blank"
                rel="noreferrer"
              >{t("Read the versioned authoring rules ↗")}</a>
            </p>
          ) : null}
          <p>{t("Model references do not reproduce combat rendering, attachment transforms or animation.")}</p>
        </details>
      </div>
    </article>
  );
}
export default function CreatorCatalog({ catalog, siteUrl=DEFAULT_SITE_URL, studioUrl=DEFAULT_STUDIO_URL }: { catalog: AssetCatalog; siteUrl?:string; studioUrl?:string }) {
  const { locale, t } = useLocale();
  const ct = (source: string | undefined, values: Record<string, string | number> = {}) => creatorText(locale, source, values);
  const params = useSearchParams();
  const [search, setSearch] = useState("");
  const classId = params.get("class"),
    skillId = params.get("skill"),
    requirementId = params.get("requirement");
  const selectedClass =
    catalog.classes.find((c) => c.id === classId) ||
    (!classId ? catalog.classes[0] : undefined);
  const selectedSkill = skillId
    ? catalog.skills.find(
        (s) =>
          s.id === skillId &&
          selectedClass?.skills.some((slot) => slot.id === s.id),
      )
    : undefined;
  const selectedRequirement = requirementId
    ? catalog.requirements.find(
        (r) =>
          r.id === requirementId &&
          selectedClass?.requirementIds.includes(r.id) &&
          (!skillId || selectedSkill?.requirementIds.includes(r.id)),
      )
    : undefined;
  const invalid =
    !selectedClass ||
    Boolean(skillId && !selectedSkill) ||
    Boolean(requirementId && !selectedRequirement);
  const needle = search.toLocaleLowerCase().trim();
  const matches = (parts: (string | undefined)[]) =>
    !needle || parts.some((p) => [p, ct(p)].some((value) => value?.toLocaleLowerCase().includes(needle)));
  const classes = catalog.classes.filter((c) =>
    matches([
      c.name,
      c.role,
      c.description,
      ...c.skills.flatMap((slot) => {
        const s = catalog.skills.find((s) => s.id === slot.id);
        return [s?.name, s?.description];
      }),
      ...c.requirementIds.flatMap((id) => {
        const r = catalog.requirements.find((r) => r.id === id);
        return [r?.name, r?.id, r?.brief];
      }),
    ]),
  );
  const requirements =
    selectedClass && !invalid
      ? catalog.requirements
          .filter(
            (r) =>
              (selectedSkill
                ? selectedSkill.requirementIds
                : selectedClass.requirementIds
              ).includes(r.id) &&
              (!requirementId || r.id === requirementId) &&
              matches([
                r.name,
                r.id,
                r.brief,
                selectedClass.name,
                selectedSkill?.name,
                ...r.uses.map(
                  (u) => catalog.skills.find((s) => s.id === u.skillId)?.name,
                ),
              ]),
          )
          .sort(
            (a, b) =>
              ({ supported: 0, planned: 1, engine_owned: 2 })[a.status] -
                { supported: 0, planned: 1, engine_owned: 2 }[b.status] ||
              a.name.localeCompare(b.name),
          )
      : [];
  const supported = catalog.requirements.filter(
    (r) => r.status === "supported",
  ).length;
  return (
    <div className="creator-page" lang={locale === "zh" ? "zh-CN" : locale}>
      <a className="creator-skip" href="#creator-content">{t("Skip to catalogue")}</a>
      <header className="creator-header">
        <a
          href="/me"
          className="creator-brand"
          aria-label={t("OMOBA player portal")}
        >
          <Brand section={t("Creators")} />
        </a>
        <nav aria-label={t("Creator navigation")}>
          <Link href="/workshop" prefetch={false}>{t("Build a class")}</Link>
          <Link href="/market">{t("Market")}</Link>
          <a href={siteUrl}>{t("About the game ↗")}</a>
          <Link href="/me" prefetch={false}>{t("Player portal")}</Link>
          <a href="#creator-workflow">{t("How to contribute")}</a>
        </nav>
        <LanguageSelector />
      </header>
      <main id="creator-content">
        <section className="creator-hero">
          <div>
            <span className="creator-overline">{t("OMOBA / THE CREATOR ARMORY")}</span>
            <h1>{t("Make what enters")}<br />{t("the arena")}<span>.</span>
            </h1>
            <p>{t("Explore the game’s default visuals. Find a class, choose a design brief, and imagine what comes next.")}</p>
            <div className="creator-hero-actions">
              <a href="#creator-library" className="creator-primary">{t("Explore the library")}{" "}<span aria-hidden="true">↘</span>
              </a>
              <Link href="/workshop" className="creator-secondary">{t("Open class workshop ↗")}</Link>
            </div>
          </div>
          <figure className="creator-key-art">
            <img
              src="/art/supporter/spellblade.webp"
              alt={t("Silver-armored spellblade with a cyan aura, OMOBA brand illustration")}
              width={1024}
              height={1024}
              fetchPriority="high"
            />
            <figcaption>{t("OMOBA concept art · not an in-game skin")}</figcaption>
          </figure>
        </section>
        <div className="creator-hero-aside" aria-label={t("Library overview")}>
          <div className="creator-stat">
            <strong>{catalog.classes.length}</strong>
            <span>{t("playable class kits")}</span>
          </div>
          <div className="creator-stat">
            <strong>{catalog.skills.length}</strong>
            <span>{t("skills")}</span>
          </div>
          <div className="creator-stat">
            <strong>{supported.toString().padStart(2, "0")}</strong>
            <span>{t("static handheld briefs")}</span>
          </div>
          <p>{t("Game-owned references")}<span>{t("Current library snapshot")}</span>
          </p>
        </div>
        <section
          id="creator-workflow"
          className="creator-workflow"
          aria-label={t("Contribution workflow")}
        >
          <span className="creator-phase">{t("FIRST ITERATION")}</span>
          <p>
            <strong>{t("Explore → prepare → create a draft.")}</strong>{" "}{t("Download a brief to keep your design tied to this game revision. Static handheld models start in Studio and reach the market and the game once OMOBA approves them; Wildspark sets are submitted for the wildspark.handheld.set request. Exact-slot approval and equipping are still to come. Avatar appearance is separate from class kits.")}</p>
        </section>
        <section id="creator-library" className="creator-library">
          <div className="creator-library-heading">
            <div>
              <span className="creator-overline">{t("01 / DISCOVER")}</span>
              <h2>{t("The asset library")}</h2>
            </div>
            <label className="creator-search">
              <span>{t("Search classes, skills & assets")}</span>
              <input
                type="search"
                placeholder={t("Try Wildspark, rocket, sword…")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                maxLength={100}
              />
            </label>
          </div>
          <div className="creator-browser">
            <aside className="creator-class-list">
              <div className="creator-list-label">{t("CLASS KITS")}{" "}
                <span>{classes.length.toString().padStart(2, "0")}</span>
              </div>
              <nav aria-label={t("Class kits")}>
                {classes.map((c) => (
                  <Link
                    href={href(c.id)}
                    key={c.id}
                    className={c.id === selectedClass?.id ? "is-selected" : ""}
                    aria-current={
                      c.id === selectedClass?.id ? "true" : undefined
                    }
                    scroll={false}
                  >
                    <SkillIcon
                      icon={
                        catalog.skills.find((s) => s.id === c.skills[0]?.id)
                          ?.icon
                      }
                    />
                    <span>
                      {ct(c.name)}
                      <small>{t(c.role)}</small>
                    </span>
                    <span aria-hidden="true">↗</span>
                  </Link>
                ))}
              </nav>
              {classes.length === 0 ? (
                <p className="creator-muted">{t("No matching classes.")}</p>
              ) : null}
            </aside>
            <div className="creator-results">
              {invalid ? (
                <div className="creator-empty" role="status">
                  <h2>{t("This catalogue link is unavailable")}</h2>
                  <p>{t("The class, skill or requirement is not part of this snapshot.")}</p>
                  <Link href="/creators" className="creator-primary">{t("Browse all classes")}</Link>
                </div>
              ) : selectedClass ? (
                <>
                  <div className="creator-class-heading">
                    <div>
                      <span className="creator-overline">
                        {t(selectedClass.role)}{" "}{t("/ CLASS KIT")}</span>
                      <h2>{ct(selectedClass.name)}</h2>
                      <p>{ct(selectedClass.description)}</p>
                    </div>
                    <code>{selectedClass.id}</code>
                  </div>
                  <nav
                    className="creator-skills"
                    aria-label={ct("{className} skills", {className: ct(selectedClass.name)})}
                  >
                    <Link
                      href={href(selectedClass.id)}
                      className={
                        !skillId
                          ? "is-selected creator-all-skills"
                          : "creator-all-skills"
                      }
                      aria-current={!skillId ? "true" : undefined}
                      scroll={false}
                    >
                      <span aria-hidden="true">◈</span>
                      <strong>{t("Whole kit")}</strong>
                      <small>{t("Basic attack + QWER")}</small>
                    </Link>
                    {selectedClass.skills.map((slot) => {
                      const skill = catalog.skills.find(
                        (s) => s.id === slot.id,
                      )!;
                      return (
                        <Link
                          href={href(selectedClass.id, skill.id)}
                          key={slot.slot}
                          className={
                            selectedSkill?.id === skill.id ? "is-selected" : ""
                          }
                          aria-current={
                            selectedSkill?.id === skill.id ? "true" : undefined
                          }
                          scroll={false}
                        >
                          <SkillIcon icon={skill.icon} />
                          <span className="creator-key">
                            {slot.slot.toUpperCase()}
                          </span>
                          <strong>{ct(skill.name)}</strong>
                        </Link>
                      );
                    })}
                  </nav>
                  <div className="creator-context">
                    {selectedSkill ? (
                      <>
                        <strong>{ct(selectedSkill.name)}</strong>
                        <p>{ct(selectedSkill.description)}</p>
                      </>
                    ) : (
                      <>
                        <strong>{t("Basic attack ·")}{" "}{ct(selectedClass.basicAttack.name)}
                        </strong>
                        <p>{t("Explore the kit’s shared weapons, skill effects and motion references. Labels show which design paths are available today.")}</p>
                      </>
                    )}
                  </div>
                  {requirementId ? (
                    <Link
                      className="creator-clear-link"
                      href={href(selectedClass.id, skillId || undefined)}
                      scroll={false}
                    >{t("← Show all requirements")}</Link>
                  ) : null}
                  <div className="creator-results-label" role="status">
                    <span>
                      {requirements.length}{" "}
                      {requirements.length === 1
                        ? t("design reference")
                        : t("design references")}
                    </span>
                    <span>{t("DEFAULTS & CREATIVE BRIEFS")}</span>
                  </div>
                  {requirements.length ? (
                    <div className="creator-assets">
                      {requirements.map((r) => (
                        <RequirementCard
                          key={r.id}
                          requirement={r}
                          catalog={catalog}
                          classId={selectedClass.id}
                          skillId={skillId || undefined}
                          selected={r.id === requirementId}
                          studioUrl={studioUrl}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="creator-empty" role="status">
                      <h3>{t("No matching design references")}</h3>
                      <p>{t("Try another class or skill, or clear your search.")}</p>
                      <button onClick={() => setSearch("")}>{t("Clear search")}</button>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </section>
      </main>
      <footer className="creator-footer">
        <div>
          <strong>{t("OMOBA / CREATOR LIBRARY")}</strong>
          <p>{t("Open source. Room for your imagination.")}</p>
        </div>
        <details>
          <summary>{t("Snapshot provenance")}</summary>
          <p>{t("Game commit")}{" "}<code>{catalog.source.commit}</code>
          </p>
          <p>{t("Catalogue")}{" "}<code>{catalog.revision}</code>
          </p>
          <p>{t("Inputs")}{" "}<code>{catalog.source.inputsSha256}</code>
          </p>
          <p>{t("Skill icons: CC-BY-4.0 · Open Moba contributors.")}</p>
          <a href="/asset-catalog/catalog.json" download>{t("Download catalogue JSON ↓")}</a>
        </details>
      </footer>
    </div>
  );
}
