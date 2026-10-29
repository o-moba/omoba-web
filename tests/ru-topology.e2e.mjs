// The RU host topology (LR-02) end to end, without a browser: the real RU portal
// build with the production environment of the game repo's
// ops/vps/ru/portal.env.example (production contour, https://omoba.ru, the
// loopback Account API, OMOBA_TRUST_LOOPBACK_PROXY=1, no ingress key), the real
// Account API on loopback with OMOBA_TRUST_LOOPBACK_PROXY=1, a disposable
// PostgreSQL and a stand-in for Caddy (Caddyfile.ru).
//
// The stand-in terminates no TLS. Like `header_up X-Real-IP {remote_host}` it
// overwrites X-Real-IP with the client's address on every request it passes, and
// account.omoba.ru passes only the native POST routes and health, answering 403 to the
// rest. Every peer is on loopback here, so each stand-in listener plays one client
// address: players A and B on omoba.ru, the game on account.omoba.ru. With
// OMOBA_CADDYFILE_RU=<game repo>/ops/vps/ru/Caddyfile.ru the native list is read
// from the real file, and its omoba.ru and account.omoba.ru blocks are checked.
//
//   OMOBA_MARKET=ru OMOBA_VKID_CLIENT_ID=51234567 npm run build
//   OMOBA_ACCOUNT_API_BIN=…/omoba-account-api \           # built with OMOBA_MARKET=ru
//   OMOBA_E2E_DATABASE_URL=postgres://owner@127.0.0.1:55581/ru_topology_e2e \
//   OMOBA_PSQL=/Applications/Postgres.app/Contents/Versions/18/bin/psql \
//   npm run test:ru-topology
//
// OMOBA_E2E_API_MARKET=global accepts a global Account API build (no VK ID): the VK
// callback still reaches POST /v1/auth/social/vk and its per-IP limit, but VK cannot
// answer, so the sign-in itself is not exercised. The database must be a disposable
// loopback database: the script migrates it. The result goes to .agent/ru-topology/.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHmac, createPrivateKey, createPublicKey, randomBytes, sign } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer, request as httpRequest } from "node:http";

const required = JSON.parse(await readFile(new URL("../.next/required-server-files.json", import.meta.url), "utf8"));
assert.equal(required.config?.env?.OMOBA_BUILT_MARKET, "ru (ekza off, supporter off, vk_sign_in on)", "run after a ru build");
const binary = process.env.OMOBA_ACCOUNT_API_BIN, database = process.env.OMOBA_E2E_DATABASE_URL;
assert.ok(binary && database, "set OMOBA_ACCOUNT_API_BIN and OMOBA_E2E_DATABASE_URL");
const db = new URL(database);
assert.ok(db.hostname === "127.0.0.1" && db.port === "55581", "only the disposable loopback cluster on 55581");
const apiMarket = process.env.OMOBA_E2E_API_MARKET || "ru";
assert.ok(["ru", "global"].includes(apiMarket), "OMOBA_E2E_API_MARKET is ru or global");
const vkEnabled = apiMarket === "ru";
const psql = process.env.OMOBA_PSQL || "psql";
const PORTAL = "https://omoba.ru", CLIENT_ID = "51234567", out = ".agent/ru-topology";
const IP = { a: "203.0.113.10", b: "198.51.100.20", game: "192.0.2.30", spoof: "6.6.6.6" };
await mkdir(out, { recursive: true });

// --- Caddyfile.ru: the account.omoba.ru native allowlist and the omoba.ru X-Real-IP overwrite.
let native = ["/v1/auth/pairings/lookup", "/v1/auth/pairings/approve", "/v1/auth/pairings/deny", "/v1/auth/devices/create",
  "/v1/auth/devices/status", "/v1/auth/devices/recover", "/v1/auth/devices/complete", "/v1/auth/social/link"];
let caddyfile = null;
if (process.env.OMOBA_CADDYFILE_RU) {
  caddyfile = await readFile(process.env.OMOBA_CADDYFILE_RU, "utf8");
  const block = (host) => {
    // A site address starts a line, so the portal `omoba.ru` never matches inside `account.omoba.ru`.
    const start = caddyfile.search(new RegExp("^" + host.replace(/\./g, "\\.") + " \\{", "m"));
    assert.ok(start >= 0, host + " block missing");
    let depth = 0;
    for (let i = caddyfile.indexOf("{", start); i < caddyfile.length; i++) {
      if (caddyfile[i] === "{") depth++;
      if (caddyfile[i] === "}" && --depth === 0) return caddyfile.slice(start, i + 1);
    }
    throw new Error(host + " block unterminated");
  };
  const account = block("account.omoba.ru"), app = block("omoba.ru");
  native = account.match(/@native\s*\{[^}]*?\bpath\s+([^\n]+)/)?.[1].trim().split(/\s+/) ?? [];
  assert.ok(native.length >= 8, "account.omoba.ru @native paths");
  assert.ok(!/X-Omoba-Portal-Key\s+\S/.test(account), "account.omoba.ru serves no portal-key route: the portal calls the loopback API");
  assert.match(app, /reverse_proxy\s+127\.0\.0\.1:3010\s*\{[^}]*header_up\s+X-Real-IP\s+\{remote_host\}/, "omoba.ru overwrites X-Real-IP");
}

// --- VK ID stand-in: code `user-<id>` is VK user <id>.
const vkCalls = [];
const vk = createServer(async (req, res) => {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const form = Object.fromEntries(new URLSearchParams(raw));
  vkCalls.push({ path: req.url, form });
  const send = (status, value) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(value)); };
  if (req.url === "/oauth2/auth") {
    const id = form.code?.startsWith("user-") ? form.code.slice(5) : null;
    const ok = form.client_id === CLIENT_ID && form.redirect_uri === PORTAL + "/api/auth/vk/callback" && !("client_secret" in form);
    return ok && id ? send(200, { access_token: "token-" + id, expires_in: 3600 }) : send(400, { error: "invalid_grant" });
  }
  if (req.url === "/oauth2/user_info") {
    const id = form.access_token?.startsWith("token-") ? form.access_token.slice(6) : null;
    return id ? send(200, { user: { user_id: id, first_name: "Иван", last_name: "Петров" } }) : send(401, { error: "invalid_token" });
  }
  send(404, {});
});

// --- Caddy stand-in: one listener per client address.
const seen = [];
function ingress(name, client, upstream, host, allow = () => true) {
  return createServer((req, res) => {
    const record = (status) => seen.push({ name, method: req.method, path: req.url.split("?")[0], status });
    if (!allow(req)) { record(403); res.writeHead(403, { "Content-Type": "text/plain" }); return res.end("Forbidden"); }
    const headers = { ...req.headers, host, "x-real-ip": client, "x-forwarded-for": client, "x-forwarded-proto": "https", "x-forwarded-host": host };
    const forward = httpRequest({ host: "127.0.0.1", port: upstream(), method: req.method, path: req.url, headers }, (reply) => {
      record(reply.statusCode);
      res.writeHead(reply.statusCode, reply.headers);
      reply.pipe(res);
    });
    forward.on("error", () => { record(502); res.writeHead(502); res.end(); });
    req.pipe(forward);
  });
}
const apiPort = 40600 + Math.floor(Math.random() * 200), portalPort = 3200 + Math.floor(Math.random() * 200);
const nativeRoute = (req) => (req.method === "POST" && native.includes(req.url.split("?")[0]))
  || (req.method === "GET" && ["/health/live", "/health/ready"].includes(req.url.split("?")[0]));
const listeners = {
  a: ingress("omoba.ru A", IP.a, () => portalPort, "omoba.ru"),
  b: ingress("omoba.ru B", IP.b, () => portalPort, "omoba.ru"),
  game: ingress("account.omoba.ru game", IP.game, () => apiPort, "account.omoba.ru", nativeRoute),
};
for (const server of [vk, ...Object.values(listeners)]) await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const at = (name) => "http://127.0.0.1:" + listeners[name].address().port;

// --- The Account API (portal role, loopback, trusted loopback proxy) and the portal.
const hex32 = () => randomBytes(32).toString("hex");
const secret = hex32();
const clean = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("OMOBA_") && !key.startsWith("VERCEL")));
execFileSync(binary, ["migrate"], { env: { ...clean, OMOBA_DATABASE_URL: database }, stdio: "inherit" });
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
  OMOBA_DATABASE_URL: database, OMOBA_PORTAL_ORIGIN: PORTAL, OMOBA_PORTAL_SECRET: secret,
  OMOBA_ACCOUNT_BIND: "127.0.0.1:" + apiPort, OMOBA_TRUST_LOOPBACK_PROXY: "1",
  ...(vkEnabled ? { OMOBA_VKID_CLIENT_ID: CLIENT_ID, OMOBA_SOCIAL_SECRET: hex32(), OMOBA_VKID_LOCAL_FIXTURE_ORIGIN: "http://127.0.0.1:" + vk.address().port } : {}),
}, "account-api");
// Exactly the RU host's portal settings, except the loopback API port of this run.
const portal = start(process.execPath, ["scripts/start.mjs"], {
  OMOBA_MARKET: "ru", OMOBA_PORTAL_ORIGIN: PORTAL, OMOBA_ACCOUNT_MODE: "enabled",
  OMOBA_ACCOUNT_API_URL: "http://127.0.0.1:" + apiPort, OMOBA_TRUST_LOOPBACK_PROXY: "1",
  OMOBA_VKID_CLIENT_ID: CLIENT_ID, PORT: String(portalPort),
}, "portal");
async function ready(url, child) {
  for (let i = 0; i < 160; i++) {
    if (child.exitCode !== null) throw new Error(child.name + " exited:\n" + child.log);
    try { if ((await fetch(url, { signal: AbortSignal.timeout(2000) })).status < 500) return; } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(child.name + " did not start:\n" + child.log);
}

// --- A cookie-keeping client behind one stand-in listener; it always tries to spoof X-Real-IP.
function client(listener) {
  const jar = new Map();
  return {
    jar,
    async call(path, { method = "GET", body, headers = {} } = {}) {
      const cookie = [...jar].map(([k, v]) => k + "=" + v).join("; ");
      const response = await fetch(at(listener) + path, {
        method, redirect: "manual",
        headers: { "X-Real-IP": IP.spoof, ...(cookie ? { Cookie: cookie } : {}),
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      for (const line of response.headers.getSetCookie()) {
        const [pair, ...attributes] = line.split(/;\s*/);
        const name = pair.slice(0, pair.indexOf("=")), value = pair.slice(pair.indexOf("=") + 1);
        if (!value || attributes.some((a) => /^max-age=0$/i.test(a))) jar.delete(name); else jar.set(name, value);
      }
      const text = await response.text();
      let json = null;
      try { json = JSON.parse(text); } catch {}
      return { status: response.status, location: response.headers.get("location"), json };
    },
    async mutate(path, body = {}) {
      const csrf = await this.call("/api/csrf");
      assert.equal(csrf.status, 200);
      return this.call(path, { method: "POST", body, headers: { Origin: PORTAL, "X-CSRF-Token": csrf.json.token } });
    },
  };
}

// --- The game: an install key that owns a profile, and its signed native requests.
const keyOf = (seed) => createPrivateKey({ key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), seed]), format: "der", type: "pkcs8" });
const publicOf = (key) => createPublicKey(key).export({ format: "der", type: "spki" }).subarray(-32).toString("hex");
const game = client("game");
const sql = (query) => execFileSync(psql, [database, "-v", "ON_ERROR_STOP=1", "-qtAc", query]).toString().trim();
// The Account API keys each limit by HMAC(portal secret, [scope, identity]) per minute (account-api/src/crypto.rs `mac`).
const hits = (scope, identity) => {
  const hash = createHmac("sha256", Buffer.from(secret, "hex")).update(JSON.stringify([scope, identity])).digest("hex");
  return sql(`SELECT coalesce(max(hits),0) FROM portal.rate_limits WHERE identity_hash='${hash}'`);
};

const checks = [], limitations = ["Caddy is a stand-in: TLS and the real Caddy binary are exercised only on the RU host (release.py preflight --market ru)."];
if (!vkEnabled) limitations.push("Global Account API build: VK ID cannot answer, so VK sign-in success is not exercised; the callback, its route and its per-IP limit are.");
if (!caddyfile) limitations.push("OMOBA_CADDYFILE_RU unset: the stand-in uses the built-in RU native list instead of the real Caddyfile.ru.");
try {
  await ready("http://127.0.0.1:" + apiPort + "/health/ready", api);
  await ready(at("a") + "/login", portal);
  const a = client("a");

  // 1. account.omoba.ru stays closed to everything but native routes and health.
  assert.equal((await game.call("/health/ready")).status, 200);
  for (const [method, path] of [["GET", "/v1/me"], ["POST", "/v1/auth/pairings"], ["POST", "/v1/auth/social/vk"], ["GET", "/v1/releases"]])
    assert.equal((await game.call(path, { method, ...(method === "POST" ? { body: {} } : {}) })).status, 403, method + " " + path);
  const closedProbes = seen.length;
  checks.push("account.omoba.ru answers 403 to every portal route; only native routes and health pass");

  // 2. Through omoba.ru the portal reaches the loopback API: no session is 401, downloads are 200.
  const anonymous = await a.call("/api/me");
  assert.equal(anonymous.status, 401, JSON.stringify(anonymous.json));
  const releases = await a.call("/api/releases");
  assert.equal(releases.status, 200, JSON.stringify(releases.json));
  assert.ok(Array.isArray(releases.json.releases));
  checks.push("GET /api/me without a session is the API's 401 and GET /api/releases is 200 (what release.py preflight checks)");

  // 3. Web pairing: the browser asks for a code, the game approves it natively, the browser has a session.
  const key = keyOf(randomBytes(32)), profile = hex32();
  sql(`INSERT INTO career_profiles(profile_id,nickname) VALUES('${profile}','Лиса'); INSERT INTO career_keys(public_key,profile_id) VALUES('${publicOf(key)}','${profile}');`);
  const pairing = await a.mutate("/api/auth/pairings");
  assert.equal(pairing.status, 200, JSON.stringify(pairing.json));
  const lookup = await game.call("/v1/auth/pairings/lookup", { method: "POST", body: { code: pairing.json.code, public_key: publicOf(key) } });
  assert.equal(lookup.status, 200, JSON.stringify(lookup.json));
  const c = lookup.json.challenge;
  assert.equal(c.origin, PORTAL);
  const tuple = ["omoba.web.pair.v1", c.origin, c.pair_id, c.nonce, c.public_key, c.browser_binding, "approve", c.scopes, c.expires_at];
  const approve = await game.call("/v1/auth/pairings/approve", { method: "POST", body: { challenge: c, decision: "approve", signature: sign(null, Buffer.from(JSON.stringify(tuple)), key).toString("hex") } });
  assert.equal(approve.status, 200, JSON.stringify(approve.json));
  const complete = await a.mutate("/api/auth/pairings/complete");
  assert.equal(complete.status, 200, JSON.stringify(complete.json));
  assert.ok(a.jar.has("__Host-omoba-session"), "an HTTPS portal session cookie");

  // 4. GET /api/me and POST /api/me/recovery-codes (a fresh session) work end to end.
  const me = await a.call("/api/me");
  assert.equal(me.status, 200, JSON.stringify(me.json));
  assert.equal(me.json.profile.profile_id, profile);
  const codes = await a.mutate("/api/me/recovery-codes");
  assert.equal(codes.status, 200, JSON.stringify(codes.json));
  assert.equal(codes.json.recovery_codes.length, 8);
  assert.ok(codes.json.recovery_codes.every((code) => /^[a-f0-9]{64}$/.test(code)));
  checks.push("web pairing, GET /api/me (200) and POST /api/me/recovery-codes (8 codes) through omoba.ru and the loopback API");

  // 5. 31 VK callbacks from A within one minute: the 31st is limited, B is not.
  const second = Math.floor(Date.now() / 1000) % 60;
  if (second > 35) await new Promise((r) => setTimeout(r, (61 - second) * 1000));
  const minute = Math.floor(Date.now() / 60000);
  async function vkCallback(listener, n) {
    const browser = client(listener);
    const started = await browser.call("/api/auth/vk/start?method=vkid");
    assert.equal(started.status, 302);
    const authorize = new URL(started.location);
    assert.equal(authorize.origin + authorize.pathname, "https://id.vk.ru/authorize");
    assert.equal(authorize.searchParams.get("redirect_uri"), PORTAL + "/api/auth/vk/callback");
    const query = new URLSearchParams({ code: "user-" + (700000 + n), state: authorize.searchParams.get("state"), device_id: "vk-device-" + n, type: "code_v2" });
    const back = await browser.call("/api/auth/vk/callback?" + query);
    assert.equal(back.status, 302);
    return { location: new URL(back.location, PORTAL), jar: browser.jar };
  }
  const results = [];
  for (let n = 0; n < 31; n++) results.push(await vkCallback("a", n));
  const fromB = await vkCallback("b", 99);
  assert.equal(Math.floor(Date.now() / 60000), minute, "the 32 callbacks ran within one minute");
  for (const [n, result] of results.slice(0, 30).entries()) {
    assert.notEqual(result.location.searchParams.get("signin"), "rate_limited", "callback " + (n + 1) + " from A");
    if (vkEnabled) assert.equal(result.location.pathname + result.location.search, "/me", "callback " + (n + 1) + " from A signs up");
  }
  assert.equal(results[30].location.searchParams.get("signin"), "rate_limited", "the 31st callback from A is limited");
  assert.notEqual(fromB.location.searchParams.get("signin"), "rate_limited", "B is not limited by A");
  if (vkEnabled) {
    assert.equal(fromB.location.pathname + fromB.location.search, "/me");
    assert.ok(fromB.jar.has("__Host-omoba-social"), "B received its VK registration ticket");
    assert.equal(vkCalls.filter((call) => call.path === "/oauth2/auth").length, 31, "30 callbacks from A and 1 from B reached VK through POST /v1/auth/social/vk");
  }
  // The API counted A and B separately, never the loopback peer or a client-supplied address.
  assert.equal(hits("social-sign-in", IP.a), "31");
  assert.equal(hits("social-sign-in", IP.b), "1");
  for (const scope of ["social-sign-in", "pair-create", "pair-requests"])
    for (const identity of ["127.0.0.1", "::1", IP.spoof]) assert.equal(hits(scope, identity), "0", scope + " " + identity);
  assert.equal(hits("pair-create", IP.a), "1");
  assert.ok(Number(hits("pair-requests", IP.game)) >= 2, "native pairing requests are keyed by the game's address");
  checks.push("31 VK callbacks from A in one minute: the 31st is rate_limited, B still " + (vkEnabled ? "signs up" : "reaches POST /v1/auth/social/vk") + "; limits keyed by the client address, never 127.0.0.1 or a spoofed X-Real-IP");

  // 6. No 403 anywhere except the deliberate probes of step 1.
  const refused = seen.slice(closedProbes).filter((entry) => entry.status === 403);
  assert.deepEqual(refused, [], "no 403 through omoba.ru or for native routes");
  checks.push("no 403 on any of " + (seen.length - closedProbes) + " requests through the ingress stand-in");

  await writeFile(out + "/result.json", JSON.stringify({ passed: true, api_market: apiMarket, checks, limitations }, null, 2));
  console.log("PASS RU topology end to end (" + apiMarket + " Account API):\n- " + checks.join("\n- ") + "\nLimitations:\n- " + limitations.join("\n- "));
} catch (error) {
  for (const child of children) console.error("--- " + child.name + " log\n" + child.log.slice(-4000));
  throw error;
} finally {
  for (const server of [vk, ...Object.values(listeners)]) server.close();
  for (const child of children) { try { process.kill(-child.pid, "SIGTERM"); } catch {} }
}
