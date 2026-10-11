// Self-contained market smoke: the built app against a fake loopback Registry and
// Studio. No hosted service, Account API or credentials are used.
// Run `npm run build` first.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const out = ".agent/tasks/MARKET-20261011";
await mkdir(out, { recursive: true });
const port = Number(process.env.MARKET_TEST_PORT || 3018),
  origin = "http://127.0.0.1:" + port;
const TOKEN = randomBytes(48).toString("base64url");
const DEVICE = randomBytes(32).toString("base64url");
const USER_CODE = "ABCD2345";
const png = await readFile("public/brand/omoba-logo.png");
// A 1×1 placeholder like the Registry's default weapon thumbnail.
const placeholder = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const uuid = (n) => `${n.repeat(8)}-${n.repeat(4)}-4${n.repeat(3)}-8${n.repeat(3)}-${n.repeat(12)}`;
const sha = (n) => n.repeat(64);
const IDS = { set: uuid("a"), hammer: uuid("b"), avatar: uuid("c") };

const state = {
  outage: false, approved: false, consumed: false, revoked: false, scopeError: false,
  owned: new Map(), requests: [], unexpected: [], deviceStarts: [],
};
let registryOrigin = "", studioOrigin = "";
function catalogueItem(key, kind, name, extra = {}) {
  const profile = kind === "avatar" ? "humanoid-glb-v1" : "handheld-glb-v1";
  const digest = sha(key === "set" ? "1" : key === "hammer" ? "2" : "3");
  return {
    id: `ekza:${kind}:${IDS[key] || uuid("d")}`, assetKind: kind, name, description: "Fake Registry item for the market smoke.",
    thumbnailUrl: `${registryOrigin}/v1/studio/assets/${sha("9")}/rendition-thumbnail`,
    license: { text: "CC-BY-4.0", attribution: name + " by a test artist (CC-BY-4.0)" },
    creator: { name: "jinx-artist" }, origin: { kind: "studio", revisionId: uuid("e") }, access: "free",
    renditions: [{ platform: "desktop", profile, profileVersion: 1, format: "glb", mediaType: "model/gltf-binary",
      sha256: digest, sizeBytes: 26180, downloadUrl: `${registryOrigin}/v1/studio/assets/${digest}/rendition` }],
    projectSupport: [{ projectId: "omoba", platform: "desktop", profile, status: "approved", requirementId: null }],
    ...extra,
  };
}
function catalogue() {
  const set = catalogueItem("set", "weapon", "Candy Neon Wildspark set", {
    thumbnailUrl: `${registryOrigin}/v1/studio/assets/${sha("8")}/rendition-thumbnail`,
    projectSupport: [{ projectId: "omoba", platform: "desktop", profile: "handheld-glb-v1", status: "approved", requirementId: "wildspark.handheld.set" }],
  });
  const hammer = catalogueItem("hammer", "weapon", "Forge Hammer test");
  const avatar = catalogueItem("avatar", "avatar", "Spark Wizard", { thumbnailUrl: null, license: { text: "CC0", attribution: "" } });
  const hostile = [
    { ...catalogueItem("x", "weapon", "Hostile paid template"), access: "owned" },
    { ...catalogueItem("x", "weapon", "Hostile pending weapon"), id: `ekza:weapon:${uuid("f")}`,
      projectSupport: [{ projectId: "omoba", platform: "desktop", profile: "handheld-glb-v1", status: "pending" }] },
    { ...catalogueItem("x", "weapon", "Hostile bad id"), id: "ekza:weapon:../../me" },
  ];
  return { schema: "ekza.asset.catalog.v2", count: 6, items: [hammer, ...hostile, avatar, set] };
}
function send(res, status, value, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers });
  res.end(value === undefined ? "" : JSON.stringify(value));
}
async function body(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : undefined;
}
const registry = createServer(async (req, res) => {
  const url = new URL(req.url, registryOrigin);
  state.requests.push({ method: req.method, path: url.pathname + url.search, authorization: req.headers.authorization || null, cookie: req.headers.cookie || null });
  const authorized = req.headers.authorization === "Bearer " + TOKEN && !state.revoked;
  if (req.method === "GET" && url.pathname === "/v2/assets" && url.search === "?project=omoba") {
    if (state.outage) return send(res, 503, { error: { code: "catalogue_unavailable", message: "Retry later." } }, { "Retry-After": "10" });
    return send(res, 200, catalogue());
  }
  const thumbnail = /^\/v1\/studio\/assets\/([0-9a-f]{64})\/rendition-thumbnail$/.exec(url.pathname);
  if (req.method === "GET" && thumbnail) {
    res.writeHead(200, { "Content-Type": "image/png", "Access-Control-Allow-Origin": "*" });
    return res.end(thumbnail[1] === sha("8") ? placeholder : png);
  }
  if (req.method === "POST" && url.pathname === "/v1/account/device") {
    const value = await body(req);
    state.deviceStarts.push(value);
    if (value?.projectId !== "omoba" || value?.scope !== "library-claim") return send(res, 422, { error: { code: "validation_error" } });
    state.approved = false;
    state.consumed = false;
    return send(res, 201, { deviceCode: DEVICE, userCode: USER_CODE, verificationUrl: `${studioOrigin}/studio?view=connect&code=${USER_CODE}`,
      expiresAt: new Date(Date.now() + 600_000).toISOString(), interval: 1 });
  }
  if (req.method === "POST" && url.pathname === "/v1/account/device/poll") {
    const value = await body(req);
    if (value?.deviceCode !== DEVICE || state.consumed) return send(res, 410, { error: { code: "link_expired" } });
    if (!state.approved) return send(res, 200, { status: "pending" });
    state.consumed = true;
    state.revoked = false;
    return send(res, 200, { status: "approved", scope: "library-claim", accessToken: TOKEN, projectId: "omoba",
      expiresAt: new Date(Date.now() + 90 * 86400_000).toISOString(), account: { username: "jinx-player" } });
  }
  if (req.method === "GET" && url.pathname === "/v1/account/library") {
    if (!authorized) return send(res, 401, { error: { code: "link_invalid", message: "Connect your Ekza account again." } });
    const items = catalogue().items.filter((i) => state.owned.has(i.id.split(":")[2]));
    return send(res, 200, { schema: "ekza.account.library.v1", projectId: "omoba", account: { username: "jinx-player" },
      expiresAt: new Date(Date.now() + 86400_000).toISOString(), items: items.filter((i) => i.assetKind === "avatar"),
      assets: items.map((i) => ({ ...i, library: { reason: state.owned.get(i.id.split(":")[2]) } })) });
  }
  const claim = /^\/v1\/account\/library\/([0-9a-f-]{36})$/.exec(url.pathname);
  if (claim && (req.method === "POST" || req.method === "DELETE")) {
    if (!authorized) return send(res, 401, { error: { code: "link_invalid" } });
    if (state.scopeError) return send(res, 403, { error: { code: "link_scope", message: "internal scope detail" } });
    const item = catalogue().items.find((i) => i.id === "ekza:weapon:" + claim[1]);
    if (req.method === "DELETE") {
      if (state.owned.get(claim[1]) === "claimed") state.owned.delete(claim[1]);
      res.writeHead(204);
      return res.end();
    }
    // The avatar was withdrawn after the page was rendered.
    if (!item) return send(res, 404, { error: { code: "asset_not_available" } });
    const already = state.owned.has(claim[1]);
    if (!already) state.owned.set(claim[1], "claimed");
    return send(res, 200, { status: already ? "owned" : "claimed", asset: item });
  }
  state.unexpected.push(req.method + " " + url.pathname);
  send(res, 404, { detail: "Not Found" });
});
const studio = createServer(async (req, res) => {
  const url = new URL(req.url, studioOrigin);
  if (req.method === "GET" && url.pathname === "/studio" && url.searchParams.get("view") === "connect") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(`<!doctype html><title>Fake Ekza Studio</title><h1>Connect OMOBA</h1><p id="code">${url.searchParams.get("code")}</p>
      <button onclick="fetch('/approve',{method:'POST'}).then(()=>document.body.append('Approved'))">Approve</button>`);
  }
  if (req.method === "POST" && url.pathname === "/approve") {
    state.approved = true;
    return send(res, 200, { ok: true });
  }
  send(res, 404, {});
});
let accountCalls = 0;
const trap = createServer((_req, res) => {
  accountCalls++;
  res.writeHead(500);
  res.end("The market must not use the Account API");
});
for (const server of [registry, studio, trap]) await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
registryOrigin = "http://127.0.0.1:" + registry.address().port;
studioOrigin = "http://localhost:" + studio.address().port;
const server = spawn(process.execPath, ["scripts/start.mjs"], {
  env: {
    ...process.env,
    PORT: String(port),
    OMOBA_PORTAL_ORIGIN: origin,
    OMOBA_ALLOW_INSECURE_LOCAL: "1",
    OMOBA_ACCOUNT_MODE: "disabled",
    OMOBA_ACCOUNT_API_URL: "http://127.0.0.1:" + trap.address().port,
    OMOBA_REGISTRY_URL: registryOrigin,
    OMOBA_STUDIO_URL: studioOrigin,
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "";
server.stdout.on("data", (chunk) => (serverLog += chunk));
server.stderr.on("data", (chunk) => (serverLog += chunk));
const checks = [];
const check = (name) => checks.push(name);
let browser;
try {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (server.exitCode !== null) throw new Error("Market server exited: " + serverLog);
    try {
      if ((await fetch(origin + "/market")).ok) break;
    } catch {}
    if (attempt === 79) throw new Error("Market server did not start: " + serverLog);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  // BFF rules, before any browser state exists.
  const csrfResponse = await fetch(origin + "/api/ekza/csrf");
  assert.equal(csrfResponse.status, 200);
  const csrfCookie = csrfResponse.headers.get("set-cookie") || "";
  assert.match(csrfCookie, /^omoba-ekza-csrf=[0-9a-f]{64};/);
  assert.match(csrfCookie, /HttpOnly/i);
  assert.match(csrfCookie, /SameSite=lax/i);
  const csrf = (await csrfResponse.json()).token;
  const jar = csrfCookie.split(";")[0];
  assert.equal((await fetch(origin + "/api/csrf")).status, 503, "the Account API stays disabled");
  for (const [headers, label] of [
    [{}, "no origin or token"],
    [{ Origin: "https://evil.example", "X-CSRF-Token": csrf, Cookie: jar }, "foreign origin"],
    [{ Origin: origin, Cookie: jar }, "missing token"],
    [{ Origin: origin, "X-CSRF-Token": "b".repeat(64), Cookie: jar }, "wrong token"],
  ]) {
    const response = await fetch(origin + "/api/ekza/device", { method: "POST", headers });
    assert.equal(response.status, 403, label);
    assert.equal((await response.json()).code, "csrf_rejected");
  }
  assert.equal(state.deviceStarts.length, 0, "rejected mutations never reach the Registry");
  for (const [path, method] of [["nope", "GET"], ["library/not-a-uuid", "POST"], ["library/ekza:weapon:" + IDS.set, "POST"], ["session", "POST"], ["library/" + IDS.set, "GET"]])
    assert.equal((await fetch(origin + "/api/ekza/" + path, { method, headers: { Origin: origin, "X-CSRF-Token": csrf, Cookie: jar } })).status, 404, path);
  const anonymous = await fetch(origin + "/api/ekza/library");
  assert.equal(anonymous.status, 401);
  assert.equal((await anonymous.json()).code, "link_expired");
  assert.equal((await fetch(origin + "/api/ekza/library?x=1", { headers: { Cookie: "omoba-ekza-link=" + "z".repeat(64) } })).status, 400);
  check("BFF CSRF, origin, allowlist and query rules");

  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ locale: "en-US", viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage(),
    errors = [],
    bffBodies = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", async (response) => {
    if (new URL(response.url()).pathname.startsWith("/api/ekza/"))
      bffBodies.push({ body: await response.text().catch(() => ""), headers: await response.headersArray() });
  });
  await page.goto(origin + "/market");
  await page.getByRole("heading", { name: /Gear made by players/ }).waitFor();
  assert.equal(await page.getByRole("article").count(), 3);
  for (const hostile of ["Hostile paid template", "Hostile pending weapon", "Hostile bad id"])
    assert.equal(await page.getByText(hostile).count(), 0, hostile);
  const featured = page.locator("#wildspark");
  const set = featured.getByRole("article", { name: "Candy Neon Wildspark set" });
  await set.waitFor();
  await set.getByText("Wildspark set", { exact: true }).waitFor();
  // The 1×1 Registry placeholder falls back to the game-owned default pair.
  await set.locator(".market-preview-pair img").nth(1).waitFor();
  assert.equal(await set.locator(".market-preview-pair img").count(), 2);
  await page.waitForFunction(() => [...document.querySelectorAll(".market-preview-pair img")].every((i) => i.complete && i.naturalWidth > 8));
  const hammer = page.getByRole("article", { name: "Forge Hammer test" });
  assert.equal(await page.locator("#wildspark").getByRole("article", { name: "Forge Hammer test" }).count(), 0);
  await page.waitForFunction(() => {
    const img = document.querySelector('[aria-label="Forge Hammer test"] .creator-preview > img');
    return img && img.complete && img.naturalWidth >= 8;
  });
  const avatar = page.getByRole("article", { name: "Spark Wizard" });
  await avatar.getByText("No preview yet", { exact: true }).waitFor();
  await avatar.getByText("No attribution provided").waitFor();
  await set.getByText("jinx-artist", { exact: true }).waitFor();
  await set.getByText("Candy Neon Wildspark set by a test artist (CC-BY-4.0)").waitFor();
  assert.equal(await set.locator(".market-price").innerText(), "FREE");
  assert.equal(
    await featured.getByRole("link", { name: "Make one in Ekza Studio ↗" }).getAttribute("href"),
    studioOrigin + "/studio?view=new&kind=weapon&project=omoba&requirement=wildspark.handheld.set",
  );
  assert.equal(await featured.getByRole("link", { name: "Read the Wildspark brief" }).getAttribute("href"), "/creators?class=wildspark&skill=wild_switch");
  assert.equal(await page.getByRole("button", { name: "Sign in to get" }).count(), 3);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: out + "/market-guest.png", fullPage: true, animations: "disabled" });
  check("SSR catalogue, Wildspark grouping, placeholder fallback, licence/attribution, hostile items skipped");

  // Sign in with Ekza: device code -> Studio approval -> BFF poll -> HttpOnly cookie.
  await page.getByRole("button", { name: "Sign in with Ekza" }).click();
  await page.getByText(USER_CODE, { exact: true }).waitFor();
  const approve = page.getByRole("link", { name: "Open Ekza Studio ↗" });
  assert.equal(await approve.getAttribute("href"), `${studioOrigin}/studio?view=connect&code=${USER_CODE}`);
  assert.deepEqual(state.deviceStarts.at(-1), { projectId: "omoba", scope: "library-claim" });
  let cookies = await context.cookies(origin);
  assert.equal(cookies.find((c) => c.name === "omoba-ekza-device")?.httpOnly, true);
  assert.equal(cookies.some((c) => c.name === "omoba-ekza-link"), false);
  assert.equal(await page.getByRole("button", { name: "Waiting for Ekza approval…" }).count(), 3);
  const [popup] = await Promise.all([context.waitForEvent("page"), approve.click()]);
  await popup.getByText(USER_CODE).waitFor();
  await popup.getByRole("button", { name: "Approve" }).click();
  await popup.getByText("Approved").waitFor();
  await popup.close();
  await page.getByRole("heading", { name: "Signed in to Ekza" }).waitFor();
  await page.getByText("jinx-player", { exact: true }).waitFor();
  cookies = await context.cookies(origin);
  const link = cookies.find((c) => c.name === "omoba-ekza-link");
  assert.equal(link?.value, TOKEN);
  assert.equal(link.httpOnly, true);
  assert.equal(link.sameSite, "Lax");
  assert.equal(link.path, "/");
  assert.ok(link.expires * 1000 > Date.now() + 80 * 86400_000);
  assert.equal(cookies.some((c) => c.name === "omoba-ekza-device"), false);
  assert.equal((await page.evaluate(() => document.cookie)).includes(TOKEN), false);
  assert.equal(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })).then((v) => v.includes(TOKEN)), false);
  check("device sign-in, HttpOnly SameSite=Lax link cookie, no token in JS storage");

  await set.getByRole("button", { name: "Get free" }).click();
  await set.getByText("✓ Owned").waitFor();
  await set.getByRole("button", { name: "Remove from library" }).waitFor();
  const claimRequest = state.requests.find((r) => r.method === "POST" && r.path === "/v1/account/library/" + IDS.set);
  assert.equal(claimRequest?.authorization, "Bearer " + TOKEN);
  assert.equal(claimRequest.cookie, null, "browser cookies are never forwarded");
  await avatar.getByRole("button", { name: "Get free" }).click();
  await avatar.getByRole("alert").getByText("This item is no longer available for OMOBA.").waitFor();
  await hammer.getByRole("button", { name: "Get free" }).click();
  await hammer.getByText("✓ Owned").waitFor();
  check("Get free -> Owned, withdrawn item message");

  await page.reload();
  await page.getByRole("heading", { name: "Signed in to Ekza" }).waitFor();
  await set.getByText("✓ Owned").waitFor();
  assert.equal((await page.content()).includes(TOKEN), false, "SSR payload never carries the token");
  await page.screenshot({ path: out + "/market-signed-in.png", fullPage: true, animations: "disabled" });
  await set.getByRole("button", { name: "Remove from library" }).click();
  await set.getByRole("button", { name: "Get free" }).waitFor();
  assert.ok(state.requests.some((r) => r.method === "DELETE" && r.path === "/v1/account/library/" + IDS.set && r.authorization === "Bearer " + TOKEN));
  check("SSR owned state after reload, remove claimed item");

  await page.getByLabel("Language").selectOption("ru");
  await page.getByRole("heading", { name: /Снаряжение от игроков/ }).waitFor();
  await hammer.getByText("✓ В библиотеке").waitFor();
  await page.getByLabel("Язык").selectOption("zh");
  await page.getByRole("heading", { name: /玩家打造的装备/ }).waitFor();
  await page.getByLabel("语言").selectOption("en");
  await page.getByRole("heading", { name: /Gear made by players/ }).waitFor();
  check("en/ru/zh copy");

  state.scopeError = true;
  await set.getByRole("button", { name: "Get free" }).click();
  await page.getByText("This Ekza sign-in cannot add items. Sign in again and allow adding free items.").first().waitFor();
  assert.equal(await page.getByText("internal scope detail").count(), 0);
  state.scopeError = false;
  check("scope error state");

  await page.reload();
  await page.getByRole("heading", { name: "Signed in to Ekza" }).waitFor();
  state.revoked = true;
  await set.getByRole("button", { name: "Get free" }).click();
  await page.getByText("Your Ekza sign-in expired. Sign in again.").first().waitFor();
  await page.getByRole("heading", { name: "Sign in again" }).waitFor();
  assert.equal((await context.cookies(origin)).some((c) => c.name === "omoba-ekza-link"), false, "expired link cookie is cleared");
  check("expired link -> sign in again, cookie cleared");

  await page.getByRole("button", { name: "Sign in with Ekza" }).click();
  await page.getByText(USER_CODE, { exact: true }).waitFor();
  state.approved = true;
  await page.getByRole("heading", { name: "Signed in to Ekza" }).waitFor();
  await page.getByRole("button", { name: "Sign out of Ekza" }).click();
  await page.getByRole("heading", { name: "Sign in with Ekza" }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Sign in to get" }).count(), 3);
  cookies = await context.cookies(origin);
  assert.equal(cookies.some((c) => c.name.startsWith("omoba-ekza-")), false, "sign-out clears every Ekza cookie");
  await page.reload();
  await page.getByRole("heading", { name: "Sign in with Ekza" }).waitFor();
  check("sign out clears cookies");

  state.outage = true;
  await page.reload();
  await page.getByRole("heading", { name: "Market unavailable" }).waitFor();
  assert.equal(await page.getByRole("article").count(), 0);
  for (const empty of ["No Wildspark sets yet", "No other approved weapons yet.", "No approved avatars yet."])
    assert.equal(await page.getByText(empty).count(), 0, "an outage is never an empty market");
  await page.screenshot({ path: out + "/market-outage.png", fullPage: false, animations: "disabled" });
  state.outage = false;
  check("Registry outage -> Market unavailable");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.getByRole("heading", { name: /Gear made by players/ }).waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "no horizontal overflow on phones");
  await page.screenshot({ path: out + "/market-phone.png", fullPage: false, animations: "disabled" });
  check("phone layout");

  let tokenCookies = 0;
  for (const { body, headers } of bffBodies) {
    assert.equal(body.includes(TOKEN) || body.includes(DEVICE), false, "BFF response bodies never carry Registry credentials");
    for (const { name, value } of headers) {
      if (!value.includes(TOKEN) && !value.includes(DEVICE)) continue;
      // The only place a credential travels is its own HttpOnly cookie.
      assert.equal(name.toLowerCase(), "set-cookie");
      assert.match(value, /^omoba-ekza-(link|device)=[A-Za-z0-9_-]+; Path=\/; [^\n]*HttpOnly; SameSite=lax$/i);
      tokenCookies++;
    }
  }
  assert.ok(tokenCookies >= 2);
  assert.deepEqual(state.unexpected, []);
  assert.equal(accountCalls, 0);
  assert.deepEqual(errors, []);
  await writeFile(out + "/evidence.json", JSON.stringify({ passed: true, checks, registryRequests: state.requests.length, accountCalls, bffResponses: bffBodies.length }, null, 2) + "\n");
  console.log(`PASS market e2e: ${checks.length} checks, ${state.requests.length} fake Registry requests, Account API calls: 0`);
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  for (const s of [registry, studio, trap]) s.close();
  await writeFile(out + "/server.log", serverLog);
}
