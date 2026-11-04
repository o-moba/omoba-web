// Hero tiers through YooKassa end to end (LR-67): the real RU portal build, the real
// Account API built for the RU market (OMOBA_MARKET=ru, a debug build: only it accepts
// the loopback YooKassa stand-in), a disposable PostgreSQL, Chrome, and a YooKassa
// stand-in on loopback that answers like YooKassa's /v3 API (idempotent creates per
// Idempotence-Key, payments, refunds, refund lists). YooKassa itself is never contacted:
// the browser's redirect to the stand-in's payment page is answered locally.
//
//   OMOBA_MARKET=ru OMOBA_VKID_CLIENT_ID=51234567 npm run build
//   OMOBA_ACCOUNT_API_BIN=…/omoba-account-api \          # OMOBA_MARKET=ru cargo build -p omoba-account-api
//   OMOBA_E2E_DATABASE_URL=postgres://owner@127.0.0.1:55581/hero_tiers_e2e \
//   OMOBA_PSQL=/Applications/Postgres.app/Contents/Versions/18/bin/psql \
//   npm run test:hero-tiers
//
// The database must be a disposable, empty loopback database: the script migrates it.
// Screenshots go to .agent/hero-tiers/.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createPrivateKey, createPublicKey, randomBytes, sign } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { chromium } from "@playwright/test";

const required = JSON.parse(await readFile(new URL("../.next/required-server-files.json", import.meta.url), "utf8"));
assert.equal(required.config?.env?.OMOBA_BUILT_MARKET, "ru (ekza off, supporter on, vk_sign_in on)", "run after a ru build");
const binary = process.env.OMOBA_ACCOUNT_API_BIN, database = process.env.OMOBA_E2E_DATABASE_URL;
assert.ok(binary && database, "set OMOBA_ACCOUNT_API_BIN and OMOBA_E2E_DATABASE_URL");
const db = new URL(database);
assert.ok(db.hostname === "127.0.0.1" && db.port === "55581", "only the disposable loopback cluster on 55581");
const psql = process.env.OMOBA_PSQL || "psql";
const out = ".agent/hero-tiers";
await mkdir(out, { recursive: true });
const sql = (query) => execFileSync(psql, [database, "-qtAc", query]).toString().trim();
const now = () => Math.floor(Date.now() / 1000);
const iso = (seconds) => new Date(seconds * 1000).toISOString();
const rubles = (minor) => (minor / 100).toFixed(2);
/** Text that must never reach an RU page: Solana, Apple, crypto, wallets, Ekza, donation wording. */
const FORBIDDEN = /solana|apple|app store|crypto(?!graph)|криптовалют|wallet|кошел[её]к|ekza|usdc|\/donate|donat|донат/i;

// --- YooKassa stand-in: /v3 with Basic auth of the test shop.
const SHOP_ID = "123456", SHOP_SECRET = "test_shop_secret_key", PAY_HOST = "yoomoney.example";
const AUTH = "Basic " + Buffer.from(SHOP_ID + ":" + SHOP_SECRET).toString("base64");
const shop = { payments: new Map(), keys: new Map(), refunds: [], posts: [], calls: [] };
const stand = createServer(async (req, res) => {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const url = new URL(req.url, "http://127.0.0.1");
  shop.calls.push(req.method + " " + url.pathname);
  const send = (status, value) => { res.writeHead(status, { "Content-Type": "application/json", "x-request-id": "stand-in-" + shop.calls.length }); res.end(JSON.stringify(value)); };
  if (req.headers.authorization !== AUTH) return send(401, { type: "error", code: "invalid_credentials" });
  if (req.method === "POST" && url.pathname === "/v3/payments") {
    const key = String(req.headers["idempotence-key"] ?? "");
    if (!/^[0-9a-f]{16,80}$/.test(key)) return send(400, { type: "error", code: "invalid_request" });
    // The Account API committed and claimed the attempt with this key before posting.
    const persisted = sql(`SELECT count(*) FROM portal.supporter_yookassa_attempts WHERE idempotence_key='${key}' AND status='charging' AND lease_until IS NOT NULL AND first_provider_attempt_at IS NOT NULL`) === "1";
    const body = JSON.parse(raw);
    shop.posts.push({ key, body, persisted });
    // YooKassa answers a repeated key with the payment the first request made.
    if (shop.keys.has(key)) return send(200, shop.payments.get(shop.keys.get(key)));
    const id = "2f" + randomBytes(3).toString("hex") + "-000f-5000-9000-" + randomBytes(6).toString("hex");
    const payment = {
      id, status: "pending", paid: false, amount: body.amount, description: body.description, metadata: body.metadata, created_at: iso(now()),
      confirmation: { type: "redirect", confirmation_url: "https://" + PAY_HOST + "/checkout/payments/v2/contract?orderId=" + id },
      recipient: { account_id: SHOP_ID, gateway_id: "1" }, refundable: false, test: true,
    };
    shop.payments.set(id, payment);
    shop.keys.set(key, id);
    return send(200, payment);
  }
  const payment = /^\/v3\/payments\/([\w-]+)$/.exec(url.pathname)?.[1];
  if (req.method === "GET" && payment) return shop.payments.has(payment) ? send(200, shop.payments.get(payment)) : send(404, { type: "error", code: "not_found" });
  const refund = /^\/v3\/refunds\/([\w-]+)$/.exec(url.pathname)?.[1];
  if (req.method === "GET" && refund) {
    const found = shop.refunds.find((r) => r.id === refund);
    return found ? send(200, found) : send(404, { type: "error", code: "not_found" });
  }
  if (req.method === "GET" && url.pathname === "/v3/refunds") {
    const after = Date.parse(url.searchParams.get("created_at.gt")), until = Date.parse(url.searchParams.get("created_at.lte"));
    const limit = Number(url.searchParams.get("limit")), offset = Number((url.searchParams.get("cursor") ?? "cursor-0").slice(7));
    const matching = shop.refunds.filter((r) => after < Date.parse(r.created_at) && Date.parse(r.created_at) <= until);
    const page = { type: "list", items: matching.slice(offset, offset + limit) };
    if (offset + limit < matching.length) page.next_cursor = "cursor-" + (offset + limit);
    return send(200, page);
  }
  send(404, { type: "error", code: "not_found" });
});
await new Promise((resolve) => stand.listen(0, "127.0.0.1", resolve));
const standOrigin = "http://127.0.0.1:" + stand.address().port;
const paymentOf = (key) => shop.payments.get(shop.keys.get(key));
function pay(id) {
  Object.assign(shop.payments.get(id), { status: "succeeded", paid: true, captured_at: iso(now()), refundable: true });
}
function cancel(id) {
  Object.assign(shop.payments.get(id), { status: "canceled", paid: false, cancellation_details: { party: "yoo_money", reason: "expired_on_confirmation" } });
}
function refundOf(id, minor) {
  const refund = { id: "2f" + randomBytes(3).toString("hex") + "-0015-5000-8000-" + randomBytes(6).toString("hex"), payment_id: id, status: "succeeded", amount: { value: rubles(minor), currency: "RUB" }, created_at: iso(now()) };
  shop.refunds.push(refund);
  return refund;
}

// --- Account API (RU build, YooKassa test shop on the stand-in) and the RU portal.
const hex32 = () => randomBytes(32).toString("hex");
const clean = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("OMOBA_") && !key.startsWith("VERCEL")));
execFileSync(binary, ["migrate"], { env: { ...clean, OMOBA_DATABASE_URL: database }, stdio: "inherit" });
const apiPort = 41400 + Math.floor(Math.random() * 200), apiOrigin = "http://127.0.0.1:" + apiPort;
// The only loopback portal origin the Account API accepts (OMOBA_ALLOW_INSECURE_LOCAL=1).
const portalPort = 3010, origin = "http://127.0.0.1:" + portalPort;
try {
  await fetch(origin, { signal: AbortSignal.timeout(1000) });
  throw new Error("port 3010 is in use: stop the other portal first");
} catch (error) { if (/port 3010/.test(error.message)) throw error; }
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
  OMOBA_DATABASE_URL: database, OMOBA_PORTAL_ORIGIN: origin, OMOBA_ALLOW_INSECURE_LOCAL: "1", OMOBA_PORTAL_SECRET: hex32(),
  OMOBA_VKID_CLIENT_ID: "51234567", OMOBA_SOCIAL_SECRET: hex32(), OMOBA_ACCOUNT_BIND: "127.0.0.1:" + apiPort,
  OMOBA_YOOKASSA_SHOP_ID: SHOP_ID, OMOBA_YOOKASSA_SECRET_KEY: SHOP_SECRET, OMOBA_YOOKASSA_VAT_CODE: "1", OMOBA_YOOKASSA_NEW_CHARGES: "1",
  OMOBA_YOOKASSA_TEST_API_ORIGIN: standOrigin,
}, "account-api");
const portal = start(process.execPath, ["scripts/start.mjs"], {
  OMOBA_MARKET: "ru", OMOBA_VKID_CLIENT_ID: "51234567", OMOBA_ACCOUNT_MODE: "enabled", OMOBA_ALLOW_INSECURE_LOCAL: "1",
  OMOBA_PORTAL_ORIGIN: origin, OMOBA_ACCOUNT_API_URL: apiOrigin, PORT: String(portalPort),
}, "portal");
async function ready(url, child) {
  for (let i = 0; i < 160; i++) {
    if (child.exitCode !== null) throw new Error(child.name + " exited:\n" + child.log);
    try { if ((await fetch(url, { signal: AbortSignal.timeout(2000) })).status < 500) return; } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(child.name + " did not start:\n" + child.log);
}
async function until(check, what, tries = 80) {
  for (let i = 0; i < tries; i++) { if (await check()) return; await new Promise((r) => setTimeout(r, 250)); }
  throw new Error("timed out waiting for " + what);
}
async function notify(event, object) {
  const response = await fetch(apiOrigin + "/v1/supporter/yookassa/notifications", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "notification", event, object }),
  });
  return { status: response.status, body: await response.json() };
}

// --- Synthetic players: a game profile with an Ed25519 key that approves web pairing.
const keyOf = (seed) => createPrivateKey({ key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), seed]), format: "der", type: "pkcs8" });
const publicOf = (key) => createPublicKey(key).export({ format: "der", type: "spki" }).subarray(-32).toString("hex");
function register(nickname) {
  const key = keyOf(randomBytes(32)), profile = hex32();
  execFileSync(psql, [database, "-v", "ON_ERROR_STOP=1", "-qc",
    `INSERT INTO career_profiles(profile_id,nickname) VALUES('${profile}','${nickname}'); INSERT INTO career_keys(public_key,profile_id) VALUES('${publicOf(key)}','${profile}');`]);
  return { key, profile, nickname };
}
async function native(path, body) {
  const response = await fetch(apiOrigin + "/v1/" + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const value = await response.json();
  assert.equal(response.status, 200, path + " " + JSON.stringify(value));
  return value;
}

const checks = [];
const errors = [], external = [];
const browser = await chromium.launch({ channel: "chrome", headless: true });
/** A Russian browser context: YooKassa's payment page is the stand-in's; nothing else leaves loopback. */
async function newContext(options = {}) {
  const context = await browser.newContext({ locale: "ru-RU", viewport: { width: 1280, height: 900 }, ...options });
  await context.route((url) => url.hostname === PAY_HOST, (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>YooKassa stand-in</title><p>stand-in payment page</p>" }));
  // The VK ID One Tap widget on the sign-in page loads from id.vk.ru (VK ID itself is
  // tested in vk-sign-in.e2e.mjs). Its requests are answered locally as no-ops, like
  // vk-sign-in.e2e.mjs does: expected, not a leak, and nothing reaches VK.
  await context.route((url) => url.origin !== origin && url.hostname !== PAY_HOST, (route) => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== "https://id.vk.ru") { external.push(request.url()); return route.abort(); }
    if (request.resourceType() === "script") return route.fulfill({ contentType: "text/javascript", body: "" });
    if (url.pathname === "/button_one_tap_auth") return route.fulfill({ contentType: "text/html", body: "<!doctype html><script>parent.postMessage({type:\"vk-sak-sdk\",handler:\"onetap: not authorized\",params:{}}," + JSON.stringify(origin) + ")</script>" });
    return route.fulfill({ contentType: "application/json", body: '{"response":1}' });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on("pageerror", (e) => errors.push(e.message));
  return { context, page };
}
async function signIn(page, player) {
  await page.goto(origin + "/login?returnTo=%2Fsupporter");
  await page.getByRole("button", { name: "Получить код", exact: true }).click();
  const code = (await page.locator(".pair-code").innerText()).replace(/[^A-Z0-9]/g, "");
  const { challenge: c } = await native("auth/pairings/lookup", { code, public_key: publicOf(player.key) });
  const bytes = JSON.stringify(["omoba.web.pair.v1", c.origin, c.pair_id, c.nonce, c.public_key, c.browser_binding, "approve", c.scopes, c.expires_at]);
  await native("auth/pairings/approve", { challenge: c, decision: "approve", signature: sign(null, Buffer.from(bytes), player.key).toString("hex") });
  await page.waitForURL((url) => url.pathname === "/supporter");
  await page.locator("[data-tier-status]").waitFor();
}
/** Choose an amount, fill the form and press Pay; resolves on the stand-in's payment page. */
async function checkout(page, { tier, custom, email }) {
  if (custom !== undefined) await page.locator("[data-tier-card=custom] .tier-custom").fill(String(custom));
  else await page.locator(`[data-tier-card="${tier}"]`).click();
  const field = page.locator("input[name=email]");
  if (email && (await field.inputValue()) !== email) await field.fill(email);
  const accept = page.locator(".tier-accept input[type=checkbox]");
  if (!(await accept.isChecked())) await accept.check();
  const posts = shop.posts.length;
  const [request] = await Promise.all([
    page.waitForRequest((r) => r.url() === origin + "/api/me/supporter/yookassa/checkout"),
    page.locator("[data-checkout-submit]").click(),
  ]);
  await page.waitForURL((url) => url.hostname === PAY_HOST);
  const id = new URL(page.url()).searchParams.get("orderId");
  return { id, request, posted: shop.posts.slice(posts) };
}
async function checkoutCookie(context) {
  return (await context.cookies(origin)).find((c) => c.name === "omoba-checkout") ?? null;
}
const firstStep = async (page) => (await page.locator("[data-step-tier]").count()) ? page.locator("[data-step-tier]").first().getAttribute("data-step-tier") : null;

try {
  await ready(apiOrigin + "/health/ready", api);
  await ready(origin + "/supporter", portal);
  // New charges need a successful refund scan; the reconciliation loop runs one at startup.
  await until(() => sql("SELECT coalesce(last_successful_at,0) FROM portal.supporter_yookassa_refund_scan WHERE key='refunds'") !== "0", "the first refund scan");

  // 1. A guest reads the tiers, prices and the offer without signing in.
  {
    const { context, page } = await newContext();
    await page.goto(origin + "/supporter");
    await page.locator("[data-hero-tiers]").waitFor();
    assert.deepEqual(await page.locator("[data-tier-card]").evaluateAll((cards) => cards.map((c) => c.getAttribute("data-tier-card"))),
      ["rose", "jade", "azure", "crimson", "prism_i", "prism_ii", "prism_iii", "custom"]);
    const prices = await page.locator("[data-price]").evaluateAll((items) => items.map((i) => [i.getAttribute("data-price"), i.textContent.replace(/\s/g, " ")]));
    assert.deepEqual(prices, [["100", "100 ₽"], ["250", "250 ₽"], ["500", "500 ₽"], ["1000", "1 000 ₽"], ["2500", "2 500 ₽"], ["5000", "5 000 ₽"], ["10000", "10 000 ₽"]]);
    assert.deepEqual(await page.locator("[data-tier-card] strong").allInnerTexts(), ["Роза", "Нефрит", "Лазурь", "Багрянец", "Призма I", "Призма II", "Призма III", "Своя сумма"]);
    // Colour swatches and CSS previews: solid tiers in their colour, Prism tiers shimmering at the game's speeds.
    assert.deepEqual(await page.locator("[data-tier-card] [data-swatch]").evaluateAll((s) => s.map((x) => x.getAttribute("data-swatch"))),
      ["#ff6bb8", "#1acc73", "#267aff", "#f21a2e", "prism", "prism", "prism"]);
    const animation = (id) => page.locator(`[data-tier-card="${id}"] [data-tier-aura]`).evaluate((e) => { const s = getComputedStyle(e); return [s.animationName, s.animationDuration]; });
    assert.deepEqual(await animation("prism_i"), ["tier-prism", "12.5s"]);
    assert.deepEqual(await animation("prism_ii"), ["tier-prism", "6.25s"]);
    assert.deepEqual(await animation("prism_iii"), ["tier-prism", "3.33s"]);
    assert.deepEqual(await animation("crimson"), ["none", "0s"]);
    assert.equal(await page.locator('[data-tier-card="prism_iii"] .tier-crown').count(), 1);
    assert.equal(await page.locator("[data-tier-stacking]").innerText().then((t) => /100\s₽ каждый месяц сохраняют уровень «Роза», 1\s000\s₽ каждый месяц — «Багрянец»/.test(t)), true);
    // A custom amount says which tier it reaches by itself; out-of-range amounts are refused.
    await page.locator("[data-tier-card=custom] .tier-custom").fill("3000");
    assert.equal(await page.locator("[data-summary-tier]").getAttribute("data-summary-tier"), "prism_i");
    await page.locator("[data-tier-card=custom] .tier-custom").fill("99");
    assert.match(await page.locator("[data-tier-summary]").innerText(), /от 100 до 100\s000\s₽/);
    await page.locator("[data-tier-card=custom] .tier-custom").fill("100001");
    assert.match(await page.locator("[data-tier-summary]").innerText(), /от 100 до 100\s000\s₽/);
    // No form for guests: sign-in leads back here; the offer opens without an account.
    assert.equal(await page.locator("input[name=email]").count(), 0);
    assert.equal(new URL(await page.locator("[data-tier-guest] a.button").getAttribute("href"), origin).searchParams.get("returnTo"), "/supporter");
    assert.doesNotMatch(await page.locator("body").innerText(), FORBIDDEN);
    await page.screenshot({ path: out + "/1-guest.png", fullPage: true });
    await page.locator("[data-tier-guest] [data-offer-link]").click();
    await page.waitForURL("**/offer");
    assert.match(await page.locator("h1").innerText(), /Публичная оферта/);
    // Without motion the rainbow stands still.
    const still = await newContext({ reducedMotion: "reduce" });
    await still.page.goto(origin + "/supporter");
    assert.equal(await still.page.locator('[data-tier-card="prism_iii"] [data-tier-aura]').evaluate((e) => getComputedStyle(e).animationName), "none");
    await still.context.close();
    for (const path of ["/supporters", "/offer"]) {
      await page.goto(origin + path);
      assert.doesNotMatch(await page.locator("body").innerText(), FORBIDDEN, path);
    }
    await context.close();
    checks.push("guests read the seven tiers with prices, swatches and previews, a custom amount, and the offer; Prism shimmers only with motion");
  }

  // 2. All seven tiers and a custom amount: each one pays through YooKassa and the tiers stack.
  const ada = register("Ада#2048");
  const one = await newContext();
  await signIn(one.page, ada);
  assert.equal(await firstStep(one.page), null, "a new player has no tier");
  const plan = [
    ["rose", 100, "rose"], ["jade", 250, "jade"], ["azure", 500, "azure"], ["crimson", 1000, "crimson"],
    ["prism_i", 2500, "prism_i"], ["prism_ii", 5000, "prism_ii"], ["prism_iii", 10000, "prism_iii"], [null, 1234, "prism_iii"],
  ];
  let paidIds = [];
  for (const [index, [tier, amount, expected]] of plan.entries()) {
    const { id, request, posted } = await checkout(one.page, tier ? { tier, email: "ada@example.ru" } : { custom: amount, email: "ada@example.ru" });
    // The browser sends the quote it showed; the key of the attempt is the portal server's.
    const body = request.postDataJSON();
    assert.deepEqual(body, { amount_rub: amount, receipt_email: "ada@example.ru", quote: { amount_minor: amount * 100, currency: "RUB", duration_days: 30, tier: tier ?? "crimson" }, offer_version: "1" });
    const cookie = await checkoutCookie(one.context);
    assert.ok(cookie?.httpOnly, "the attempt cookie is HttpOnly");
    const [bffKey] = cookie.value.split(".");
    assert.match(bffKey, /^[0-9a-f]{64}$/);
    assert.notEqual(bffKey, request.headers()["idempotency-key"], "the browser's key was forwarded");
    assert.equal(posted.length, 1);
    const post = posted[0];
    assert.ok(post.persisted, "the attempt and its Idempotence-Key were committed before the POST");
    assert.deepEqual(post.body.amount, { value: rubles(amount * 100), currency: "RUB" });
    assert.equal(post.body.capture, true);
    assert.deepEqual(post.body.confirmation, { type: "redirect", return_url: origin + "/supporter?paid=1" });
    assert.deepEqual(post.body.receipt, { customer: { email: "ada@example.ru" }, items: [{ description: "OMOBA — поддержка проекта (аура на 30 дней)", quantity: "1.00", amount: { value: rubles(amount * 100), currency: "RUB" }, vat_code: 1, payment_mode: "full_payment", payment_subject: "service" }] });
    assert.equal(paymentOf(post.key).id, id);
    const [stored, storedAmount, storedOffer] = sql(`SELECT idempotence_key,amount_minor,offer_version FROM portal.supporter_yookassa_attempts WHERE provider_payment_id='${id}'`).split("|");
    assert.deepEqual([stored, Number(storedAmount), storedOffer], [post.key, amount * 100, "1"]);
    pay(id);
    // Half of them settle by the webhook; the others when the return page re-reads them.
    if (index % 2 === 0) assert.deepEqual(await notify("payment.succeeded", { id, status: "succeeded" }), { status: 200, body: { status: "accepted" } });
    await one.page.goto(origin + "/supporter?paid=1");
    await one.page.locator("[data-return-state=succeeded]").waitFor();
    await until(async () => (await firstStep(one.page)) === expected, "tier " + expected + " after " + amount + " ₽");
    // The attempt is over: the next payment gets a new key.
    assert.equal(await checkoutCookie(one.context), null, "the finished attempt's key was kept");
    paidIds.push(id);
  }
  // The page drops ?paid=1 with router.replace once the payment settled; give it a moment.
  await until(async () => new URL(one.page.url()).pathname + new URL(one.page.url()).search === "/supporter", "the return state leaves ?paid=1");
  assert.equal(sql(`SELECT count(*) FROM portal.supporter_grants WHERE profile_id='${ada.profile}' AND provider='yookassa' AND revoked_at IS NULL`), "8");
  assert.equal(sql(`SELECT portal.supporter_points('${ada.profile}', extract(epoch from now())::bigint)`), String(100 + 250 + 500 + 1000 + 2500 + 5000 + 10000 + 1234));
  assert.equal(await one.page.locator("[data-payment=succeeded]").count(), 8);
  await one.page.screenshot({ path: out + "/2-prism-iii.png", fullPage: true });
  checks.push("all seven tier cards and a custom amount pay through the YooKassa stand-in with the frozen receipt, and the tier steps up from Rose to Prism III");

  // The aura choice: every style is open at Prism III; the choice reaches the database.
  await one.page.locator('[data-style="prism_iii"]').click();
  await one.page.getByRole("button", { name: "Применить в игре" }).click();
  await one.page.getByRole("status").filter({ hasText: "Аура выбрана" }).waitFor();
  assert.equal(sql(`SELECT aura FROM portal.supporter_preferences WHERE profile_id='${ada.profile}'`), "prism_iii");
  // Public recognition in RU: the opt-in and a public profile list the player on /supporters.
  await one.page.evaluate(async () => {
    const me = await (await fetch("/api/me")).json();
    const { version, ...settings } = me.settings;
    const csrf = (await (await fetch("/api/csrf")).json()).token;
    const response = await fetch("/api/me/settings", { method: "PATCH", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf, "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ ...settings, public_profile_enabled: true, expected_version: version }) });
    if (!response.ok) throw new Error("settings " + response.status);
  });
  await one.page.reload();
  // A controlled toggle: it changes once the Account API has saved the preference.
  await one.page.locator(".recognition-settings input[type=checkbox]").click();
  await one.page.getByRole("status").filter({ hasText: "Настройка публичной благодарности сохранена." }).waitFor();
  assert.equal(await one.page.locator(".recognition-settings input[type=checkbox]").isChecked(), true);
  {
    const { context, page } = await newContext();
    await page.goto(origin + "/supporters");
    const row = page.locator(".supporter-row").filter({ hasText: "Ада#2048" });
    await row.waitFor();
    assert.match(await row.innerText(), /1\s+Месяцев поддержки/);
    assert.doesNotMatch(await page.locator("body").innerText(), FORBIDDEN);
    await context.close();
  }
  checks.push("the aura choice reaches the game's preference, and /supporters lists the player in RU");

  // 3. A second player: quote mismatch → reload, a retried attempt keeps its key,
  //    the return page waits, a canceled payment, a partial refund.
  const boris = register("Борис#4096");
  const two = await newContext();
  let tampered = 0;
  await two.page.route((url) => url.pathname === "/api/me/supporter", async (route) => {
    if (route.request().method() !== "GET" || tampered++) return route.continue();
    const response = await route.fetch();
    const json = await response.json();
    json.yookassa.duration_days = 31; // the offer the page holds is no longer the server's
    return route.fulfill({ response, json });
  });
  await signIn(two.page, boris);
  await two.page.locator('[data-tier-card="azure"]').click();
  await two.page.locator("input[name=email]").fill("boris@example.ru");
  await two.page.locator(".tier-accept input[type=checkbox]").check();
  assert.match(await two.page.locator("[data-tier-summary]").innerText(), /аура на 31 дней/);
  const before = shop.posts.length, attempts = sql("SELECT count(*) FROM portal.supporter_yookassa_attempts");
  await two.page.locator("[data-checkout-submit]").click();
  await two.page.locator("[data-checkout-error]").filter({ hasText: "Цена или срок изменились" }).waitFor();
  assert.equal(shop.posts.length, before, "a stale quote reached YooKassa");
  assert.equal(sql("SELECT count(*) FROM portal.supporter_yookassa_attempts"), attempts, "a stale quote created an attempt");
  // The page reloaded the server's offer; confirming again pays.
  await until(async () => /аура на 30 дней/.test(await two.page.locator("[data-tier-summary]").innerText()), "the reloaded offer");
  const first = await checkout(two.page, { tier: "azure", email: "boris@example.ru" });
  const key = (await checkoutCookie(two.context)).value.split(".")[0];
  checks.push("a quote the server does not agree with answers 409 reload: nothing is posted, the page reloads the offer and the next press pays");

  // A retry of the same attempt (back from the payment page, same amount and e-mail) sends the same key.
  await two.page.goto(origin + "/supporter");
  const retry = await checkout(two.page, { tier: "azure", email: "boris@example.ru" });
  assert.equal(retry.id, first.id, "a retry made a second payment");
  assert.equal((await checkoutCookie(two.context)).value.split(".")[0], key);
  assert.ok(retry.posted.every((p) => p.key === key), "a retry posted with another key");
  assert.equal(sql(`SELECT count(*) FROM portal.supporter_yookassa_attempts WHERE profile_id='${boris.profile}'`), "1");
  checks.push("the BFF keeps the server-side Idempotency-Key across retries of one attempt: one attempt, one payment");

  // Back without paying: «Проверяем оплату…», five reads 1.5 s apart, then «Не оплачивайте повторно».
  const html = await (await fetch(origin + "/supporter?paid=1", { headers: { Cookie: (await two.context.cookies(origin)).map((c) => c.name + "=" + c.value).join("; "), "Accept-Language": "ru-RU" } })).text();
  assert.match(html, /data-return-state="checking"[\s\S]{0,200}Проверяем оплату…[\s\S]{0,200}Не оплачивайте повторно\./);
  const reads = [];
  const onRequest = (r) => { if (r.url() === origin + "/api/me/supporter" && r.method() === "GET") reads.push(Date.now()); };
  two.page.on("request", onRequest);
  const started = Date.now();
  await two.page.goto(origin + "/supporter?paid=1");
  await two.page.locator("[data-return-state=pending]").waitFor();
  assert.ok(Date.now() - started >= 6000, "the return page gave up early");
  await new Promise((r) => setTimeout(r, 2000)); // and it stops asking
  two.page.off("request", onRequest);
  assert.equal(reads.length, 5, "me/supporter reads while waiting: " + reads.length);
  for (let i = 1; i < reads.length; i++) assert.ok(reads[i] - reads[i - 1] >= 1400, "reads " + (i - 1) + "→" + i + " were " + (reads[i] - reads[i - 1]) + " ms apart");
  assert.match(await two.page.locator("[data-return-state]").innerText(), /Не оплачивайте повторно/);
  await two.page.screenshot({ path: out + "/3-return-pending.png", fullPage: true });
  checks.push("the return page shows «Проверяем оплату…», reads me/supporter 5 × 1.5 s, then says «Не оплачивайте повторно»");

  // The payment is canceled: the return page says so, and the next press is a new attempt.
  cancel(first.id);
  assert.deepEqual(await notify("payment.canceled", { id: first.id, status: "canceled" }), { status: 200, body: { status: "accepted" } });
  await two.page.goto(origin + "/supporter?paid=1");
  await two.page.locator("[data-return-state=canceled]").waitFor();
  assert.equal(await checkoutCookie(two.context), null);
  const second = await checkout(two.page, { tier: "azure", email: "boris@example.ru" });
  assert.notEqual(second.id, first.id);
  assert.notEqual(second.posted[0].key, first.posted[0].key);
  checks.push("a canceled payment ends its attempt; the next press creates a new one");

  // Paid, then 300 ₽ refunded: the grant keeps 200 points and the tier steps down to Rose.
  pay(second.id);
  await two.page.goto(origin + "/supporter?paid=1");
  await two.page.locator("[data-return-state=succeeded]").waitFor();
  await until(async () => (await firstStep(two.page)) === "azure", "Azure");
  assert.equal(await two.page.locator('[data-style="prism_i"]').isDisabled(), true, "Prism I is open at Azure");
  const refund = refundOf(second.id, 30000);
  assert.deepEqual(await notify("refund.succeeded", { id: refund.id, payment_id: second.id, status: "succeeded" }), { status: 200, body: { status: "accepted" } });
  await two.page.reload();
  await until(async () => (await firstStep(two.page)) === "rose", "Rose after the refund");
  assert.match(await two.page.locator("[data-payment=succeeded]").first().innerText(), /возвращено 300\s₽/);
  await two.page.screenshot({ path: out + "/4-refund.png", fullPage: true });
  assert.doesNotMatch(await two.page.locator("body").innerText(), FORBIDDEN);
  checks.push("a partial refund shows in the history and steps the tier down (Azure → Rose)");

  // Signed-out return: the page asks to sign in and not to pay again.
  {
    const { context, page } = await newContext();
    await page.goto(origin + "/supporter?paid=1");
    await page.locator("[data-return-state=signed_out]").waitFor();
    await context.close();
  }

  assert.equal(new Set(shop.posts.map((p) => p.key)).size, shop.keys.size, "one key per created payment");
  assert.ok(shop.posts.every((p) => p.persisted), "a POST without its persisted attempt");
  assert.deepEqual(external, [], "a request left loopback");
  assert.deepEqual(errors, []);
  await writeFile(out + "/result.json", JSON.stringify({ passed: true, checks, payments: shop.payments.size, limitations: [
    "YooKassa is a loopback stand-in; no real shop, payment page or fiscal receipt is exercised.",
    "Headless Chrome only; no visual review of the screenshots is claimed.",
  ] }, null, 2));
  console.log("PASS Hero tiers through YooKassa end to end:\n- " + checks.join("\n- "));
  await one.context.close();
  await two.context.close();
} catch (error) {
  for (const child of children) console.error("--- " + child.name + " log\n" + child.log.slice(-6000));
  throw error;
} finally {
  await browser.close();
  stand.close();
  for (const child of children) { try { process.kill(-child.pid, "SIGTERM"); } catch {} }
}
