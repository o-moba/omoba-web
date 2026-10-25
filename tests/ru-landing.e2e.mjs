// The RU landing (LR-22) against the real standalone build. Run after a build, in the
// market the build was made for:
//   OMOBA_MARKET=ru OMOBA_VKID_CLIENT_ID=51234567 npm run build && npm run test:ru-landing
//   npm run build && npm run test:ru-landing                                    # global
// Only a loopback fake Account API is contacted (/v1/me and /v1/releases).
// RU: `/` is the guest home signed out and `/me` signed in; its claims are counted from
// the game's catalog snapshot; downloads come from the catalog with SHA-256, sizes in МБ
// and the localized status; the footer carries the legal links and the age sign; and no
// RU page shows donate, wallet, crypto, Solana or Ekza content. Global: `/` is unchanged.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { chromium } from "@playwright/test";

const required = JSON.parse(await readFile(new URL("../.next/required-server-files.json", import.meta.url), "utf8"));
const built = required.config?.env?.OMOBA_BUILT_MARKET ?? "";
assert.match(built, /^(ru|global) \(/, "run after a global or a ru build (got " + built + ")");
const market = built.startsWith("ru ") ? "ru" : "global";
const catalog = JSON.parse(await readFile(new URL("../public/asset-catalog/catalog.json", import.meta.url), "utf8"));
const CLASSES = catalog.classes.length;

/** Text that must never reach an RU surface: donations, wallets, crypto, Solana, Ekza. */
const FORBIDDEN = /\/donate|donat|донат|wallet|кошел[её]к|crypto(?!graph)|криптовалют|solana|ekza/i;
const SESSION = "e".repeat(64);
const account = {
  profile: { profile_id: "a".repeat(64), nickname: "Иван#1234", rating: 1000, rated_matches: 0, wins: 0, losses: 0, progression_xp: "0", level: "1" },
  settings: { public_profile_enabled: false, public_stats_enabled: false, discoverable: false, locale: "ru", timezone: "Europe/Moscow", version: "1" },
  rules: { newcomer_matches: 10 }, session: { session_id: "s".repeat(64) }, social: [],
};
const entry = (platform, architecture, file, bytes, digit = "c") => ({
  platform, architecture, version: "0.45.0", url: "https://omoba.ru/downloads/v0.45.0/" + file, sha256: digit.repeat(64),
  size_bytes: String(bytes), published_at: "2026-10-24T00:00:00Z", instructions: "Распакуйте архив и запустите игру.", test_status: "Открытая бета",
  region: "ru", channel: "direct", update_url: "https://omoba.ru/download?platform=" + platform,
  mirror_url: "https://ekza.mypinata.cloud/ipfs/bafybeigdyrzt/" + file,
});
const RELEASES = [
  entry("linux", "x86_64", "omoba-0.45.0-ru-linux-x64.tar.gz", 327577600, "1"),
  entry("windows", "x86_64", "Omoba-0.45.0-ru-windows-x64.zip", 300000000, "2"),
  entry("android", "universal", "Omoba-0.45.0-ru-android-universal.apk", 150000000, "3"),
  // Never offered on a page: a store channel and an iOS build.
  { ...entry("android", "universal", "store.apk", 1), channel: "rustore" },
  entry("ios", "arm64", "Omoba-0.45.0-ru-ios.ipa", 1),
];
let releasesUp = true;
const api = createServer(async (req, res) => {
  for await (const _ of req);
  const path = new URL(req.url, "http://127.0.0.1").pathname;
  const send = (status, value) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(value)); };
  if (req.method === "GET" && path === "/v1/me") return req.headers.authorization === "Bearer " + SESSION ? send(200, account) : send(401, { code: "unauthorized" });
  if (req.method === "GET" && path === "/v1/releases") return releasesUp ? send(200, { releases: RELEASES }) : send(503, { code: "unavailable" });
  if (req.method === "GET" && path === "/v1/me/matches") return send(200, { matches: [], next_cursor: null, data_as_of: new Date().toISOString() });
  send(404, { code: "not_found" });
});
await new Promise((resolve) => api.listen(0, "127.0.0.1", resolve));
const apiOrigin = "http://127.0.0.1:" + api.address().port;
const clean = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("OMOBA_") && !key.startsWith("VERCEL")));

async function run(name, env, body) {
  const port = 41100 + Math.floor(Math.random() * 300), origin = "http://127.0.0.1:" + port;
  const server = spawn(process.execPath, ["scripts/start.mjs"], {
    env: { ...clean, OMOBA_ALLOW_INSECURE_LOCAL: "1", OMOBA_PORTAL_ORIGIN: origin, OMOBA_ACCOUNT_API_URL: apiOrigin, OMOBA_ACCOUNT_MODE: "enabled", ...env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"], detached: true,
  });
  let log = "";
  server.stdout.on("data", (chunk) => (log += chunk));
  server.stderr.on("data", (chunk) => (log += chunk));
  try {
    let up = false;
    for (let attempt = 0; attempt < 80 && !up; attempt++) {
      if (server.exitCode !== null) break;
      try { up = (await fetch(origin + "/login", { signal: AbortSignal.timeout(4000) })).status > 0; } catch { await new Promise((resolve) => setTimeout(resolve, 250)); }
    }
    assert.ok(up, "the portal never answered");
    await body({ origin });
    console.log("ok -", name);
  } catch (error) {
    console.error("not ok -", name, "\n" + log);
    throw error;
  } finally {
    const exited = new Promise((resolve) => (server.exitCode !== null || server.signalCode !== null ? resolve() : server.once("exit", resolve)));
    try { process.kill(-server.pid, "SIGTERM"); } catch {}
    const timer = setTimeout(() => { try { process.kill(-server.pid, "SIGKILL"); } catch {} }, 3000);
    await exited;
    clearTimeout(timer);
  }
}

async function get(origin, path, { session = false, language = "ru-RU" } = {}) {
  return fetch(origin + path, { redirect: "manual", headers: { "Accept-Language": language, ...(session ? { Cookie: "omoba-session=" + SESSION } : {}) } });
}
/** What a visitor reads (no scripts, styles or tags) and every link or resource the page names. */
function surface(html) {
  const text = html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&nbsp;|&#160;/g, " ").replace(/\s+/g, " ");
  const urls = [...html.matchAll(/\s(?:href|src|action|content)="([^"]*)"/g)].map((m) => m[1]);
  return { text, urls };
}
function assertClean(html, page) {
  const { text, urls } = surface(html);
  const word = FORBIDDEN.exec(text);
  assert.equal(word, null, page + " shows " + word?.[0]);
  for (const url of urls) assert.doesNotMatch(url, FORBIDDEN, page + " links " + url);
  assert.ok(!html.includes("/donate"), page + " names /donate");
  assert.ok(!/\bEkza\b/.test(html), page + " names Ekza");
}

if (market === "ru") {
  const RU = { OMOBA_MARKET: "ru", OMOBA_VKID_CLIENT_ID: "51234567" };
  await run("ru: / is the guest home with counted claims, downloads, legal links and the age sign", RU, async ({ origin }) => {
    const response = await get(origin, "/");
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /<html lang="ru"/);
    assert.match(html, /data-guest-home/);
    assert.ok(html.includes("<title>OMOBA · Бесплатная MOBA 5 на 5</title>"), "landing title");
    assert.match(html, /<meta name="robots" content="index, follow"/);
    assert.match(html, new RegExp('<link rel="canonical" href="' + origin + '/"'));
    assert.match(html, new RegExp('<link rel="alternate" hrefLang="ru" href="' + origin + '/"', "i"));
    const { text } = surface(html);
    assert.ok(text.includes("Пять на пять на Изумрудной арене."), "map claim");
    assert.ok(text.includes(CLASSES + " классов героев."), "class claim counted from the catalog (" + CLASSES + ")");
    for (const mode of ["Рейтинговый", "Обычный PvP", "Против ботов", "Офлайн-тренировка"]) assert.ok(text.includes(mode), mode);
    assert.equal([...html.matchAll(/data-landing-mode/g)].length, 4);
    // Direct downloads only, in platform order, each with its SHA-256, size in МБ and status.
    assert.deepEqual([...html.matchAll(/data-release="(\w+)"/g)].map((m) => m[1]), ["windows", "linux", "android"]);
    for (const release of RELEASES.slice(0, 3)) {
      assert.ok(html.includes('href="' + release.url + '"'), release.url);
      assert.ok(html.includes(release.sha256), release.platform + " SHA-256");
    }
    assert.ok(text.includes("312,4 МБ"), "size in МБ");
    assert.ok(text.includes("Скачать для Windows"), "download button");
    assert.match(html, /data-landing-status="?[^>]*>Открытая бета</);
    assert.ok(!html.includes("ipfs") && !html.includes("store.apk") && !html.includes(".ipa"), "a mirror, store or iOS package is offered");
    assert.match(html, /data-age-rating="?[^>]*>12\+</);
    const footer = /<footer>[\s\S]*?<\/footer>/.exec(html)?.[0] ?? "";
    assert.deepEqual([...footer.matchAll(/data-legal-link="(\w+)"/g)].map((m) => m[1]), ["privacy", "terms", "source"]);
    assert.match(footer, /data-age-rating/);
    assert.match(footer, /<a href="\/">OMOBA<\/a>/);
    assert.ok(!html.includes("https://omoba.io"), "the RU landing links the global website");
    assertClean(html, "/");
  });

  await run("ru: signed in, / goes to /me; other pages keep noindex", RU, async ({ origin }) => {
    const signedIn = await get(origin, "/", { session: true });
    assert.equal(signedIn.status, 307);
    assert.equal(new URL(signedIn.headers.get("location"), origin).pathname, "/me");
    const me = await (await get(origin, "/me", { session: true })).text();
    assert.ok(me.includes("Иван#1234"), "the account overview");
    assert.ok(!me.includes("data-guest-home"));
    for (const path of ["/me", "/login", "/download"]) {
      const html = await (await get(origin, path)).text();
      assert.match(html, /<meta name="robots" content="noindex, nofollow"/, path);
      assert.ok(!html.includes("data-guest-home"), path);
    }
  });

  await run("ru: no donate, wallet, crypto or Ekza content on any RU page", RU, async ({ origin }) => {
    for (const path of ["/", "/download", "/login", "/me", "/workshop", "/privacy", "/terms", "/offer", "/connect?code=ABCD2345", "/settings"]) {
      const response = await get(origin, path);
      if (path === "/offer" && response.status === 404) continue;
      assert.equal(response.status, 200, path);
      assertClean(await response.text(), path);
    }
    const signedIn = await (await get(origin, "/me", { session: true })).text();
    assertClean(signedIn, "/me (signed in)");
    // The workshop is labelled experimental (LR-22), in its page and in the sidebar.
    const workshop = await (await get(origin, "/workshop")).text();
    assert.match(workshop, /data-experimental[^>]*>Эксперимент: мастерская классов — прототип/);
    assert.match(await (await get(origin, "/me")).text(), /href="\/workshop"[\s\S]{0,400}data-experimental/);
  });

  await run("ru: English page, and an unavailable catalog keeps the landing", RU, async ({ origin }) => {
    const english = surface(await (await get(origin, "/", { language: "en-US" })).text()).text;
    assert.ok(english.includes(CLASSES + " hero classes."));
    assert.ok(english.includes("312.4 MB"));
    assert.ok(english.includes("Open beta"));
    releasesUp = false;
    try {
      const html = await (await get(origin, "/")).text();
      assert.match(html, /data-guest-home/);
      assert.ok(html.includes("Список загрузок сейчас недоступен."));
      assert.ok(!html.includes("data-release="));
    } finally {
      releasesUp = true;
    }
  });

  await run("browser: the guest home hydrates and fits a phone", RU, async ({ origin }) => {
    const browser = await chromium.launch({ channel: "chrome", headless: true });
    try {
      const errors = [];
      for (const viewport of [{ width: 1440, height: 1000 }, { width: 360, height: 800 }]) {
        const page = await (await browser.newContext({ locale: "ru-RU", viewport })).newPage();
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
        await page.goto(origin + "/");
        await page.locator("[data-guest-home] [data-release-download]").first().waitFor();
        assert.equal(await page.locator("[data-release-download]").count(), 3);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), viewport.width + " px overflows");
        // The phone navigation leaves the experimental workshop out.
        if (viewport.width < 760) assert.equal(await page.locator('.mobile-nav a[href="/workshop"]').count(), 0);
        await page.locator('[data-guest-home] a[href="#download"]').click();
        await page.waitForURL("**/#download");
      }
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
  });
} else {
  await run("global: / still opens the workshop and the website link is unchanged", {}, async ({ origin }) => {
    const root = await get(origin, "/");
    assert.equal(root.status, 307);
    assert.equal(new URL(root.headers.get("location"), origin).pathname, "/workshop");
    const login = await (await get(origin, "/login", { language: "en-US" })).text();
    assert.ok(!login.includes("data-guest-home"));
    assert.ok(!login.includes("data-age-rating"));
    assert.ok(!login.includes("data-experimental"));
    assert.match(login, /href="https:\/\/omoba\.io"[^>]*>OMOBA website/);
    assert.match(login, /<meta name="robots" content="noindex, nofollow"/);
  });
}
api.close();
console.log("ru landing e2e passed for a " + market + " build");
