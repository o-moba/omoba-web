// Sign in with VK ID end to end: the real RU portal build, the real Account API
// built for the RU market (OMOBA_MARKET=ru), a disposable PostgreSQL, Chrome, and
// a synthetic game that signs its native requests with Ed25519 keys. VK ID itself
// is never contacted: the browser's navigation to id.vk.ru is answered with VK's
// redirect back to the callback, and the Account API exchanges the code against a
// loopback stand-in (OMOBA_VKID_LOCAL_FIXTURE_ORIGIN).
//
//   OMOBA_MARKET=ru OMOBA_VKID_CLIENT_ID=51234567 npm run build
//   OMOBA_ACCOUNT_API_BIN=…/omoba-account-api \           # built with OMOBA_MARKET=ru
//   OMOBA_E2E_DATABASE_URL=postgres://owner@127.0.0.1:55581/vk_e2e \
//   OMOBA_PSQL=/Applications/Postgres.app/Contents/Versions/18/bin/psql \
//   npm run test:vk-sign-in
//
// The database must be a disposable, empty loopback database: the script migrates it.
// Screenshots go to .agent/vk-sign-in/.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createPrivateKey, createPublicKey, randomBytes, sign } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { chromium } from "@playwright/test";

const required = JSON.parse(await readFile(new URL("../.next/required-server-files.json", import.meta.url), "utf8"));
assert.equal(required.config?.env?.OMOBA_BUILT_MARKET, "ru (ekza off, supporter off, vk_sign_in on)", "run after a ru build");
const binary = process.env.OMOBA_ACCOUNT_API_BIN, database = process.env.OMOBA_E2E_DATABASE_URL;
assert.ok(binary && database, "set OMOBA_ACCOUNT_API_BIN and OMOBA_E2E_DATABASE_URL");
const db = new URL(database);
assert.ok(db.hostname === "127.0.0.1" && db.port === "55581", "only the disposable loopback cluster on 55581");
const psql = process.env.OMOBA_PSQL || "psql";
const CLIENT_ID = "51234567", origin = "http://127.0.0.1:3010", out = ".agent/vk-sign-in";
await mkdir(out, { recursive: true });

// --- VK ID stand-in: code `user-<id>` is VK user <id>, named Иван Петров.
const vkCalls = [];
const vk = createServer(async (req, res) => {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const form = Object.fromEntries(new URLSearchParams(raw));
  vkCalls.push({ path: req.url, form });
  const send = (status, value) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(value)); };
  if (req.url === "/oauth2/auth") {
    const ok = form.grant_type === "authorization_code" && form.client_id === CLIENT_ID && form.device_id && form.state
      && form.code_verifier?.length >= 43 && form.redirect_uri === origin + "/api/auth/vk/callback" && !("client_secret" in form);
    const id = form.code?.startsWith("user-") ? form.code.slice(5) : null;
    return ok && id ? send(200, { access_token: "token-" + id, expires_in: 3600 }) : send(400, { error: "invalid_grant" });
  }
  if (req.url === "/oauth2/user_info") {
    const id = form.access_token?.startsWith("token-") ? form.access_token.slice(6) : null;
    return id && form.client_id === CLIENT_ID ? send(200, { user: { user_id: id, first_name: "Иван", last_name: "Петров" } }) : send(401, { error: "invalid_token" });
  }
  send(404, {});
});
await new Promise((resolve) => vk.listen(0, "127.0.0.1", resolve));
const vkOrigin = "http://127.0.0.1:" + vk.address().port;

// --- Account API (RU build) and the RU portal.
const hex32 = () => randomBytes(32).toString("hex");
const clean = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("OMOBA_") && !key.startsWith("VERCEL")));
execFileSync(binary, ["migrate"], { env: { ...clean, OMOBA_DATABASE_URL: database }, stdio: "inherit" });
const apiPort = 40600 + Math.floor(Math.random() * 200), apiOrigin = "http://127.0.0.1:" + apiPort;
const children = [];
function start(command, args, env, name) {
  const child = spawn(command, args, { env: { ...clean, ...env }, stdio: ["ignore", "pipe", "pipe"], detached: true });
  child.log = "";
  child.stdout.on("data", (c) => (child.log += c));
  child.stderr.on("data", (c) => (child.log += c));
  child.name = name;
  children.push(child);
  return child;
}
const api = start(binary, [], {
  OMOBA_DATABASE_URL: database, OMOBA_PORTAL_ORIGIN: origin, OMOBA_ALLOW_INSECURE_LOCAL: "1",
  OMOBA_PORTAL_SECRET: hex32(), OMOBA_VKID_CLIENT_ID: CLIENT_ID, OMOBA_SOCIAL_SECRET: hex32(),
  OMOBA_VKID_LOCAL_FIXTURE_ORIGIN: vkOrigin, OMOBA_ACCOUNT_BIND: "127.0.0.1:" + apiPort,
}, "account-api");
const portal = start(process.execPath, ["scripts/start.mjs"], {
  OMOBA_MARKET: "ru", OMOBA_VKID_CLIENT_ID: CLIENT_ID, OMOBA_ACCOUNT_MODE: "enabled", OMOBA_ALLOW_INSECURE_LOCAL: "1",
  OMOBA_PORTAL_ORIGIN: origin, OMOBA_ACCOUNT_API_URL: apiOrigin, PORT: "3010",
}, "portal");
async function ready(url, child) {
  for (let i = 0; i < 120; i++) {
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
  const key = keyOf(randomBytes(32)), profile = hex32();
  execFileSync(psql, [database, "-v", "ON_ERROR_STOP=1", "-qc",
    `INSERT INTO career_profiles(profile_id,nickname) VALUES('${profile}','${nickname}'); INSERT INTO career_keys(public_key,profile_id) VALUES('${publicOf(key)}','${profile}');`]);
  return { key, profile };
}
const sql = (query) => execFileSync(psql, [database, "-qtAc", query]).toString().trim();

const vkUser = String(100000 + Math.floor(Math.random() * 1e8));
const checks = [];
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  await ready(apiOrigin + "/health/ready", api);
  await ready(origin + "/login", portal);
  const context = await browser.newContext({ locale: "ru-RU", viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // VK ID: the portal's real start response (attempt cookie + authorize URL) is taken,
  // the authorize URL is checked, and VK's redirect back to the callback is played
  // without loading id.vk.ru (a route never sees the hop after a server redirect).
  const authorize = [];
  await context.route((url) => url.pathname === "/api/auth/vk/start", async (route) => {
    const response = await route.fetch({ maxRedirects: 0 });
    assert.equal(response.status(), 302);
    const url = new URL(response.headers().location);
    assert.equal(url.origin + url.pathname, "https://id.vk.ru/authorize");
    authorize.push(Object.fromEntries(url.searchParams));
    const back = new URL(url.searchParams.get("redirect_uri"));
    back.search = new URLSearchParams({ code: "user-" + vkUser, state: url.searchParams.get("state"), device_id: "vk-device-1", type: "code_v2" });
    const headers = Object.fromEntries(response.headersArray().filter((h) => !["location", "content-length", "content-type"].includes(h.name.toLowerCase())).map((h) => [h.name, h.value]));
    const cookies = response.headersArray().filter((h) => h.name.toLowerCase() === "set-cookie").map((h) => h.value);
    await route.fulfill({ status: 200, contentType: "text/html", headers: { ...headers, "set-cookie": cookies.join("\n") },
      body: `<!doctype html><script>location.replace(${JSON.stringify(back.toString())})</script>` });
  });
  // start -> id.vk.ru (answered above) -> callback -> returnTo (/me by default).
  async function vkSignIn(button = "Войти через VK ID") {
    await Promise.all([
      page.waitForURL((url) => url.pathname === "/me"),
      page.getByRole("link", { name: button }).first().click(),
    ]);
  }

  // 1. The player has played: the install key owns a game profile.
  const home = register("Лиса");
  const nickname = sql(`SELECT nickname FROM career_profiles WHERE profile_id='${home.profile}'`);

  // 2. Registration on the website: an unknown VK account signs nobody in. Guest
  //    home and sign-in say that progress follows the VK-linked account (LR-18).
  const progressNote = /^Прогресс следует за аккаунтом, привязанным к VK\. .*тем же VK ID.*Коды восстановления/;
  for (const path of ["/me", "/login"]) {
    await page.goto(origin + path);
    assert.match(await page.locator("[data-progress-follows-vk]").innerText(), progressNote, path);
  }
  checks.push("guest home and sign-in say that progress follows the VK-linked account");
  await vkSignIn();
  const first = authorize[0];
  assert.equal(first.client_id, CLIENT_ID);
  assert.equal(first.provider, "vkid");
  assert.equal(first.code_challenge_method, "S256");
  assert.equal(first.scope, "vkid.personal_info");
  assert.equal(first.redirect_uri, origin + "/api/auth/vk/callback");
  assert.equal((await context.cookies()).some((c) => c.name === "omoba-session"), false, "no session for an unlinked VK account");
  assert.ok((await context.cookies()).find((c) => c.name === "omoba-social")?.httpOnly, "an httpOnly registration ticket");
  await page.getByText("Иван П.").first().waitFor();
  await page.screenshot({ path: out + "/1-registered.png", fullPage: true });
  checks.push("website VK registration creates no game profile and no session");
  assert.match(sql("SELECT count(*) FROM portal.social_identities WHERE profile_id IS NULL"), /^[1-9]/);
  assert.equal(sql(`SELECT count(*) FROM portal.social_identities WHERE subject_hash LIKE '%${vkUser}%'`), "0");

  // 3. The game asks to sign in: a pending key and its code; the browser opens /connect.
  const pending = keyOf(randomBytes(32)), e = enrollmentFor(pending);
  const created = await device(pending, e, "create");
  assert.equal(created.status, 200, JSON.stringify(created.body));
  const code = created.body.code;
  await page.goto(origin + "/connect?code=" + code);
  await page.getByRole("button", { name: "Продолжить" }).click();
  await page.locator("[data-connect-done]").waitFor();
  await page.screenshot({ path: out + "/2-connect-attached.png", fullPage: true });
  const status = await device(pending, e, "status");
  assert.equal(status.body.state, "social_pending");
  assert.equal(status.body.social.display_name, "Иван П.");
  checks.push("the game sees the waiting VK sign-in (social_pending)");

  // 4. The player confirms in the game: the active key signs the link.
  const link = { enrollment_id: e.enrollment_id, enrollment_key: e.public_key, public_key: publicOf(home.key), origin, expires_at: e.expires_at };
  const stranger = keyOf(randomBytes(32));
  const refused = await native("auth/social/link", { link: { ...link, public_key: publicOf(stranger) }, signature: signed(stranger, ["omoba.social.link.v1", origin, link.enrollment_id, link.enrollment_key, publicOf(stranger), link.expires_at]) });
  assert.equal(refused.status, 404, "an unregistered key cannot link");
  const linked = await native("auth/social/link", { link, signature: signed(home.key, ["omoba.social.link.v1", origin, link.enrollment_id, link.enrollment_key, link.public_key, link.expires_at]) });
  assert.equal(linked.status, 200, JSON.stringify(linked.body));
  assert.equal(linked.body.profile_id, home.profile);
  checks.push("only the game's active key links the VK sign-in to its profile");

  // 5. VK now signs the browser into that account.
  await page.goto(origin + "/login");
  await vkSignIn("Одноклассники");
  assert.equal(authorize.at(-1).provider, "ok_ru");
  assert.ok((await context.cookies()).find((c) => c.name === "omoba-session")?.httpOnly);
  const me = await page.evaluate(async () => (await fetch("/api/me")).json());
  assert.equal(me.profile.profile_id, home.profile);
  assert.equal(me.profile.nickname, nickname);
  assert.equal(me.social[0].method, "ok_ru");
  await page.goto(origin + "/me");
  await page.getByText(nickname).first().waitFor();
  await page.screenshot({ path: out + "/3-signed-in.png", fullPage: true });
  checks.push("VK (via OK) signs the website into the linked game account");
  await page.goto(origin + "/devices");
  assert.match(await page.locator("[data-progress-follows-vk]").innerText(), progressNote, "/devices");
  checks.push("Devices says it next to the recovery codes");

  // 6. A second computer: the website approves its code as the account; the game switches.
  register("Guest");
  const laptop = keyOf(randomBytes(32)), e2 = enrollmentFor(laptop);
  const code2 = (await device(laptop, e2, "create")).body.code;
  await page.goto(origin + "/connect?code=" + code2);
  await page.locator("[data-connect-review]").waitFor();
  await page.screenshot({ path: out + "/4-connect-review.png", fullPage: true });
  await page.getByRole("button", { name: "Подтвердить вход" }).click();
  await page.locator("[data-connect-done]").waitFor();
  const approved = await device(laptop, e2, "status");
  assert.equal(approved.body.state, "approved");
  assert.equal(approved.body.profile_id, home.profile);
  const completed = await device(laptop, e2, "complete", home.profile);
  assert.equal(completed.status, 200, JSON.stringify(completed.body));
  assert.equal(sql(`SELECT profile_id FROM career_keys WHERE public_key='${publicOf(laptop)}' AND revoked_at IS NULL`), home.profile);
  checks.push("a new device signs in through VK and is enrolled into the account");

  // 7. What is stored, and what the Account API was asked.
  assert.equal(sql("SELECT count(*) FROM portal.social_identities WHERE provider='vk' AND profile_id IS NOT NULL AND method='ok_ru'"), "1");
  assert.ok(vkCalls.every((c) => !("client_secret" in c.form)));
  assert.ok(vkCalls.some((c) => c.path === "/oauth2/auth" && c.form.device_id === "vk-device-1"), "the callback's device_id reaches the token exchange");
  assert.deepEqual(errors, []);
  await writeFile(out + "/result.json", JSON.stringify({ passed: true, checks, limitations: [
    "VK ID is a loopback stand-in; the real id.vk.ru app is not exercised.",
    "The game is a synthetic signer of the same native requests; the Bevy UI is covered by client tests.",
  ] }, null, 2));
  console.log("PASS VK ID sign-in end to end:\n- " + checks.join("\n- "));
} catch (error) {
  for (const child of children) console.error("--- " + child.name + " log\n" + child.log.slice(-4000));
  throw error;
} finally {
  await browser.close();
  vk.close();
  for (const child of children) { try { process.kill(-child.pid, "SIGTERM"); } catch {} }
}
