"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type {
  AssetCatalog,
  AssetRequirement,
  CatalogIcon,
} from "@/lib/asset-catalog-types";
import { contributionBrief } from "@/lib/asset-catalog.mjs";

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
}: {
  requirement: AssetRequirement;
  catalog: AssetCatalog;
  classId: string;
  skillId?: string;
  selected: boolean;
}) {
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
      aria-label={r.name}
    >
      <div className="creator-preview">
        {r.baseline.preview ? (
          <img
            src={r.baseline.preview.url}
            alt={`Default ${r.name} model reference`}
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
                ? "Rendered by the game"
                : "Reference only"}
            </strong>
            <span>No static preview available</span>
          </div>
        )}
        <span className={"creator-status " + r.status}>
          {statusLabel[r.status]}
        </span>
        {r.baseline.preview ? (
          <span className="creator-preview-label">
            DEFAULT · MODEL REFERENCE
          </span>
        ) : null}
      </div>
      <div className="creator-asset-body">
        <div className="creator-asset-title">
          <span className="creator-overline">{roleLabel[r.role]}</span>
          <a
            href={href(classId, skillId, r.id)}
            aria-label={`Link to ${r.name}`}
          >
            ↗
          </a>
        </div>
        <h3>{r.name}</h3>
        <p className="creator-brief">{r.brief}</p>
        <p className="creator-uses">
          <strong>Used by</strong>{" "}
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
            .join(" · ")}
          <span>
            {r.classIds
              .map((id) => catalog.classes.find((c) => c.id === id)?.name)
              .join(" / ")}
          </span>
        </p>
        <div className="creator-asset-actions">
          <button onClick={downloadBrief}>
            Download brief <span aria-hidden="true">↓</span>
          </button>
          {r.status === "supported" ? (
            <a
              className="creator-studio-link"
              href="https://studio.ekza.io/studio?view=new"
              target="_blank"
              rel="noreferrer"
            >
              Start a Studio draft ↗
            </a>
          ) : null}
        </div>
        {downloadError ? (
          <p role="alert">The brief could not be prepared. Please try again.</p>
        ) : null}
        <details className="creator-provenance">
          <summary>Default & technical reference</summary>
          <dl>
            <dt>Requirement</dt>
            <dd>
              <code>{r.id}</code>
            </dd>
            <dt>Baseline</dt>
            <dd>{r.baseline.kind}</dd>
            <dt>Source</dt>
            <dd>
              <code>{r.baseline.sourcePath}</code>
            </dd>
            <dt>SHA-256</dt>
            <dd>
              <code>{r.baseline.sha256}</code>
            </dd>
            <dt>Profile</dt>
            <dd>
              {r.profile
                ? `${r.profile.id} · v${r.profile.version}`
                : "No submission profile yet"}
            </dd>
            {r.baseline.license ? (
              <>
                <dt>License</dt>
                <dd>
                  {r.baseline.license} · {r.baseline.attribution}
                </dd>
              </>
            ) : null}
          </dl>
          {r.baseline.url && r.baseline.license ? (
            <a className="creator-file-link" href={r.baseline.url} download>
              Download baseline GLB · {(r.baseline.bytes / 1024).toFixed(0)} KB
              ↓
            </a>
          ) : null}
          {r.profile ? (
            <p>
              <a
                href={`https://github.com/o-moba/omoba-bevy/blob/${catalog.source.commit}/docs/profiles/handheld-glb-v1.json`}
                target="_blank"
                rel="noreferrer"
              >
                Read the versioned authoring rules ↗
              </a>
            </p>
          ) : null}
          <p>
            Model references do not reproduce combat rendering, attachment
            transforms or animation.
          </p>
        </details>
      </div>
    </article>
  );
}
export default function CreatorCatalog({ catalog }: { catalog: AssetCatalog }) {
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
    !needle || parts.some((p) => p?.toLocaleLowerCase().includes(needle));
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
    <div className="creator-page" lang="en">
      <a className="creator-skip" href="#creator-content">
        Skip to catalogue
      </a>
      <header className="creator-header">
        <a href="/" className="creator-brand" aria-label="OMOBA player portal">
          <span aria-hidden="true">O</span> OMOBA <small>CREATORS</small>
        </a>
        <nav aria-label="Creator navigation">
          <Link href="/workshop" prefetch={false}>
            Build a class
          </Link>
          <a href="https://omoba.io" target="_blank" rel="noreferrer">
            About the game ↗
          </a>
          <Link href="/" prefetch={false}>
            Player portal
          </Link>
          <a href="#creator-workflow">How to contribute</a>
        </nav>
      </header>
      <main id="creator-content">
        <section className="creator-hero">
          <div>
            <span className="creator-overline">
              <span className="creator-live-dot" /> THE OPEN MOBA CREATOR
              LIBRARY
            </span>
            <h1>
              Make your mark
              <br />
              on the battlefield<span>.</span>
            </h1>
            <p>
              Explore the game’s default visuals. Find a class, choose a design
              brief, and imagine what comes next.
            </p>
            <a href="#creator-library" className="creator-primary">
              Explore the library <span aria-hidden="true">↘</span>
            </a>
          </div>
          <div className="creator-hero-aside">
            <span className="creator-overline">
              A SHARED WORLD. YOUR CREATIVE VOICE.
            </span>
            <div className="creator-stat">
              <strong>{catalog.classes.length}</strong>
              <span>playable class kits</span>
            </div>
            <div className="creator-stat">
              <strong>{catalog.skills.length}</strong>
              <span>skills</span>
            </div>
            <div className="creator-stat">
              <strong>{supported.toString().padStart(2, "0")}</strong>
              <span>static handheld briefs</span>
            </div>
            <p>
              Game-owned references
              <br />
              <span>Snapshot · {catalog.source.gameplayRevision}</span>
            </p>
          </div>
        </section>
        <section
          id="creator-workflow"
          className="creator-workflow"
          aria-label="Contribution workflow"
        >
          <span className="creator-phase">FIRST ITERATION</span>
          <p>
            <strong>Explore → prepare → create a draft.</strong> Download a
            brief to keep your design tied to this game revision. Static
            handheld models can start in Studio; exact-slot submissions, public
            galleries, exact-slot approval and equipping are still to come.
            Avatar appearance is separate from class kits.
          </p>
        </section>
        <section id="creator-library" className="creator-library">
          <div className="creator-library-heading">
            <div>
              <span className="creator-overline">01 / DISCOVER</span>
              <h2>The asset library</h2>
            </div>
            <label className="creator-search">
              <span>Search classes, skills & assets</span>
              <input
                type="search"
                placeholder="Try Wildspark, rocket, sword…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                maxLength={100}
              />
            </label>
          </div>
          <div className="creator-browser">
            <aside className="creator-class-list">
              <div className="creator-list-label">
                CLASS KITS{" "}
                <span>{classes.length.toString().padStart(2, "0")}</span>
              </div>
              <nav aria-label="Class kits">
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
                    <span className="creator-class-monogram" aria-hidden="true">
                      {c.name.slice(0, 1)}
                    </span>
                    <span>
                      {c.name}
                      <small>{c.role}</small>
                    </span>
                    <span aria-hidden="true">↗</span>
                  </Link>
                ))}
              </nav>
              {classes.length === 0 ? (
                <p className="creator-muted">No matching classes.</p>
              ) : null}
            </aside>
            <div className="creator-results">
              {invalid ? (
                <div className="creator-empty" role="status">
                  <h2>This catalogue link is unavailable</h2>
                  <p>
                    The class, skill or requirement is not part of this
                    snapshot.
                  </p>
                  <Link href="/creators" className="creator-primary">
                    Browse all classes
                  </Link>
                </div>
              ) : selectedClass ? (
                <>
                  <div className="creator-class-heading">
                    <div>
                      <span className="creator-overline">
                        {selectedClass.role} / CLASS KIT
                      </span>
                      <h2>{selectedClass.name}</h2>
                      <p>{selectedClass.description}</p>
                    </div>
                    <code>{selectedClass.id}</code>
                  </div>
                  <nav
                    className="creator-skills"
                    aria-label={`${selectedClass.name} skills`}
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
                      <strong>Whole kit</strong>
                      <small>Basic attack + QWER</small>
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
                          <strong>{skill.name}</strong>
                        </Link>
                      );
                    })}
                  </nav>
                  <div className="creator-context">
                    {selectedSkill ? (
                      <>
                        <strong>{selectedSkill.name}</strong>
                        <p>{selectedSkill.description}</p>
                      </>
                    ) : (
                      <>
                        <strong>
                          Basic attack · {selectedClass.basicAttack.name}
                        </strong>
                        <p>
                          Explore the kit’s shared weapons, skill effects and
                          motion references. Labels show which design paths are
                          available today.
                        </p>
                      </>
                    )}
                  </div>
                  {requirementId ? (
                    <Link
                      className="creator-clear-link"
                      href={href(selectedClass.id, skillId || undefined)}
                      scroll={false}
                    >
                      ← Show all requirements
                    </Link>
                  ) : null}
                  <div className="creator-results-label" role="status">
                    <span>
                      {requirements.length}{" "}
                      {requirements.length === 1
                        ? "design reference"
                        : "design references"}
                    </span>
                    <span>DEFAULTS & CREATIVE BRIEFS</span>
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
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="creator-empty" role="status">
                      <h3>No matching design references</h3>
                      <p>Try another class or skill, or clear your search.</p>
                      <button onClick={() => setSearch("")}>
                        Clear search
                      </button>
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
          <strong>OMOBA / CREATOR LIBRARY</strong>
          <p>Open source. Room for your imagination.</p>
        </div>
        <details>
          <summary>Snapshot provenance</summary>
          <p>
            Game commit <code>{catalog.source.commit}</code>
          </p>
          <p>
            Catalogue <code>{catalog.revision}</code>
          </p>
          <p>
            Inputs <code>{catalog.source.inputsSha256}</code>
          </p>
          <p>Skill icons: CC-BY-4.0 · Open Moba contributors.</p>
          <a href="/asset-catalog/catalog.json" download>
            Download catalogue JSON ↓
          </a>
        </details>
      </footer>
    </div>
  );
}
