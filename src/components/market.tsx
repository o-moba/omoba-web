"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Brand } from "@/components/brand";
import { LanguageSelector, useLocale } from "@/components/locale-provider";
import { DEFAULT_SITE_URL } from "@/lib/navigation.mjs";
import { devicePollRetry, marketGroups } from "@/lib/market.mjs";
import type { EkzaDevice, EkzaSession, MarketItem, MarketState, OwnedAsset } from "@/lib/market-types";

type Preview = { id: string; url: string };
type Panel = EkzaSession | { state: "pending"; device: EkzaDevice };
class EkzaFailure extends Error {
  constructor(public code: string, public status: number, public retryAfter: number | null = null) { super(code); }
}
/** Credentials stay in HttpOnly cookies; every mutation carries an origin-bound CSRF proof. */
async function ekza<T>(path: string, method = "GET"): Promise<T> {
  const headers: Record<string, string> = {};
  if (method !== "GET") {
    const csrf = await fetch("/api/ekza/csrf", { cache: "no-store" }).catch(() => null);
    if (!csrf?.ok) throw new EkzaFailure("registry_unavailable", 503);
    headers["X-CSRF-Token"] = (await csrf.json()).token;
  }
  const response = await fetch("/api/ekza/" + path, { method, headers, cache: "no-store" }).catch(() => null);
  if (!response) throw new EkzaFailure("registry_unavailable", 503);
  const value = await response.json().catch(() => ({}));
  if (!response.ok) {
    const retry = response.headers.get("retry-after");
    throw new EkzaFailure(value.code || "registry_unavailable", response.status, retry && /^\d{1,4}$/.test(retry) ? Number(retry) : null);
  }
  return value;
}
const failureCopy: Record<string, string> = {
  link_expired: "Your Ekza sign-in expired. Sign in again.",
  link_scope: "This Ekza sign-in cannot add items. Sign in again and allow adding free items.",
  asset_not_available: "This item is no longer available for OMOBA.",
  claim_not_removable: "This item was added in Ekza Studio or by another game, so it stays in your library. Manage it in Ekza Studio.",
  claims_unsupported: "Ekza does not accept free claims from this site yet. Try again later.",
  device_expired: "The sign-in code expired. Start again.",
  rate_limited: "Too many requests. Please wait a moment and try again.",
  csrf_rejected: "This page is out of date. Reload it and try again.",
  invalid_service_response: "Ekza returned an unexpected response. Try again later.",
  registry_error: "Ekza returned an unexpected response. Try again later.",
};
function failureText(error: unknown) {
  const code = error instanceof EkzaFailure ? error.code : "";
  return failureCopy[code] || "The Ekza Registry is unavailable. Try again later.";
}
const noticeCopy = {
  removed: "Removed from your Ekza library.",
  signedOutUnconfirmed: "Signed out here. Ekza could not confirm it, so OMOBA may still be listed under Account → Connected games in Ekza Studio. You can disconnect it there.",
};
const WILDSPARK_BRIEF = "/creators?class=wildspark&skill=wild_switch";

function ItemPreview({ item, previews }: { item: MarketItem; previews: Preview[] }) {
  const { t } = useLocale();
  const image = useRef<HTMLImageElement>(null);
  const [broken, setBroken] = useState(false);
  // Placeholder (1×1) and failed thumbnails fall back, including loads before hydration.
  const check = useCallback(() => {
    const img = image.current;
    if (img?.complete && img.naturalWidth < 8) setBroken(true);
  }, []);
  useEffect(check, [check]);
  if (item.thumbnailUrl && !broken)
    return (
      <img
        ref={image}
        src={item.thumbnailUrl}
        alt={t("Preview of {name}").replace("{name}", item.name)}
        width={640}
        height={480}
        loading="lazy"
        onLoad={check}
        onError={() => setBroken(true)}
      />
    );
  if (item.wildspark && previews.length)
    return (
      <>
        <div className="market-preview-pair">
          {previews.map((p) => (
            <img
              key={p.id}
              src={p.url}
              alt={p.id.endsWith("launcher") ? t("Default Wildspark launcher") : t("Default Wildspark repeater")}
              width={320}
              height={240}
              loading="lazy"
            />
          ))}
        </div>
        <span className="creator-preview-label">{t("DEFAULT SET · REFERENCE")}</span>
      </>
    );
  return (
    <div className="creator-no-preview">
      <span aria-hidden="true">{item.kind === "avatar" ? "◎" : "◇"}</span>
      <strong>{t("No preview yet")}</strong>
      <span>{t("The creator has not published a thumbnail.")}</span>
    </div>
  );
}

function ItemCard({
  item,
  previews,
  panel,
  owned,
  busy,
  error,
  notice,
  studioLibraryUrl,
  onSignIn,
  onClaim,
  onRemove,
}: {
  item: MarketItem;
  previews: Preview[];
  panel: Panel;
  owned: OwnedAsset | undefined;
  busy: boolean;
  error: string | undefined;
  notice: string | undefined;
  studioLibraryUrl: string;
  onSignIn: () => void;
  onClaim: (item: MarketItem) => void;
  onRemove: (item: MarketItem) => void;
}) {
  const { t } = useLocale();
  let action: React.ReactNode;
  if (panel.state === "connected" && owned)
    action = (
      <>
        <span className="market-owned">✓ {t("Owned")}</span>
        {/* Only this site's own claims can be removed here; the rest belong to Studio. */}
        {owned.reason === "claimed" ? (
          <button className="market-text-button" disabled={busy} onClick={() => onRemove(item)}>
            {t("Remove from library")}
          </button>
        ) : (
          <a className="creator-studio-link market-manage" href={studioLibraryUrl} target="_blank" rel="noreferrer">
            {t("Manage in Ekza Studio ↗")}
          </a>
        )}
      </>
    );
  else if (panel.state === "connected")
    action = (
      <button className="market-get" disabled={busy} onClick={() => onClaim(item)}>
        {busy ? t("Adding…") : t("Get free")}
      </button>
    );
  else if (panel.state === "pending")
    action = <button disabled>{t("Waiting for Ekza approval…")}</button>;
  else if (panel.state === "unavailable")
    action = <button disabled>{t("Library unavailable")}</button>;
  else action = <button onClick={onSignIn}>{t("Sign in to get")}</button>;
  return (
    <article className="creator-asset market-card" aria-label={item.name} id={"asset-" + item.assetId}>
      <div className="creator-preview">
        <ItemPreview item={item} previews={previews} />
        <span className="creator-status">{item.kind === "avatar" ? t("Avatar") : t("Weapon")}</span>
        {item.wildspark ? <span className="market-badge">{t("Wildspark set")}</span> : null}
      </div>
      <div className="creator-asset-body">
        <div className="creator-asset-title">
          <span className="creator-overline">
            {item.wildspark ? t("REPEATER + LAUNCHER") : item.kind === "avatar" ? t("OMOBA AVATAR") : t("HELD WEAPON")}
          </span>
          <span className="market-price">{t("Free")}</span>
        </div>
        <h3>{item.name}</h3>
        <p className="market-creator">
          {t("by {creator}").split("{creator}")[0]}
          <strong>{item.creator}</strong>
          {t("by {creator}").split("{creator}")[1]}
        </p>
        {item.description ? <p className="creator-brief">{item.description}</p> : null}
        <p className="market-license">
          <strong>{item.license.text}</strong>
          {" · "}
          {item.license.attribution || t("No attribution provided")}
        </p>
        <div className="creator-asset-actions">{action}</div>
        {error ? <p role="alert" className="market-error">{t(error)}</p> : null}
        {notice ? <p role="status" className="market-notice">{t(notice)}</p> : null}
        {item.wildspark ? (
          <Link className="creator-studio-link" href={WILDSPARK_BRIEF}>{t("Wildspark design brief ↗")}</Link>
        ) : item.kind === "weapon" ? (
          <Link className="creator-studio-link" href="/creators">{t("Weapon design briefs ↗")}</Link>
        ) : null}
        <details className="creator-provenance">
          <summary>{t("Technical details")}</summary>
          <dl>
            <dt>{t("Asset")}</dt>
            <dd><code>{item.id}</code></dd>
            <dt>{t("Revision")}</dt>
            <dd><code>{item.revisionId}</code></dd>
            <dt>{t("Profile")}</dt>
            <dd>{item.profile}</dd>
            {item.requirementId ? (
              <>
                <dt>{t("Requirement")}</dt>
                <dd><code>{item.requirementId}</code></dd>
              </>
            ) : null}
            <dt>SHA-256</dt>
            <dd><code>{item.sha256}</code></dd>
            <dt>{t("Size")}</dt>
            <dd>{Math.max(1, Math.round(item.sizeBytes / 1024))} KB</dd>
          </dl>
        </details>
      </div>
    </article>
  );
}

function AccountPanel({
  panel,
  busy,
  retrying,
  message,
  onSignIn,
  onSignOut,
  onRetry,
}: {
  panel: Panel;
  busy: boolean;
  retrying: boolean;
  message: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
  onRetry: () => void;
}) {
  const { t } = useLocale();
  return (
    <aside className="market-account" aria-label={t("Ekza library")}>
      <span className="creator-overline">{t("EKZA LIBRARY")}</span>
      {panel.state === "connected" ? (
        <>
          <h2>{t("Signed in to Ekza")}</h2>
          <p className="market-username">
            {t("Library:")} <strong>{panel.username}</strong>
          </p>
          <p>{t("Free items you get here appear in the game under “My Ekza library” when the game is connected to the same Ekza account.")}</p>
          <button disabled={busy} onClick={onSignOut}>{t("Sign out of Ekza")}</button>
        </>
      ) : panel.state === "pending" ? (
        <>
          <h2>{t("Approve in Ekza Studio")}</h2>
          <p>{t("Confirm this code on the Ekza Studio page:")}</p>
          <strong className="market-code" aria-label={t("Sign-in code")}>{panel.device.userCode}</strong>
          {panel.device.verificationUrl ? (
            <a className="creator-primary" href={panel.device.verificationUrl} target="_blank" rel="noreferrer">
              {t("Open Ekza Studio ↗")}
            </a>
          ) : (
            <p className="market-error">{t("Verification link is unavailable or not trusted.")}</p>
          )}
          <p className="market-small" role="status">
            {retrying ? t("Ekza is not answering. Still trying…") : t("This page updates after you approve.")}
          </p>
          <button className="market-text-button" disabled={busy} onClick={onSignOut}>{t("Cancel")}</button>
        </>
      ) : (
        <>
          <h2>{panel.state === "expired" ? t("Sign in again") : t("Sign in with Ekza")}</h2>
          {panel.state === "expired" ? (
            <p className="market-error" role="alert">{t("Your Ekza sign-in expired. Sign in again.")}</p>
          ) : null}
          {panel.state === "unavailable" ? (
            <p className="market-error" role="alert">{t("Your Ekza library is unavailable right now. Your sign-in has not been removed.")}</p>
          ) : null}
          <p>{t("Free items are kept in your Ekza library, the same library the game reads. OMOBA can read your library for this game and add the free items you choose.")}</p>
          {panel.state === "unavailable" ? (
            <button disabled={busy} onClick={onRetry}>{t("Retry")}</button>
          ) : (
            <button className="market-get" disabled={busy} onClick={onSignIn}>{t("Sign in with Ekza")}</button>
          )}
        </>
      )}
      {message ? <p className="market-error" role="alert">{message}</p> : null}
    </aside>
  );
}

function Grid({ items, render }: { items: MarketItem[]; render: (item: MarketItem) => React.ReactNode }) {
  return <div className="market-grid">{items.map(render)}</div>;
}

export default function Market({
  market,
  initialSession,
  wildsparkPreviews,
  studioDraftUrl,
  studioLibraryUrl,
  siteUrl = DEFAULT_SITE_URL,
}: {
  market: MarketState;
  initialSession: EkzaSession;
  wildsparkPreviews: Preview[];
  studioDraftUrl: string;
  studioLibraryUrl: string;
  siteUrl?: string;
}) {
  const { locale, t } = useLocale();
  const [panel, setPanel] = useState<Panel>(initialSession);
  const [panelBusy, setPanelBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pollRetrying, setPollRetrying] = useState(false);
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({});
  const [itemNotices, setItemNotices] = useState<Record<string, string>>({});
  const owned = useMemo(
    () => new Map(panel.state === "connected" ? panel.owned.map((o) => [o.assetId, o]) : []),
    [panel],
  );
  const failed = useCallback((error: unknown) => {
    const code = error instanceof EkzaFailure ? error.code : "";
    if (code === "link_expired") setPanel({ state: "expired" });
    else if (code === "link_scope" || code === "device_expired") setPanel({ state: "guest" });
    if (code !== "link_expired") setMessage(failureText(error));
    else setMessage(null);
  }, []);
  const refresh = useCallback(async () => {
    try {
      const library = await ekza<{ account: { username: string }; expiresAt: string; owned: OwnedAsset[] }>("library");
      setPanel({ state: "connected", username: library.account.username, expiresAt: library.expiresAt, owned: library.owned });
      setMessage(null);
    } catch (error) {
      // The BFF has already cleared a link that cannot work again.
      if (error instanceof EkzaFailure && (error.code === "link_expired" || error.code === "link_scope")) failed(error);
      else setPanel((current) => (current.state === "connected" ? current : { state: "unavailable" }));
    }
  }, [failed]);
  // The first paint found a dead link but cannot change cookies; one BFF read clears it.
  useEffect(() => {
    if (initialSession.state === "expired") void ekza("library").catch(() => {});
  }, [initialSession.state]);
  const pending = panel.state === "pending" ? panel.device : null;
  useEffect(() => {
    if (!pending) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    // A failure that waiting cannot fix ends the sign-in; the panel never stays pending.
    const stop = (error: unknown) => {
      setPollRetrying(false);
      failed(error);
      setPanel((current) => (current.state === "pending" ? { state: "guest" } : current));
    };
    const tick = async () => {
      try {
        const result = await ekza<{ status: string }>("device/poll", "POST");
        if (!live) return;
        failures = 0;
        setPollRetrying(false);
        if (result.status === "connected") await refresh();
        else timer = setTimeout(tick, pending.interval * 1000);
      } catch (error) {
        if (!live) return;
        // A cold start, a 5xx, a timeout or a 429 keeps polling with backoff.
        const failure = error instanceof EkzaFailure ? error : new EkzaFailure("registry_unavailable", 503);
        const delay = devicePollRetry(failure.code, ++failures, pending.interval, failure.retryAfter);
        if (delay === null) return stop(failure);
        const left = Date.parse(pending.expiresAt) - Date.now();
        if (left <= 0) return stop(new EkzaFailure("device_expired", 410));
        setPollRetrying(true);
        timer = setTimeout(tick, left < delay ? left : delay);
      }
    };
    timer = setTimeout(tick, pending.interval * 1000);
    return () => {
      live = false;
      clearTimeout(timer);
      setPollRetrying(false);
    };
  }, [pending, refresh, failed]);
  async function signIn() {
    setPanelBusy(true);
    setMessage(null);
    try {
      const device = await ekza<EkzaDevice>("device", "POST");
      setPanel({ state: "pending", device });
    } catch (error) {
      failed(error);
    } finally {
      setPanelBusy(false);
    }
  }
  async function signOut() {
    setPanelBusy(true);
    try {
      // The BFF ends the Registry link first (best effort), then clears the cookies.
      const result = await ekza<{ revoked: boolean | null }>("sign-out", "POST");
      setPanel({ state: "guest" });
      setMessage(result.revoked === false ? noticeCopy.signedOutUnconfirmed : null);
      setItemErrors({});
      setItemNotices({});
    } catch (error) {
      setMessage(failureText(error));
    } finally {
      setPanelBusy(false);
    }
  }
  async function change(item: MarketItem, method: "POST" | "DELETE") {
    setBusyItem(item.assetId);
    setItemErrors(({ [item.assetId]: _old, ...rest }) => rest);
    setItemNotices(({ [item.assetId]: _old, ...rest }) => rest);
    try {
      const result = await ekza<{ status: string }>("library/" + item.assetId, method);
      setPanel((current) => {
        if (current.state !== "connected") return current;
        const others = current.owned.filter((o) => o.assetId !== item.assetId);
        if (method === "DELETE") return { ...current, owned: others };
        const previous = current.owned.find((o) => o.assetId === item.assetId);
        return {
          ...current,
          owned: [...others, { assetId: item.assetId, kind: item.kind, reason: result.status === "claimed" ? "claimed" : previous?.reason ?? null }],
        };
      });
      if (method === "DELETE") setItemNotices((current) => ({ ...current, [item.assetId]: noticeCopy.removed }));
      void refresh();
    } catch (error) {
      const code = error instanceof EkzaFailure ? error.code : "";
      if (code === "link_expired" || code === "link_scope") failed(error);
      if (code === "claim_not_removable") {
        // Still owned, but through Studio or another game: offer Studio instead of Remove.
        setPanel((current) =>
          current.state === "connected"
            ? { ...current, owned: current.owned.map((o) => (o.assetId === item.assetId ? { ...o, reason: "saved" } : o)) }
            : current,
        );
        void refresh();
      }
      setItemErrors((current) => ({ ...current, [item.assetId]: failureText(error) }));
    } finally {
      setBusyItem(null);
    }
  }
  const card = (item: MarketItem) => (
    <ItemCard
      key={item.id}
      item={item}
      previews={wildsparkPreviews}
      panel={panel}
      owned={owned.get(item.assetId)}
      busy={busyItem === item.assetId || panelBusy}
      error={itemErrors[item.assetId]}
      notice={itemNotices[item.assetId]}
      studioLibraryUrl={studioLibraryUrl}
      onSignIn={() => void signIn()}
      onClaim={(i) => void change(i, "POST")}
      onRemove={(i) => void change(i, "DELETE")}
    />
  );
  const groups = market.state === "ready" ? marketGroups(market.items) : null;
  return (
    <div className="creator-page market-page" lang={locale === "zh" ? "zh-CN" : locale}>
      <a className="creator-skip" href="#market-content">{t("Skip to market")}</a>
      <header className="creator-header">
        <Link href="/market" className="creator-brand" aria-label={t("OMOBA market")}>
          <Brand section={t("Market")} />
        </Link>
        <nav aria-label={t("Market navigation")}>
          <Link href="/creators">{t("Asset library")}</Link>
          <Link href="/workshop" prefetch={false}>{t("Build a class")}</Link>
          <Link href="/me" prefetch={false}>{t("Player portal")}</Link>
          <a href={siteUrl}>{t("About the game ↗")}</a>
        </nav>
        <LanguageSelector />
      </header>
      <main id="market-content">
        <section className="market-hero">
          <div>
            <span className="creator-overline">{t("OMOBA / COMMUNITY MARKET")}</span>
            <h1>
              {t("Gear made by players")}
              <span>.</span>
            </h1>
            <p>{t("Weapons and avatars from Ekza Studio creators, reviewed and approved for OMOBA. Everything is free during the beta: add an item to your Ekza library, then pick it in the game.")}</p>
          </div>
          <AccountPanel
            panel={panel}
            busy={panelBusy}
            retrying={pollRetrying}
            message={message ? t(message) : null}
            onSignIn={() => void signIn()}
            onSignOut={() => void signOut()}
            onRetry={() => void refresh()}
          />
        </section>
        {market.state === "unavailable" || !groups ? (
          <section className="creator-empty market-unavailable" role="alert">
            <h2>{t("Market unavailable")}</h2>
            <p>{t("The Ekza Registry could not be reached, so community items cannot be shown right now. Nothing in your library has changed.")}</p>
            <a className="creator-primary" href="/market">{t("Try again")}</a>
          </section>
        ) : (
          <>
            <section id="wildspark" className="market-section market-featured" aria-labelledby="market-wildspark">
              <div className="market-section-heading">
                <div>
                  <span className="creator-overline">{t("FEATURED / WILDSPARK")}</span>
                  <h2 id="market-wildspark">{t("Wildspark sets")}</h2>
                  <p>{t("One set carries both of Wildspark’s guns, the repeater and the launcher. In the game, Wildspark’s Q switches between them.")}</p>
                </div>
                <div className="market-cta">
                  <a className="creator-primary" href={studioDraftUrl} target="_blank" rel="noreferrer">
                    {t("Make one in Ekza Studio ↗")}
                  </a>
                  <Link className="creator-secondary" href={WILDSPARK_BRIEF}>{t("Read the Wildspark brief")}</Link>
                </div>
              </div>
              {groups.wildspark.length ? (
                <Grid items={groups.wildspark} render={card} />
              ) : (
                <div className="creator-empty" role="status">
                  <h3>{t("No Wildspark sets yet")}</h3>
                  <p>{t("Be the first: build a repeater + launcher set from the brief and submit it for OMOBA in Ekza Studio.")}</p>
                </div>
              )}
            </section>
            <section className="market-section" aria-labelledby="market-weapons">
              <div className="market-section-heading">
                <div>
                  <span className="creator-overline">{t("02 / WEAPONS")}</span>
                  <h2 id="market-weapons">{t("Weapons")}</h2>
                </div>
              </div>
              {groups.weapons.length ? (
                <Grid items={groups.weapons} render={card} />
              ) : (
                <p className="creator-muted" role="status">{t("No other approved weapons yet.")}</p>
              )}
            </section>
            <section className="market-section" aria-labelledby="market-avatars">
              <div className="market-section-heading">
                <div>
                  <span className="creator-overline">{t("03 / AVATARS")}</span>
                  <h2 id="market-avatars">{t("Avatars")}</h2>
                </div>
              </div>
              {groups.avatars.length ? (
                <Grid items={groups.avatars} render={card} />
              ) : (
                <p className="creator-muted" role="status">{t("No approved avatars yet.")}</p>
              )}
            </section>
          </>
        )}
      </main>
      <footer className="creator-footer">
        <div>
          <strong>{t("OMOBA / MARKET")}</strong>
          <p>{t("Items, creators and licences come from the Ekza Registry.")}</p>
        </div>
        <p>{t("During the beta every approved free item can be used in the game. Your Ekza library decides what the game lists under “My Ekza library”.")}</p>
      </footer>
    </div>
  );
}
