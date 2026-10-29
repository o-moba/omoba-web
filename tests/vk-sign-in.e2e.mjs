// Sign in with VK ID end to end: the real RU portal build, the real Account API
// built for the RU market (OMOBA_MARKET=ru), a disposable PostgreSQL, Chrome, and
// a synthetic game that signs its native requests with Ed25519 keys. VK ID itself
// is never contacted: the browser's navigation to id.vk.ru is answered with VK's
// redirect back to the callback, and the Account API exchanges the code against a
// loopback stand-in (OMOBA_VKID_LOCAL_FIXTURE_ORIGIN).
//
//   OMOBA_MARKET=ru OMOBA_VKID_CLIENT_ID=51234567 npm run build
//   OMOBA_ACCOUNT_API_BIN=…/omoba-account-api \           # built with OMOBA_MARKET=ru
//   OMOBA_E2E_DATABASE_URL=postgres://owner@127.0.0.1:<task-port>/omoba_test \
//   OMOBA_PSQL=/Applications/Postgres.app/Contents/Versions/18/bin/psql \
//   npm run test:vk-sign-in
//
// The task-owned disposable loopback database must be omoba_test; the script migrates it.
// Ports 5432/55581 are refused. OMOBA_E2E_PORT and OMOBA_E2E_API_PORT override local ports.
// Optional OMOBA_NATIVE_JOURNEY_FIXTURE exports synthetic keys to a private .agent file.
// Screenshots go to .agent/vk-sign-in/.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash, createPrivateKey, createPublicKey, randomBytes, sign } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { chromium } from "@playwright/test";

const required = JSON.parse(await readFile(new URL("../.next/required-server-files.json", import.meta.url), "utf8"));
const built = required.config?.env?.OMOBA_BUILT_MARKET;
const buildFeatures = /^ru \(ekza off, supporter (on|off), vk_sign_in on\)$/.exec(built || "");
assert.ok(buildFeatures, "run after a RU build with VK ID enabled (got " + built + ")");
const binary = process.env.OMOBA_ACCOUNT_API_BIN, database = process.env.OMOBA_E2E_DATABASE_URL;
assert.ok(binary && database, "set OMOBA_ACCOUNT_API_BIN and OMOBA_E2E_DATABASE_URL");
const db = new URL(database);
assert.ok(db.hostname === "127.0.0.1" && db.port && !["5432", "55581"].includes(db.port) && db.pathname === "/omoba_test", "only the explicit task-owned loopback database omoba_test, never ports 5432/55581");
if (process.env.OMOBA_E2E_DATABASE_PORT) assert.equal(db.port, process.env.OMOBA_E2E_DATABASE_PORT);
const psql = process.env.OMOBA_PSQL || "psql";
const portalPort = Number(process.env.OMOBA_E2E_PORT || "3010");
assert.ok(Number.isInteger(portalPort) && portalPort > 1024 && portalPort < 65536);
const CLIENT_ID = process.env.OMOBA_E2E_VK_APP_ID || "51234567", origin = "http://127.0.0.1:" + portalPort, out = ".agent/vk-sign-in";
await mkdir(out, { recursive: true });

// --- VK ID stand-in: code `user-<id>` is VK user <id>, named Иван Петров.
const vkCalls = [];
const grants = new Map(), children = [];
let browser;
let providerDown = false;
const vk = createServer(async (req, res) => {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const form = Object.fromEntries(new URLSearchParams(raw));
  vkCalls.push({ path: req.url, form });
  const send = (status, value) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(value)); };
  if (providerDown) return send(503, { error: "temporarily_unavailable" });
  if (req.url === "/oauth2/auth") {
    const grant = grants.get(form.code);
    const ok = form.grant_type === "authorization_code" && form.client_id === CLIENT_ID && form.device_id && form.state
      && form.code_verifier?.length >= 43 && [origin, origin + "/api/auth/vk/callback"].includes(form.redirect_uri) && !("client_secret" in form)
      && grant && !grant.used && grant.state === form.state && grant.device === form.device_id
      && grant.challenge === createHash("sha256").update(form.code_verifier).digest("base64url");
    const id = ok ? grant.subject : null;
    if (ok) grant.used = true;
    return ok && id ? send(200, { access_token: "token-" + id, expires_in: 3600, state: form.state }) : send(400, { error: "invalid_grant" });
  }
  if (req.url === "/oauth2/user_info") {
    const id = form.access_token?.startsWith("token-") ? form.access_token.slice(6) : null;
    return id && form.client_id === CLIENT_ID ? send(200, { user: { user_id: id, first_name: "Иван", last_name: "Петров" } }) : send(401, { error: "invalid_token" });
  }
  send(404, {});
});
try {
await new Promise((resolve, reject) => { vk.once("error", reject); vk.listen(0, "127.0.0.1", resolve); });
const vkOrigin = "http://127.0.0.1:" + vk.address().port;

// --- Account API (RU build) and the RU portal.
const hex32 = () => randomBytes(32).toString("hex");
const clean = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("OMOBA_") && !key.startsWith("VERCEL")));
execFileSync(binary, ["migrate"], { env: { ...clean, OMOBA_DATABASE_URL: database }, stdio: "inherit" });
const apiPort = Number(process.env.OMOBA_E2E_API_PORT || "40550"), apiOrigin = "http://127.0.0.1:" + apiPort;
assert.ok(Number.isInteger(apiPort) && apiPort > 1024 && apiPort < 65536 && apiPort !== portalPort);
function start(command, args, env, name) {
  const child = spawn(command, args, { env: { ...clean, ...env }, stdio: ["ignore", "pipe", "pipe"], detached: true });
  child.log = "";
  child.stdout.on("data", (c) => (child.log += c));
  child.stderr.on("data", (c) => (child.log += c));
  child.name = name;
  child.on("error", error => { child.startupError = error; });
  children.push(child);
  return child;
}
const api = start(binary, [], {
  OMOBA_DATABASE_URL: database, OMOBA_PORTAL_ORIGIN: origin, OMOBA_ALLOW_INSECURE_LOCAL: "1",
  OMOBA_PORTAL_SECRET: hex32(), OMOBA_VKID_CLIENT_ID: CLIENT_ID, OMOBA_SOCIAL_SECRET: hex32(),
  OMOBA_VKID_LOCAL_FIXTURE_ORIGIN: vkOrigin, OMOBA_ACCOUNT_BIND: "127.0.0.1:" + apiPort,
}, "account-api");
const portal = start(process.execPath, ["scripts/start.mjs"], {
  OMOBA_MARKET: "ru", OMOBA_FEATURE_SUPPORTER: buildFeatures[1], OMOBA_VKID_CLIENT_ID: CLIENT_ID, OMOBA_ACCOUNT_MODE: "enabled", OMOBA_ALLOW_INSECURE_LOCAL: "1",
  OMOBA_PORTAL_ORIGIN: origin, OMOBA_ACCOUNT_API_URL: apiOrigin, PORT: String(portalPort),
}, "portal");
async function ready(url, child) {
  for (let i = 0; i < 120; i++) {
    if (child.startupError) throw child.startupError;
    if (child.exitCode !== null) throw new Error(child.name + " exited:\n" + child.log);
    try { if ((await fetch(url, { signal: AbortSignal.timeout(2000) })).status < 500) return; } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(child.name + " did not start:\n" + child.log);
}

// --- A synthetic game: Ed25519 keys and the native requests the client sends.
const keyOf = (seed) => createPrivateKey({ key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), seed]), format: "der", type: "pkcs8" });
const publicOf = (key) => createPublicKey(key).export({ format: "der", type: "spki" }).subarray(-32).toString("hex");
const signed = (key, tuple) => sign(null, Buffer.from(JSON.stringify(tuple)), key).toString("hex");
async function native(path, body) {
  const response = await fetch(apiOrigin + "/v1/" + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
function enrollmentFor(key) {
  return { enrollment_id: hex32(), public_key: publicOf(key), origin, label: "Desktop", expires_at: String(Math.floor(Date.now() / 1000) + 290) };
}
const enrollmentTuple = (e, action, target = null) =>
  ["omoba.device.enroll.v1", e.origin, e.enrollment_id, e.public_key, e.label, e.expires_at, action, target, null];
const device = (key, e, action, target = null) =>
  native("auth/devices/" + action, { enrollment: e, action, target_profile: target, recovery_code: null, signature: signed(key, enrollmentTuple(e, action, target)) });
function register(nickname) {
  const seed = randomBytes(32), key = keyOf(seed), profile = hex32();
  execFileSync(psql, [database, "-v", "ON_ERROR_STOP=1", "-qc",
    `INSERT INTO career_profiles(profile_id,nickname) VALUES('${profile}','${nickname}'); INSERT INTO career_keys(public_key,profile_id) VALUES('${publicOf(key)}','${profile}');`]);
  return { key, profile, seed };
}
const sql = (query) => execFileSync(psql, [database, "-qtAc", query]).toString().trim();


// The root gameplay proof consumes this private, task-local fixture. It contains
// only newly generated synthetic keys; it must never enter committed evidence.
const nativeFixtures = [], profiles = [], checks = [], browserAccounts = [];
let vkUser = "", behavior = "success", callbackUrl = "";
  await ready(apiOrigin + "/health/ready", api);
  await ready(origin + "/login", portal);
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ locale: "ru-RU", viewport: { width: 852, height: 393 } });
  // No vendor analytics, frame or authorization request leaves this test.
  await context.route(url => url.origin !== origin, route => {
    const url = new URL(route.request().url());
    assert.ok(!['/oauth2/auth', '/oauth2/user_info'].includes(url.pathname), 'the browser must never exchange provider tokens');
    if (route.request().resourceType() === 'script') return route.fulfill({ contentType: 'text/javascript', body: '' });
    if (url.pathname === '/domain.txt') return route.fulfill({ contentType: 'text/plain', body: 'vk.ru' });
    // Stub SDK telemetry as a successful no-op, without making a real request.
    return route.fulfill({ contentType: 'application/json', body: '{"response":1}' });
  });
  let widgetFrameError = false;
  await context.route(url => url.origin === 'https://id.vk.ru' && url.pathname === '/button_one_tap_auth', route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><script>parent.postMessage({type:"vk-sak-sdk",handler:' + JSON.stringify(widgetFrameError ? 'error' : 'onetap: not authorized') + ',params:{}},' + JSON.stringify(origin) + ')</script>',
  }));
  const widgetAuthorize = [];
  let widgetPayload;
  await context.route(url => url.origin === 'https://id.vk.ru' && url.pathname === '/authorize', async route => {
    const params = Object.fromEntries(new URL(route.request().url()).searchParams);
    assert.equal(params.client_id, CLIENT_ID);
    assert.equal(params.redirect_uri, origin);
    assert.equal(params.code_challenge_method, 's256');
    assert.equal(params.scope, 'vkid.personal_info');
    assert.ok(!params.code_verifier);
    widgetAuthorize.push(params);
    const code = 'widget-' + hex32();
    grants.set(code, { subject: vkUser, state: params.state, challenge: params.code_challenge, device: 'vk-device-1', used: false });
    const message = { action: 'oauth2_authorize_response' + params.state,
      payload: { type: 'code_v2', code, state: params.state, device_id: 'vk-device-1', expires_in: 60 } };
    widgetPayload = { code, state: params.state, device_id: 'vk-device-1' };
    await route.fulfill({ contentType: 'text/html', body: '<!doctype html><script>setTimeout(()=>opener.postMessage(' + JSON.stringify(message) + ',' + JSON.stringify(origin) + '),50)</script>' });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  const authorize = [];
  await context.route(url => url.pathname === "/api/auth/vk/start", async route => {
    const response = await route.fetch({ maxRedirects: 0 });
    assert.equal(response.status(), 302);
    const url = new URL(response.headers().location), params = Object.fromEntries(url.searchParams);
    assert.equal(url.origin + url.pathname, "https://id.vk.ru/authorize");
    assert.equal(params.client_id, CLIENT_ID);
    assert.equal(params.code_challenge_method, "s256");
    assert.equal(params.prompt, params.provider === "vkid" ? undefined : "login");
    assert.equal(params.scope, "vkid.personal_info");
    assert.equal(params.redirect_uri, origin + "/api/auth/vk/callback");
    authorize.push(params);
    const code = "fixture-" + hex32();
    grants.set(code, { subject: vkUser, state: params.state, challenge: params.code_challenge, device: "vk-device-1", used: false });
    const back = new URL(params.redirect_uri);
    back.search = behavior === "cancelled"
      ? new URLSearchParams({ state: params.state, error: "access_denied" })
      : new URLSearchParams({ code, state: behavior === "foreign" ? "0".repeat(64) : params.state, device_id: "vk-device-1", type: "code_v2" });
    callbackUrl = back.toString();
    const headers = Object.fromEntries(response.headersArray().filter(h => !["location", "content-length", "content-type", "set-cookie"].includes(h.name.toLowerCase())).map(h => [h.name, h.value]));
    const cookies = response.headersArray().filter(h => h.name.toLowerCase() === "set-cookie").map(h => h.value);
    await route.fulfill({ status: 200, contentType: "text/html", headers: { ...headers, "set-cookie": cookies.join("\n") },
      body: "<!doctype html><script>location.replace(" + JSON.stringify(back.toString()) + ")</script>" });
  });
  async function signIn(method, target = "/me") {
    const fallback = page.locator('[data-vk-fallback]').first();
    if (await fallback.count() && await fallback.getAttribute('open') === null) await fallback.locator('summary').click();
    await Promise.all([
      page.waitForURL(url => url.pathname + url.search === target),
      page.locator('[data-vk-method="' + method + '"]').first().click(),
    ]);
    assert.equal(authorize.at(-1).provider, method);
  }
  const me = () => page.evaluate(async () => { const r = await fetch("/api/me"); return { status: r.status, body: await r.json() }; });
  async function enrollment(key) {
    const e = enrollmentFor(key), created = await device(key, e, "create");
    assert.equal(created.status, 200, JSON.stringify(created.body));
    return { e, code: created.body.code };
  }
  const progressNote = /^Прогресс следует за аккаунтом, привязанным к VK\. .*тем же VK ID.*Коды восстановления/;
  for (const path of ["/me", "/login"]) {
    await page.goto(origin + path);
    assert.match(await page.locator("[data-progress-follows-vk]").innerText(), progressNote, path);
  }
  checks.push("guest home and sign-in explain progress recovery through the linked VK account");
  // Real pinned SDK, real BFF/API/PostgreSQL, only the provider is a stand-in.
  const widgetProfiles = [];
  // Actual POST endpoints reject CSRF, foreign claims and oversized bodies.
  await page.goto(origin + '/login');
  await page.locator('[data-vk-one-tap="ready"]').waitFor();
  const widgetCsrf = (await (await page.request.get(origin + '/api/csrf')).json()).token;
  const widgetHeaders = { Origin: origin, 'X-CSRF-Token': widgetCsrf };
  const denied = await page.request.post(origin + '/api/auth/vk/one-tap/prepare', { headers: { Origin: 'https://evil.example' }, data: { returnTo: '/me' } });
  assert.equal(denied.status(), 403);
  assert.equal((await page.request.get(origin + '/api/auth/vk/one-tap/prepare')).status(), 405);
  assert.equal((await page.request.post(origin + '/api/auth/vk/one-tap/complete', { headers: widgetHeaders, data: { access_token: 'forged', user_id: '1' } })).status(), 400);
  assert.equal((await page.request.post(origin + '/api/auth/vk/one-tap/complete', { headers: widgetHeaders, data: { code: 'x'.repeat(9000) } })).status(), 413);
  const providerCallsBeforeForeign = vkCalls.length;
  const foreignWidget = await page.request.post(origin + '/api/auth/vk/one-tap/complete', { headers: widgetHeaders,
    data: { code: 'forged', device_id: 'forged-device', state: '0'.repeat(64) } });
  assert.match((await foreignWidget.json()).location, /^\/login\?signin=failed/);
  assert.equal(vkCalls.length, providerCallsBeforeForeign);
  checks.push('OneTap POST: CSRF, unknown token/user claims, oversized body and foreign state rejected');
  for (const method of ['vkid', 'ok_ru', 'mail_ru']) {
    vkUser = String(100000000 + Math.floor(Math.random() * 700000000));
    await page.goto(origin + '/login');
    await page.locator('[data-vk-one-tap="ready"]').waitFor();
    const button = method === 'vkid' ? page.locator('[data-vk-one-tap] button[class*="VkIdWebSdk__button_"]').first()
      : page.locator('[data-vk-one-tap] [data-oauth="' + method + '"]');
    await button.waitFor();
    if (method === 'vkid') {
      await page.locator('[data-vk-one-tap] [data-state="not_loaded"]').first().waitFor();
      await page.screenshot({ path: out + '/one-tap-login.png', fullPage: true });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    }
    await Promise.all([page.waitForURL(origin + '/me'), button.click()]);
    const account = await me();
    assert.equal(account.status, 200);
    assert.equal(account.body.profile.rating, 1000);
    assert.equal(account.body.profile.matches_played, 0);
    assert.ok((await context.cookies()).find(c => c.name === 'omoba-session')?.httpOnly);
    assert.equal(widgetAuthorize.at(-1).provider || 'vkid', method);
    widgetProfiles.push(account.body.profile.profile_id);
    const callsBeforeWidgetReplay = vkCalls.length;
    const replayCsrf = (await (await page.request.get(origin + '/api/csrf')).json()).token;
    const replay = await page.request.post(origin + '/api/auth/vk/one-tap/complete', {
      headers: { Origin: origin, 'X-CSRF-Token': replayCsrf }, data: widgetPayload });
    assert.match((await replay.json()).location, /^\/login\?signin=failed/);
    assert.equal(vkCalls.length, callsBeforeWidgetReplay);
    assert.equal((await me()).body.profile.profile_id, account.body.profile.profile_id);
    checks.push('real OneTap ' + method + ': server PKCE exchange, default account and HttpOnly session');
  }
  assert.equal(new Set(widgetProfiles).size, 3);
  // A blocked/unavailable fast-profile frame must retain the SDK's ordinary
  // root-callback buttons, independently of the legacy redirect fallback.
  widgetFrameError = true;
  vkUser = String(100000000 + Math.floor(Math.random() * 700000000));
  await page.goto(origin + '/login');
  await page.locator('[data-vk-one-tap="failed"]').waitFor();
  const sdkFallbackButton = page.locator('[data-vk-one-tap] button[class*="VkIdWebSdk__button_"]').first();
  await sdkFallbackButton.waitFor();
  await Promise.all([page.waitForURL(origin + '/me'), sdkFallbackButton.click()]);
  assert.equal((await me()).status, 200);
  widgetFrameError = false;
  checks.push('OneTap frame failure retains working SDK authorization with the registered root callback');
  const profilesBefore = Number(sql("SELECT count(*) FROM career_profiles"));
  // Independent subjects prove each method creates its own profile and that a
  // previous browser session A is replaced by the chosen B, never auto-merged.
  for (const method of ["vkid", "ok_ru", "mail_ru"]) {
    vkUser = String(100000000 + Math.floor(Math.random() * 700000000));
    await page.goto(origin + "/login");
    await signIn(method);
    const first = await me();
    assert.equal(first.status, 200, JSON.stringify(first.body));
    const profile = first.body.profile;
    assert.match(profile.profile_id, /^[a-f0-9]{64}$/);
    assert.ok(!profiles.some(p => p.profile_id === profile.profile_id), "a new subject must replace the previous browser account");
    assert.equal(profile.rating, 1000);
    for (const field of ["rated_matches", "matches_played", "wins", "losses"]) assert.equal(profile[field], 0, field);
    assert.equal(profile.progression_xp, "0");
    assert.equal(profile.level, "1");
    assert.equal(first.body.social[0].method, method);
    const nextStep = page.locator('[data-game-next-step]');
    await nextStep.waitFor();
    assert.equal(await nextStep.getByRole('link', { name: 'Скачать игру' }).getAttribute('href'), '/download');
    assert.match(await nextStep.innerText(), /Россия/);
    assert.match(await nextStep.innerText(), /Профиль → Войти через VK ID/);
    assert.match(await nextStep.innerText(), /тот же аккаунт VK, OK или Mail\.ru/);
    assert.ok((await context.cookies()).find(c => c.name === "omoba-session")?.httpOnly);
    assert.equal((await context.cookies()).some(c => c.name === "omoba-social"), false);
    await page.goto(origin + "/login");
    await signIn(method);
    assert.equal((await me()).body.profile.profile_id, profile.profile_id, "repeat login keeps the profile");
    browserAccounts.push({ account: first.body, cookie: (await context.cookies()).find(c => c.name === "omoba-session") });
    assert.equal(Number(sql("SELECT count(*) FROM career_profiles")), profilesBefore + profiles.length + 1);
    await page.screenshot({ path: out + "/" + method + "-registered.png", fullPage: true });
    const seed = randomBytes(32), key = keyOf(seed), { e, code } = await enrollment(key);
    await page.goto(origin + "/connect?code=" + code);
    const review = page.locator("[data-connect-review]");
    await review.waitFor();
    assert.match(await review.innerText(), new RegExp(e.public_key.slice(0, 8) + "…" + e.public_key.slice(-8)));
    await page.getByRole("button", { name: "Подтвердить вход", exact: true }).click();
    await page.locator("[data-connect-done]").waitFor();
    const approved = await device(key, e, "status");
    assert.equal(approved.body.state, "approved");
    assert.equal(approved.body.profile_id, profile.profile_id);
    const complete = await device(key, e, "complete", profile.profile_id);
    assert.equal(complete.status, 200, JSON.stringify(complete.body));
    assert.equal(sql("SELECT profile_id FROM career_keys WHERE public_key='" + e.public_key + "' AND revoked_at IS NULL"), profile.profile_id);
    profiles.push({ method, profile_id: profile.profile_id, public_key: e.public_key });
    nativeFixtures.push({ method, profile_id: profile.profile_id, seed: seed.toString("hex") });
    checks.push(method + ": website first/repeat registration and native device use the same profile");
  }

  // A second tab changes the shared session after A's preview. Delay background
  // /me refresh to exercise the actual stale-preview mutation, not just focus.
  const [accountA, accountB] = browserAccounts;
  await context.addCookies([accountA.cookie]);
  const racingKey = keyOf(randomBytes(32)), race = await enrollment(racingKey);
  let holdAccountRefresh = true;
  const accountRefreshMatcher = url => url.pathname === "/api/me";
  const approvalMatcher = url => url.pathname === "/api/me/devices/approve";
  await page.route(accountRefreshMatcher, async route => {
    if (holdAccountRefresh) await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(accountA.account) });
    else await route.continue();
  });
  await page.goto(origin + "/connect?code=" + race.code);
  await page.locator("[data-connect-review]").waitFor();
  assert.ok((await page.locator("[data-connect-review]").innerText()).includes(accountA.account.profile.nickname));
  const otherTab = await context.newPage();
  await otherTab.goto(origin + "/me");
  await context.addCookies([accountB.cookie]);
  await otherTab.reload();
  const attemptedProfiles = [];
  await page.route(approvalMatcher, async route => {
    attemptedProfiles.push(route.request().postDataJSON().profile_id);
    const response = await route.fetch();
    if (attemptedProfiles.length === 1) {
      assert.equal(response.status(), 409);
      assert.equal((await response.json()).code, "account_changed");
      holdAccountRefresh = false;
    }
    await route.fulfill({ response });
  });
  await page.getByRole("button", { name: "Подтвердить вход", exact: true }).click();
  await page.locator("[data-connect-account-changed]").waitFor();
  await page.getByRole("heading", { name: "Войти как " + accountB.account.profile.nickname + " на устройстве «Desktop»?", exact: true }).waitFor();
  assert.deepEqual(attemptedProfiles, [accountA.account.profile.profile_id]);
  assert.equal((await device(racingKey, race.e, "status")).body.state, "pending", "stale A review cannot bind B");
  assert.equal(await page.locator("[data-connect-done]").count(), 0);
  await page.getByRole("button", { name: "Подтвердить вход", exact: true }).click();
  await page.locator("[data-connect-done]").waitFor();
  const rereviewed = await device(racingKey, race.e, "status");
  assert.equal(rereviewed.body.state, "approved");
  assert.equal(rereviewed.body.profile_id, accountB.account.profile.profile_id);
  assert.deepEqual(attemptedProfiles, [accountA.account.profile.profile_id, accountB.account.profile.profile_id]);
  await otherTab.close();
  await page.unroute(accountRefreshMatcher);
  await page.unroute(approvalMatcher);
  checks.push("cross-tab A preview cannot approve B until the new account is reviewed and explicitly confirmed");

  // The game-created profile owns its existing progress. Unknown B selected from
  // a game link must stay unlinked until that active game's key signs the link.
  const home = register("Старый профиль");
  sql("UPDATE career_profiles SET rating=1234,progression_xp=7000 WHERE profile_id='" + home.profile + "'");
  const pending = keyOf(randomBytes(32)), game = await enrollment(pending), target = "/connect?code=" + game.code;
  vkUser = String(800000000 + Math.floor(Math.random() * 100000000));
  const before = Number(sql("SELECT count(*) FROM career_profiles"));
  await page.goto(origin + "/login?returnTo=" + encodeURIComponent(target));
  await signIn("vkid", target);
  assert.equal((await context.cookies()).some(c => c.name === "omoba-session"), false, "unknown B clears existing A session");
  assert.equal((await me()).status, 401);
  assert.equal(Number(sql("SELECT count(*) FROM career_profiles")), before, "game login does not create a blank profile");
  const socialReview = page.locator("[data-connect-review]");
  await socialReview.waitFor();
  assert.match(await socialReview.innerText(), new RegExp(game.e.public_key.slice(0, 8) + "…" + game.e.public_key.slice(-8)));
  assert.match(await socialReview.innerText(), /Desktop/);
  assert.equal((await device(pending, game.e, "status")).body.state, "pending", "lookup does not attach");
  await page.screenshot({ path: out + "/game-social-review.png", fullPage: true });
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await page.locator("[data-connect-done]").waitFor();
  assert.equal((await device(pending, game.e, "status")).body.state, "social_pending");
  const link = { enrollment_id: game.e.enrollment_id, enrollment_key: game.e.public_key, public_key: publicOf(home.key), origin, expires_at: game.e.expires_at };
  const linkBy = key => native("auth/social/link", {
    link: { ...link, public_key: publicOf(key) },
    signature: signed(key, ["omoba.social.link.v1", origin, link.enrollment_id, link.enrollment_key, publicOf(key), link.expires_at]),
  });
  assert.equal((await linkBy(keyOf(randomBytes(32)))).status, 404, "unregistered keys cannot link");
  const linked = await linkBy(home.key);
  assert.equal(linked.status, 200, JSON.stringify(linked.body));
  assert.equal(linked.body.profile_id, home.profile);
  assert.equal(sql("SELECT rating||':'||progression_xp FROM career_profiles WHERE profile_id='" + home.profile + "'"), "1234:7000");
  await page.goto(origin + "/login");
  await signIn("vkid");
  assert.equal((await me()).body.profile.profile_id, home.profile);
  nativeFixtures.push({ method: "game-first", profile_id: home.profile, seed: home.seed.toString("hex") });
  await page.goto(origin + "/devices");
  assert.match(await page.locator("[data-progress-follows-vk]").innerText(), progressNote, "/devices");
  checks.push("Devices explains linked-account recovery beside recovery codes");
  checks.push("game-first link clears old browser identity, reviews device and preserves signed current profile/progress");

  await context.clearCookies();
  for (const [mode, reason] of [["cancelled", "cancelled"], ["foreign", "failed"], ["success", "provider_unavailable"]]) {
    behavior = mode;
    providerDown = reason === "provider_unavailable";
    const callsBefore = vkCalls.length;
    await page.goto(origin + "/login?returnTo=" + encodeURIComponent(target));
    await signIn("mail_ru", "/login?signin=" + reason + "&returnTo=" + encodeURIComponent(target));
    await page.locator("[data-signin-failure]").waitFor();
    const afterFailure = await context.cookies();
    assert.equal(afterFailure.some(c => ["omoba-session", "omoba-social"].includes(c.name)), false);
    // The retry page may already have prepared a fresh widget attempt.
    const nextAttempt = afterFailure.find(c => c.name === 'omoba-vk');
    if (nextAttempt) {
      assert.ok(nextAttempt.value.startsWith('one-tap.'));
      assert.ok(!nextAttempt.value.includes(authorize.at(-1).state));
    }
    if (mode !== "success") assert.equal(vkCalls.length, callsBefore, "invalid state/cancel never calls provider");
    const retry = new URL(await page.locator('[data-vk-method="mail_ru"]').first().getAttribute("href"), origin);
    assert.equal(retry.searchParams.get("returnTo"), target);
  }
  providerDown = false;
  const callsBeforeReplay = vkCalls.length;
  await page.goto(callbackUrl);
  await page.waitForURL(origin + "/login?signin=failed");
  assert.equal(vkCalls.length, callsBeforeReplay, "replayed callback without attempt cookie never calls provider");
  checks.push("cancel, mismatched state, provider outage and replay reject identity changes and preserve retry destinations");
  await context.route(url => url.pathname === '/api/auth/vk/one-tap/prepare', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"code":"unavailable"}' }));
  await page.goto(origin + '/login');
  await page.locator('[data-vk-one-tap="failed"]').waitFor();
  assert.equal(await page.locator('[data-vk-method]:visible').count(), 3);
  await page.screenshot({ path: out + '/one-tap-unavailable.png', fullPage: true });
  checks.push('OneTap failure exposes the ordinary server sign-in paths and retry');
  assert.deepEqual(errors, []);
  const privateFixture = process.env.OMOBA_NATIVE_JOURNEY_FIXTURE;
  if (privateFixture) {
    assert.ok(privateFixture.startsWith("/") && privateFixture.includes("/.agent/"), "native fixture must be an absolute ignored .agent task path");
    await writeFile(privateFixture, JSON.stringify(nativeFixtures, null, 2), { mode: 0o600 });
    await chmod(privateFixture, 0o600);
  }
  await writeFile(out + "/result.json", JSON.stringify({ passed: true, profiles, checks, viewport: { locale: "ru-RU", width: 852, height: 393 }, limitations: [
    "VK ID is a loopback stand-in; real VK, OK and Mail.ru app/accounts are not exercised.",
    "The game is a synthetic Ed25519 signer; physical device input and key storage are not exercised.",
  ] }, null, 2));
  console.log("PASS RU registration and native identity:\n- " + checks.join("\n- "));
} catch (error) {
  for (const child of children) console.error(child.name + " log\n" + child.log.slice(-4000));
  throw error;
} finally {
  await browser?.close().catch(() => {});
  await Promise.all(children.map(async child => {
    if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
    const exited = new Promise(resolve => child.once("exit", resolve));
    try { process.kill(-child.pid, "SIGTERM"); } catch { return; }
    const timer = setTimeout(() => { try { process.kill(-child.pid, "SIGKILL"); } catch {} }, 3000);
    await exited;
    clearTimeout(timer);
  }));
  // Stop the API before its provider mock: its HTTP pool may keep a connection
  // alive. Only this test's server and process groups are closed here.
  if (vk.listening) await new Promise(resolve => {
    const timer = setTimeout(() => { vk.closeAllConnections(); resolve(); }, 3000);
    vk.close(() => { clearTimeout(timer); resolve(); });
    vk.closeAllConnections();
  });
}
