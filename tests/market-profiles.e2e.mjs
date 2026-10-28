// Market profiles against the real standalone build. Run after a build, in the
// market the build was made for:
//   npm run build && npm run test:market-profiles                                   # global
//   OMOBA_MARKET=ru OMOBA_VKID_CLIENT_ID=12345 npm run build && npm run test:market-profiles
// Only loopback services are contacted: a fake Account API answers the VK ID
// exchange, tickets, device lookup/approval and /me. VK itself is never called;
// the authorize redirect is only inspected. Screenshots (ru build) go to
// .agent/market-profiles/.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { chromium } from "@playwright/test";

const required = JSON.parse(await readFile(new URL("../.next/required-server-files.json", import.meta.url), "utf8"));
const built = required.config?.env?.OMOBA_BUILT_MARKET;
const RU_LINE = "ru (ekza off, supporter off, vk_sign_in on)", GLOBAL_LINE = "global (ekza on, supporter on, vk_sign_in off)";
assert.ok(built === RU_LINE || built === GLOBAL_LINE, "run after a global or a ru build (got " + built + ")");
const market = built === RU_LINE ? "ru" : "global";

const SESSION = "e".repeat(64), TICKET = "f".repeat(64), CODE = "ABCD2345", KEY = "0123456789abcdef".repeat(4);
const calls = [];
const account = {
  profile: { profile_id: "a".repeat(64), nickname: "Иван#1234", rating: 1000, rated_matches: 0, wins: 0, losses: 0, progression_xp: "0", level: "1" },
  settings: { public_profile_enabled: false, public_stats_enabled: false, discoverable: false, locale: "ru", timezone: "Europe/Moscow", version: "1" },
  rules: { newcomer_matches: 10 }, session: { session_id: "s".repeat(64) },
  social: [{ provider: "vk", method: "vkid", linked_at: "2026-10-23T09:00:00Z" }],
};
const later = () => new Date(Date.now() + 25 * 60000).toISOString();
const RELEASE = { platform: "linux", architecture: "x86_64", version: "0.45.0", url: "https://omoba.ru/downloads/omoba-0.45.0-ru-linux-x64.tar.gz", sha256: "0".repeat(64), size_bytes: "1000", published_at: "2026-10-24T00:00:00Z", instructions: "", test_status: "Открытая бета" };
const api = createServer(async (req, res) => {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const path = new URL(req.url, "http://127.0.0.1").pathname;
  const body = raw ? JSON.parse(raw) : null;
  calls.push({ method: req.method, path, body, auth: req.headers.authorization ?? null });
  const send = (status, value) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(value)); };
  const authed = req.headers.authorization === "Bearer " + SESSION;
  if (req.method === "POST" && path === "/v1/auth/social/vk") {
    if (body.code === "linked") return send(200, { state: "signed_in", session_token: SESSION, profile: { profile_id: account.profile.profile_id, nickname: account.profile.nickname } });
    if (body.code === "new") return send(200, { state: "unlinked", social_ticket: TICKET, display_name: "Иван П.", expires_at: later() });
    return send(503, { code: "provider_unavailable" });
  }
  if (req.method === "POST" && path === "/v1/auth/social/ticket")
    return body?.social_ticket === TICKET ? send(200, { display_name: "Иван П.", expires_at: later() }) : send(404, { code: "not_found" });
  if (req.method === "POST" && path === "/v1/auth/social/enrollment")
    return body?.social_ticket === TICKET && body.code === CODE
      ? send(200, { enrollment_id: "b".repeat(64), public_key: KEY, label: "Desktop", expires_at: later() }) : send(404, { code: "not_found" });
  if (req.method === "POST" && path === "/v1/auth/social/attach")
    return body?.social_ticket === TICKET && body.code === CODE ? send(200, { status: "social_pending", label: "Desktop", expires_at: later() }) : send(404, { code: "not_found" });
  if (req.method === "GET" && path === "/v1/me") return authed ? send(200, account) : send(401, { code: "unauthorized" });
  if (req.method === "POST" && path === "/v1/me/devices/lookup")
    return !authed ? send(401, { code: "unauthorized" }) : body?.code === CODE
      ? send(200, { enrollment_id: "b".repeat(64), public_key: KEY, label: "Desktop", expires_at: later(), nickname: account.profile.nickname, profile_id: account.profile.profile_id })
      : send(404, { code: "not_found" });
  if (req.method === "POST" && path === "/v1/me/devices/approve") return authed ? send(200, { status: "approved" }) : send(401, { code: "unauthorized" });
  if (req.method === "GET" && path === "/v1/releases") return send(200, { releases: [RELEASE] });
  if (req.method === "GET" && path === "/v1/me/matches") return send(200, { matches: [], next_cursor: null, data_as_of: new Date().toISOString() });
  if (req.method === "GET" && path === "/v1/me/sessions") return send(200, { sessions: [] });
  if (req.method === "POST" && path === "/v1/auth/logout") return authed ? send(200, { status: "logged_out" }) : send(401, { code: "unauthorized" });
  send(404, { code: "not_found" });
});
await new Promise((resolve) => api.listen(0, "127.0.0.1", resolve));
const apiOrigin = "http://127.0.0.1:" + api.address().port;
const clean = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("OMOBA_") && !key.startsWith("VERCEL")));
let nextPort = 40900 + Math.floor(Math.random() * 200);

async function run(name, env, body) {
  const port = nextPort++, origin = "http://127.0.0.1:" + port;
  const server = spawn(process.execPath, ["scripts/start.mjs"], {
    env: { ...clean, OMOBA_ALLOW_INSECURE_LOCAL: "1", OMOBA_PORTAL_ORIGIN: origin, OMOBA_ACCOUNT_API_URL: apiOrigin, OMOBA_ACCOUNT_MODE: "enabled", ...env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"], detached: true,
  });
  let log = "";
  server.stdout.on("data", (chunk) => (log += chunk));
  server.stderr.on("data", (chunk) => (log += chunk));
  try {
    let first;
    for (let attempt = 0; attempt < 80 && !first; attempt++) {
      if (server.exitCode !== null) break;
      try { first = await fetch(origin + "/workshop", { signal: AbortSignal.timeout(4000) }); } catch { await new Promise((resolve) => setTimeout(resolve, 250)); }
    }
    await body({ origin, first, log: () => log });
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

const cookieHeader = (cookies) => Object.entries(cookies).map(([k, v]) => k + "=" + v).join("; ");
async function get(origin, path, cookies = {}) {
  return fetch(origin + path, { redirect: "manual", headers: { Cookie: cookieHeader(cookies), "Accept-Language": "ru-RU" } });
}
/** name -> {value, attributes} for every Set-Cookie of a response. */
function setCookies(response) {
  return Object.fromEntries(response.headers.getSetCookie().map((line) => {
    const [pair, ...attributes] = line.split("; ");
    const at = pair.indexOf("=");
    return [pair.slice(0, at), { value: pair.slice(at + 1), attributes }];
  }));
}
async function csrf(origin) {
  const response = await get(origin, "/api/csrf");
  return { token: (await response.json()).token, cookie: setCookies(response)["omoba-csrf"].value };
}
async function post(origin, path, json, cookies = {}) {
  const { token, cookie } = await csrf(origin);
  return fetch(origin + path, {
    method: "POST", redirect: "manual",
    headers: { Origin: origin, "X-CSRF-Token": token, "Content-Type": "application/json", Cookie: cookieHeader({ ...cookies, "omoba-csrf": cookie }) },
    body: JSON.stringify(json),
  });
}
async function refused(response, log, pattern) {
  assert.ok(response, "server never answered");
  assert.equal(response.status, 500);
  for (let i = 0; i < 20 && !pattern.test(log()); i++) await new Promise((resolve) => setTimeout(resolve, 100));
  assert.match(log(), pattern);
}

if (market === "ru") {
  const RU = { OMOBA_MARKET: "ru", OMOBA_VKID_CLIENT_ID: "12345" };
  await run("a ru build hides every Ekza and Supporter surface", RU, async ({ origin }) => {
    for (const page of ["/market", "/sponsor", "/creators", "/supporter", "/supporters", "/market/x"])
      assert.equal((await get(origin, page)).status, 404, page);
    const before = calls.length;
    for (const path of ["/api/ekza/csrf", "/api/ekza/library", "/api/sponsor/csrf", "/api/me/ekza-library", "/api/me/supporter", "/api/supporters"]) {
      const response = await get(origin, path);
      assert.equal(response.status, 404, path);
      assert.deepEqual(await response.json(), { code: "not_found" }, path);
    }
    assert.equal(calls.length, before, "a disabled feature reached the Account API");
    const workshop = await (await get(origin, "/workshop")).text();
    for (const link of ['href="/market"', 'href="/creators"', 'href="/sponsor"', 'href="/supporter"', "studio.ekza.io", "hub.ekza.io", "Ekza"])
      assert.ok(!workshop.includes(link), "workshop contains " + link);
    const login = await (await get(origin, "/login")).text();
    assert.equal([...login.matchAll(/data-vk-method="(\w+)"/g)].map((m) => m[1]).join(","), "vkid,ok_ru,mail_ru");
    assert.match(login, /Войти через VK ID/);
    assert.match(login, /data-pairing/);
    assert.match(login, /<html lang="ru"/);
    for (const link of ['href="/market"', 'href="/creators"', 'href="/supporter"', 'href="/supporters"']) assert.ok(!login.includes(link), "nav contains " + link);
  });

  await run("VK ID start, callback, ticket and /connect through the BFF", RU, async ({ origin }) => {
    const start = await get(origin, "/api/auth/vk/start?method=ok_ru&returnTo=" + encodeURIComponent("/connect?code=" + CODE));
    assert.equal(start.status, 302);
    const authorize = new URL(start.headers.get("location"));
    assert.equal(authorize.origin + authorize.pathname, "https://id.vk.ru/authorize");
    const params = Object.fromEntries(authorize.searchParams);
    assert.equal(params.client_id, "12345");
    assert.equal(params.redirect_uri, origin + "/api/auth/vk/callback");
    assert.equal(params.provider, "ok_ru");
    assert.equal(params.code_challenge_method, "s256");
    assert.equal(params.prompt, "login");
    assert.equal(params.scope, "vkid.personal_info");
    assert.equal(params.response_type, "code");
    assert.match(start.headers.get("cache-control"), /no-store/);
    const attempt = setCookies(start)["omoba-vk"];
    for (const attribute of ["Path=/", "Max-Age=600", "HttpOnly", "SameSite=lax"]) assert.ok(attempt.attributes.includes(attribute), attribute);
    const [state, verifier] = attempt.value.split(".");
    assert.equal(state, params.state);
    assert.ok(!start.headers.get("location").includes(verifier));
    assert.equal((await get(origin, "/api/auth/vk/start?method=google")).status, 400);

    // A foreign state never reaches the Account API.
    let before = calls.length;
    const foreign = await get(origin, "/api/auth/vk/callback?code=linked&device_id=d1&state=" + "0".repeat(64), { "omoba-vk": attempt.value });
    assert.equal(foreign.status, 302);
    assert.equal(new URL(foreign.headers.get("location")).pathname + new URL(foreign.headers.get("location")).search, "/login?signin=failed&returnTo=%2Fconnect%3Fcode%3DABCD2345");
    assert.ok(setCookies(foreign)["omoba-vk"].attributes.includes("Max-Age=0"));
    assert.equal(calls.length, before);

    const signedIn = await get(origin, "/api/auth/vk/callback?code=linked&device_id=d1&type=code_v2&state=" + state, { "omoba-vk": attempt.value });
    assert.equal(signedIn.status, 302);
    assert.equal(signedIn.headers.get("location"), origin + "/connect?code=" + CODE);
    const exchange = calls.at(-1);
    assert.deepEqual({ method: exchange.method, path: exchange.path, auth: exchange.auth }, { method: "POST", path: "/v1/auth/social/vk", auth: null });
    assert.deepEqual(exchange.body, { method: "ok_ru", code: "linked", code_verifier: verifier, device_id: "d1", redirect_uri: origin + "/api/auth/vk/callback", state });
    const session = setCookies(signedIn)["omoba-session"];
    assert.equal(session.value, SESSION);
    for (const attribute of ["Path=/", "Max-Age=604800", "HttpOnly", "SameSite=lax"]) assert.ok(session.attributes.includes(attribute), attribute);
    assert.ok(setCookies(signedIn)["omoba-vk"].attributes.includes("Max-Age=0"));

    // Unlinked VK ID: a ticket cookie, the registration view and attach with the injected ticket.
    const again = await get(origin, "/api/auth/vk/start?method=vkid");
    const second = setCookies(again)["omoba-vk"].value;
    const unlinked = await get(origin, "/api/auth/vk/callback?code=new&device_id=d2&state=" + second.split(".")[0], { "omoba-vk": second });
    assert.equal(unlinked.headers.get("location"), origin + "/me");
    const ticket = setCookies(unlinked)["omoba-social"];
    assert.equal(ticket.value, TICKET);
    assert.ok(ticket.attributes.includes("HttpOnly"));
    const registration = await (await get(origin, "/me", { "omoba-social": TICKET })).text();
    assert.match(registration, /data-registration/);
    assert.match(registration, /Иван П\./);
    assert.ok(!registration.includes(TICKET), "the ticket reached the page");
    const lookup = await post(origin, "/api/auth/social/enrollment", { code: CODE }, { "omoba-social": TICKET });
    assert.equal(lookup.status, 200);
    assert.equal((await lookup.json()).public_key, KEY);
    assert.deepEqual(calls.at(-1).body, { code: CODE, social_ticket: TICKET });
    for (const name of ["omoba-session", "omoba-pair", "omoba-csrf"]) assert.ok(setCookies(unlinked)[name].attributes.includes("Max-Age=0"));
    const attach = await post(origin, "/api/auth/social/attach", { code: CODE }, { "omoba-social": TICKET });
    assert.equal(attach.status, 200);
    assert.equal((await attach.json()).status, "social_pending");
    assert.deepEqual(calls.at(-1).body, { code: CODE, social_ticket: TICKET });
    before = calls.length;
    const forged = await post(origin, "/api/auth/social/attach", { code: CODE, social_ticket: "d".repeat(64) }, { "omoba-social": TICKET });
    assert.equal(forged.status, 400);
    assert.equal(calls.length, before, "a browser-supplied ticket reached the Account API");

    // The provider's failure becomes a message on the login view.
    const failing = setCookies(await get(origin, "/api/auth/vk/start?method=mail_ru"))["omoba-vk"].value;
    const down = await get(origin, "/api/auth/vk/callback?code=busy&device_id=d3&state=" + failing.split(".")[0], { "omoba-vk": failing });
    assert.equal(down.headers.get("location"), origin + "/login?signin=provider_unavailable");
    assert.match(await (await get(origin, "/login?signin=provider_unavailable")).text(), /VK ID сейчас не отвечает/);

    // Sign-out also clears the ticket.
    const out = await post(origin, "/api/auth/logout", {}, { "omoba-social": TICKET });
    assert.ok(setCookies(out)["omoba-social"].attributes.includes("Max-Age=0"));
  });

  await run("browser: ru login and /connect device confirmation", RU, async ({ origin }) => {
    const dir = ".agent/market-profiles";
    await mkdir(dir, { recursive: true });
    const browser = await chromium.launch({ channel: "chrome", headless: true });
    try {
      const context = await browser.newContext({ locale: "ru-RU", viewport: { width: 1440, height: 1000 } });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(origin + "/login");
      await page.locator("[data-vk-method]").first().waitFor();
      assert.equal(await page.locator("[data-vk-method]").count(), 3);
      assert.equal(await page.locator('nav a[href="/market"], nav a[href="/supporter"]').count(), 0);
      await page.screenshot({ path: dir + "/ru-login.png", fullPage: true });
      // Signed in (as after "signed_in"): the game's code is looked up and approved.
      await context.addCookies([{ name: "omoba-session", value: SESSION, url: origin, httpOnly: true }]);
      await page.goto(origin + "/connect?code=" + CODE);
      await page.locator("[data-connect-review]").waitFor();
      const review = await page.locator("[data-connect-review]").innerText();
      assert.match(review, /Войти как Иван#1234 на устройстве «Desktop»\?/);
      assert.match(review, /01234567…89abcdef/);
      await page.screenshot({ path: dir + "/ru-connect.png", fullPage: true });
      await page.getByRole("button", { name: "Подтвердить вход" }).click();
      await page.locator("[data-connect-done]").waitFor();
      assert.match(await page.locator("[data-connect-done]").innerText(), /Вернитесь в игру и подтвердите вход/);
      assert.deepEqual(calls.filter((c) => c.path === "/v1/me/devices/approve").at(-1).body, { enrollment_id: "b".repeat(64), public_key: KEY });
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
  });

  await run("ru legal pages, the sign-in notice and the footer links (LR-06)", RU, async ({ origin }) => {
    const before = calls.length;
    for (const [name, title] of [["privacy", "Политика обработки персональных данных"], ["terms", "Пользовательское соглашение"], ["offer", "Публичная оферта"]]) {
      const response = await get(origin, "/" + name);
      assert.equal(response.status, 200, name);
      const html = await response.text();
      assert.match(html, /<html lang="ru"/, name);
      assert.match(html, new RegExp('data-legal-document="' + name + '" data-legal-version="0-draft" data-legal-status="draft"'), name);
      assert.match(html, /data-legal-draft/, name);
      assert.ok(html.includes("Проект — требует проверки юристом."), name + " has no draft banner");
      assert.match(html, /Редакция[\s\S]{0,40}0-draft[\s\S]{0,80}не вступила в силу/, name);
      assert.ok(html.includes("<title>" + title), name + " title");
      assert.match(html, /<footer class="legal-page-footer">[\s\S]*data-legal-link="privacy"[\s\S]*data-legal-link="terms"/, name);
    }
    assert.equal(calls.length, before, "a legal page called the Account API");
    const login = await (await get(origin, "/login")).text();
    const notice = /<p class="legal-notice"[\s\S]*?<\/p>/.exec(login)?.[0] ?? "";
    assert.match(notice, /data-legal-version="0-draft"/);
    assert.match(notice, /Входя, вы принимаете/);
    assert.deepEqual([...notice.matchAll(/href="([^"]+)"/g)].map((m) => m[1]), ["/terms", "/privacy"]);
    const footer = /<nav class="legal-links"[\s\S]*?<\/nav>/.exec(login)?.[0] ?? "";
    // Supporter is off in ru: no offer link; support and community wait for the owner (LR-21).
    assert.deepEqual([...footer.matchAll(/data-legal-link="(\w+)"/g)].map((m) => m[1]), ["privacy", "terms", "delete", "source"]);
    assert.match(footer, /href="https:\/\/github.com\/o-moba\/omoba-bevy"/);
    assert.match(await (await get(origin, "/connect?code=" + CODE)).text(), /<p class="legal-notice"/);
    assert.match(await (await get(origin, "/workshop")).text(), /data-legal-links/);
  });

  await run("browser: ru footer and notice links open the documents", RU, async ({ origin }) => {
    const browser = await chromium.launch({ channel: "chrome", headless: true });
    try {
      const context = await browser.newContext({ locale: "ru-RU", viewport: { width: 1440, height: 1000 } });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(origin + "/login");
      await page.locator("footer [data-legal-link=privacy]").click();
      await page.waitForURL("**/privacy");
      await page.locator("[data-legal-document=privacy] [data-legal-draft]").waitFor();
      await page.locator("footer [data-legal-link=terms]").click();
      await page.waitForURL("**/terms");
      assert.equal(await page.locator("h1").innerText(), "Пользовательское соглашение");
      await page.locator("footer [data-legal-link=delete]").click();
      await page.waitForURL("**/delete");
      assert.equal(await page.locator("h1").innerText(), "Удаление аккаунта OMOBA");
      await page.locator("[data-deletion-page] [data-legal-link=privacy]").click();
      await page.waitForURL("**/privacy#requests");
      await page.goto(origin + "/login");
      await page.locator("[data-legal-notice] [data-legal-link=privacy]").click();
      await page.waitForURL("**/privacy");
      assert.equal(await page.locator("h1").innerText(), "Политика обработки персональных данных");
      // Each download links the source of its release (the public tag v<version>-ru).
      await page.goto(origin + "/download");
      await page.locator("[data-release-source]").waitFor();
      assert.equal(await page.locator("[data-release-source]").getAttribute("href"), "https://github.com/o-moba/omoba-bevy/tree/v0.45.0-ru");
      // Phones hide the portal footer; with legal links it stays visible.
      const phone = await (await browser.newContext({ locale: "ru-RU", viewport: { width: 360, height: 800 } })).newPage();
      phone.on("pageerror", (error) => errors.push(error.message));
      await phone.goto(origin + "/login");
      assert.ok(await phone.locator("footer [data-legal-links]").isVisible(), "legal links hidden on a phone");
      for (const path of ["/login", "/privacy", "/terms", "/offer", "/delete"]) {
        await phone.goto(origin + path);
        await phone.locator("footer [data-legal-links]").waitFor();
        assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path + " overflows on a phone");
      }
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
  });

  await run("a ru build refuses to serve as global", {}, async ({ first, log }) => {
    await refused(first, log, /OMOBA market mismatch, refusing to serve \(fail closed\): this build was made for ru/);
  });
} else {
  await run("a global build offers no VK ID and keeps its pages", { OMOBA_VKID_CLIENT_ID: "12345" }, async ({ origin }) => {
    for (const path of ["/api/auth/vk/start?method=vkid", "/api/auth/vk/callback?code=x&state=y&device_id=z"]) {
      const response = await get(origin, path);
      assert.equal(response.status, 404, path);
      assert.deepEqual(await response.json(), { code: "not_found" });
    }
    const before = calls.length;
    assert.equal((await post(origin, "/api/auth/social/attach", { code: CODE }, { "omoba-social": TICKET })).status, 404);
    assert.equal(calls.length, before);
    const login = await (await get(origin, "/login")).text();
    assert.ok(!/data-vk-method/.test(login));
    for (const link of ['href="/market"', 'href="/creators"', 'href="/supporter"', 'href="/supporters"']) assert.ok(login.includes(link), "nav lacks " + link);
    assert.equal((await get(origin, "/supporters")).status, 200);
  });
  await run("a global build has no legal pages, sign-in notice or legal links", {}, async ({ origin }) => {
    for (const path of ["/privacy", "/terms", "/offer", "/delete"]) assert.equal((await get(origin, path)).status, 404, path);
    for (const path of ["/login", "/workshop", "/connect?code=" + CODE, "/download"]) {
      const html = await (await get(origin, path)).text();
      for (const marker of ["data-legal-notice", "data-legal-links", "data-legal-link", "data-release-source"]) assert.ok(!html.includes(marker), path + " contains " + marker);
    }
  });
  await run("a global build refuses to serve as ru", { OMOBA_MARKET: "ru" }, async ({ first, log }) => {
    await refused(first, log, /OMOBA market mismatch, refusing to serve \(fail closed\): this build was made for global/);
  });
}
api.close();
console.log("market profiles e2e passed for a " + market + " build");
