// HTTPS cookie attributes for both BFFs. On an HTTPS portal every cookie is
// `__Host-` prefixed, and a browser ignores a `__Host-` Set-Cookie without Secure:
// a deletion that drops the attributes the cookie was set with silently keeps it.
// The built app runs as https://app.omoba.io behind a Playwright route (no TLS, no
// hosted service) with a fake Registry and a fake Account API.
// Run `npm run build` first.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const out = ".agent/tasks/MARKET-20261011";
await mkdir(out, { recursive: true });
const PORTAL = "https://app.omoba.io";
const port = Number(process.env.HTTPS_COOKIE_TEST_PORT || 3019),
  base = "http://127.0.0.1:" + port;
const TOKEN = randomBytes(48).toString("base64url");
const DEVICE = randomBytes(32).toString("base64url");
const SESSION = randomBytes(32).toString("hex");
const USER_CODE = "ABCD2345";
const ITEM = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const state = { approved: false, revoked: false, scopeError: false, signOuts: 0, poll: [], accountCalls: [] };
let registryOrigin = "", studioOrigin = "";
function send(res, status, value, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers });
  res.end(value === undefined ? "" : JSON.stringify(value));
}
async function drain(req) {
  for await (const _chunk of req);
}
const registry = createServer(async (req, res) => {
  const url = new URL(req.url, registryOrigin);
  await drain(req);
  const authorized = req.headers.authorization === "Bearer " + TOKEN && !state.revoked;
  if (req.method === "GET" && url.pathname === "/v2/assets") {
    const digest = "2".repeat(64);
    return send(res, 200, { schema: "ekza.asset.catalog.v2", count: 1, items: [{
      id: "ekza:weapon:" + ITEM, assetKind: "weapon", name: "Forge Hammer test", description: "", thumbnailUrl: null,
      license: { text: "CC0", attribution: "" }, creator: { name: "jinx-artist" },
      origin: { kind: "studio", revisionId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" }, access: "free",
      renditions: [{ platform: "desktop", profile: "handheld-glb-v1", profileVersion: 1, format: "glb", mediaType: "model/gltf-binary",
        sha256: digest, sizeBytes: 2048, downloadUrl: `${registryOrigin}/v1/studio/assets/${digest}/rendition` }],
      projectSupport: [{ projectId: "omoba", platform: "desktop", profile: "handheld-glb-v1", status: "approved", requirementId: null }],
    }] });
  }
  if (req.method === "POST" && url.pathname === "/v1/account/device")
    return send(res, 201, { deviceCode: DEVICE, userCode: USER_CODE, verificationUrl: `${studioOrigin}/studio?view=connect&code=${USER_CODE}`,
      expiresAt: new Date(Date.now() + 600_000).toISOString(), interval: 1 });
  if (req.method === "POST" && url.pathname === "/v1/account/device/poll") {
    const scripted = state.poll.shift();
    if (scripted) return send(res, scripted.status, scripted.body);
    if (!state.approved) return send(res, 200, { status: "pending" });
    state.approved = false;
    state.revoked = false;
    return send(res, 200, { status: "approved", scope: "library-claim", accessToken: TOKEN, projectId: "omoba",
      expiresAt: new Date(Date.now() + 90 * 86400_000).toISOString(), account: { username: "jinx-player" } });
  }
  if (req.method === "DELETE" && url.pathname === "/v1/account/session") {
    state.signOuts++;
    if (authorized) state.revoked = true;
    res.writeHead(204);
    return res.end();
  }
  if (url.pathname === "/v1/account/library" || url.pathname === "/v1/account/library/" + ITEM) {
    if (!authorized) return send(res, 401, { error: { code: "link_invalid" } });
    if (req.method === "POST" && state.scopeError) return send(res, 403, { error: { code: "link_scope" } });
    if (req.method === "POST") return send(res, 200, { status: "claimed", asset: {} });
    return send(res, 200, { schema: "ekza.account.library.v1", projectId: "omoba", account: { username: "jinx-player" },
      expiresAt: new Date(Date.now() + 86400_000).toISOString(), items: [], assets: [] });
  }
  send(res, 404, { detail: "Not Found" });
});
// Just enough of the Account API for the BFF's own cookie writes.
const account = createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  await drain(req);
  state.accountCalls.push(req.method + " " + url.pathname);
  if (req.method === "POST" && url.pathname === "/v1/auth/logout") return send(res, 200, { status: "logged_out" });
  if (req.method === "POST" && url.pathname === "/v1/auth/pairings/cancel") return send(res, 200, { status: "cancelled" });
  if (req.method === "POST" && url.pathname === "/v1/auth/pairings/complete") return send(res, 200, { session_token: SESSION });
  send(res, 401, { code: "unauthenticated" });
});
for (const server of [registry, account]) await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
registryOrigin = "http://127.0.0.1:" + registry.address().port;
studioOrigin = "http://localhost:" + registry.address().port;
const server = spawn(process.execPath, ["scripts/start.mjs"], {
  env: {
    ...process.env,
    PORT: String(port),
    OMOBA_PORTAL_ORIGIN: PORTAL,
    OMOBA_ALLOW_INSECURE_LOCAL: "1",
    OMOBA_ACCOUNT_MODE: "enabled",
    OMOBA_ACCOUNT_API_URL: "http://127.0.0.1:" + account.address().port,
    OMOBA_REGISTRY_URL: registryOrigin,
    OMOBA_STUDIO_URL: studioOrigin,
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "";
server.stdout.on("data", (chunk) => (serverLog += chunk));
server.stderr.on("data", (chunk) => (serverLog += chunk));

const audited = [], expired = [];
/** Every portal cookie is host-only, Secure, HttpOnly and Lax, including the expiring writes. */
function audit(line) {
  const [pair, ...attributes] = line.split(/;\s*/);
  const name = pair.slice(0, pair.indexOf("=")), value = pair.slice(pair.indexOf("=") + 1);
  const lower = attributes.map((a) => a.toLowerCase());
  assert.ok(name.startsWith("__Host-"), "prefixed on HTTPS: " + line);
  for (const required of ["secure", "httponly", "path=/", "samesite=lax"])
    assert.ok(lower.includes(required), `${required} missing: ${line}`);
  assert.equal(lower.some((a) => a.startsWith("domain=")), false, "host-only: " + line);
  if (value === "") {
    assert.ok(lower.includes("max-age=0"), "expires now: " + line);
    expired.push(name);
  }
  audited.push(name);
}
const jar = new Map();
async function call(path, { method = "GET", csrf, json, cookies = {} } = {}) {
  const headers = { Origin: PORTAL };
  if (csrf) headers["X-CSRF-Token"] = csrf;
  if (json) headers["Content-Type"] = "application/json";
  const cookie = [...jar, ...Object.entries(cookies)].map(([k, v]) => k + "=" + v).join("; ");
  if (cookie) headers.Cookie = cookie;
  const response = await fetch(base + path, { method, headers, body: json ? JSON.stringify(json) : undefined, redirect: "manual" });
  const lines = response.headers.getSetCookie();
  for (const line of lines) {
    audit(line);
    const [pair] = line.split(";");
    const name = pair.slice(0, pair.indexOf("=")), value = pair.slice(pair.indexOf("=") + 1);
    if (value) jar.set(name, value);
    else jar.delete(name);
  }
  return { status: response.status, body: await response.json().catch(() => null), expired: lines.filter((l) => /^[^=]+=;/.test(l)).map((l) => l.split("=")[0]) };
}
const checks = [];
let browser;
try {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (server.exitCode !== null) throw new Error("Portal server exited: " + serverLog);
    try {
      if ((await fetch(base + "/market")).ok) break;
    } catch {}
    if (attempt === 79) throw new Error("Portal server did not start: " + serverLog);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  // Ekza BFF: every place it clears a cookie.
  const ekzaCsrf = (await call("/api/ekza/csrf")).body.token;
  assert.match(ekzaCsrf, /^[0-9a-f]{64}$/);
  const post = (path) => call("/api/ekza/" + path, { method: "POST", csrf: ekzaCsrf });
  assert.equal((await post("device")).status, 200);
  assert.ok(jar.has("__Host-omoba-ekza-device"));
  state.poll.push({ status: 200, body: { status: "weird" } });
  let poll = await post("device/poll");
  assert.equal(poll.body.code, "invalid_service_response");
  assert.deepEqual(poll.expired, ["__Host-omoba-ekza-device"]);
  await post("device");
  state.poll.push({ status: 410, body: { error: { code: "expired_token" } } });
  poll = await post("device/poll");
  assert.equal(poll.body.code, "device_expired");
  assert.deepEqual(poll.expired, ["__Host-omoba-ekza-device"]);
  await post("device");
  state.approved = true;
  poll = await post("device/poll");
  assert.equal(poll.body.status, "connected");
  assert.deepEqual(poll.expired, ["__Host-omoba-ekza-device"]);
  assert.equal(jar.get("__Host-omoba-ekza-link"), TOKEN);
  state.revoked = true;
  let library = await call("/api/ekza/library");
  assert.equal(library.body.code, "link_expired");
  assert.deepEqual(library.expired, ["__Host-omoba-ekza-link"], "a revoked link is cleared");
  library = await call("/api/ekza/library", { cookies: { "__Host-omoba-ekza-link": "not-a-token" } });
  assert.equal(library.status, 401);
  assert.deepEqual(library.expired, ["__Host-omoba-ekza-link"], "a malformed link is cleared");
  await post("device");
  state.approved = true;
  await post("device/poll");
  state.scopeError = true;
  const scoped = await post("library/" + ITEM);
  state.scopeError = false;
  assert.equal(scoped.body.code, "link_scope");
  assert.deepEqual(scoped.expired, ["__Host-omoba-ekza-link"], "a link that cannot add items is cleared");
  await post("device");
  state.approved = true;
  await post("device/poll");
  const signOut = await post("sign-out");
  assert.equal(signOut.body.status, "signed_out");
  assert.equal(signOut.body.revoked, true, "sign-out ended the Registry link first");
  assert.equal(state.signOuts, 1);
  assert.deepEqual(signOut.expired.sort(), ["__Host-omoba-ekza-csrf", "__Host-omoba-ekza-device", "__Host-omoba-ekza-link"]);
  assert.equal([...jar.keys()].some((name) => name.startsWith("__Host-omoba-ekza-")), false);
  check("Ekza BFF: device, link (expired, malformed, wrong scope, sign-out) and CSRF deletions keep Secure; Path=/ on HTTPS");

  // Account BFF: pairing cancel, pairing completion and logout.
  const pair = "a".repeat(64) + "." + "b".repeat(64);
  let accountCsrf = (await call("/api/csrf")).body.token;
  const cancel = await call("/api/auth/pairings/cancel", { method: "POST", csrf: accountCsrf, json: {}, cookies: { "__Host-omoba-pair": pair } });
  assert.equal(cancel.status, 200);
  assert.deepEqual(cancel.expired, ["__Host-omoba-pair"]);
  const complete = await call("/api/auth/pairings/complete", { method: "POST", csrf: accountCsrf, json: {}, cookies: { "__Host-omoba-pair": pair } });
  assert.equal(complete.body.status, "connected");
  assert.deepEqual(complete.expired.sort(), ["__Host-omoba-csrf", "__Host-omoba-pair"]);
  assert.equal(jar.get("__Host-omoba-session"), SESSION);
  accountCsrf = (await call("/api/csrf")).body.token;
  const logout = await call("/api/auth/logout", { method: "POST", csrf: accountCsrf, json: {} });
  assert.equal(logout.status, 200);
  assert.deepEqual(logout.expired.sort(), ["__Host-omoba-csrf", "__Host-omoba-pair", "__Host-omoba-session"]);
  assert.equal(jar.has("__Host-omoba-session"), false);
  check("Account BFF: pairing and logout deletions keep Secure; Path=/ on HTTPS");

  // Real Chrome: the portal origin is HTTPS, so the browser applies the __Host- rules.
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ locale: "en-US" });
  await context.route(PORTAL + "/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = await request.allHeaders();
    for (const name of ["host", "connection", "content-length", "accept-encoding"]) delete headers[name];
    const response = await fetch(base + url.pathname + url.search, {
      method: request.method(), headers, body: request.postDataBuffer() ?? undefined, redirect: "manual",
    });
    const reply = {};
    response.headers.forEach((value, name) => {
      if (!["set-cookie", "content-encoding", "content-length", "transfer-encoding"].includes(name)) reply[name] = value;
    });
    const lines = response.headers.getSetCookie();
    lines.forEach(audit);
    if (lines.length) reply["set-cookie"] = lines.join("\n");
    await route.fulfill({ status: response.status, headers: reply, body: Buffer.from(await response.arrayBuffer()) });
  });
  const page = await context.newPage();
  const ekzaCookies = async () => (await context.cookies(PORTAL)).filter((c) => c.name.startsWith("__Host-omoba-ekza-"));
  const signIn = async () => {
    await page.getByRole("button", { name: "Sign in with Ekza" }).click();
    await page.getByText(USER_CODE, { exact: true }).waitFor();
    state.approved = true;
    await page.getByRole("heading", { name: "Signed in to Ekza" }).waitFor();
    const link = (await ekzaCookies()).find((c) => c.name === "__Host-omoba-ekza-link");
    assert.equal(link?.secure, true);
    assert.equal(link.httpOnly, true);
  };
  await page.goto(PORTAL + "/market");
  await page.getByRole("heading", { name: /Gear made by players/ }).waitFor();
  await signIn();
  await page.getByRole("button", { name: "Sign out of Ekza" }).click();
  await page.getByRole("heading", { name: "Sign in with Ekza" }).waitFor();
  assert.deepEqual((await ekzaCookies()).map((c) => c.name), [], "Chrome removes every Ekza cookie on sign-out");
  await page.reload();
  await page.getByRole("heading", { name: "Sign in with Ekza" }).waitFor();
  assert.equal(await page.getByText("jinx-player").count(), 0, "a reload after sign-out stays signed out");
  check("Chrome: sign-out on HTTPS removes the link, and a reload stays signed out");

  await signIn();
  state.revoked = true;
  await page.getByRole("article", { name: "Forge Hammer test" }).getByRole("button", { name: "Get free" }).click();
  await page.getByRole("heading", { name: "Sign in again" }).waitFor();
  assert.equal((await ekzaCookies()).some((c) => c.name === "__Host-omoba-ekza-link"), false, "Chrome removes a revoked link");
  check("Chrome: a revoked link is removed on HTTPS");

  assert.ok(expired.length >= 20, "deletions audited: " + expired.length);
  await writeFile(out + "/https-cookies.json", JSON.stringify({ passed: true, checks, cookiesAudited: audited.length, deletionsAudited: expired.length, accountCalls: state.accountCalls }, null, 2) + "\n");
  console.log(`PASS https cookies e2e: ${checks.length} checks, ${audited.length} Set-Cookie headers audited (${expired.length} deletions)`);
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  for (const s of [registry, account]) s.close();
  await writeFile(out + "/https-cookies-server.log", serverLog);
}
function check(name) {
  checks.push(name);
}
