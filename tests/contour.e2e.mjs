// Contour guard against the real standalone build. Run after `npm run build`
// (production contour) and again after a dev build:
//   OMOBA_CONTOUR=dev OMOBA_PORTAL_ORIGIN=https://app.dev.omoba.io OMOBA_ACCOUNT_MODE=disabled npm run build
//   node tests/contour.e2e.mjs
// Reads the contour the build was made for, then checks that the build serves in
// that contour (headers, robots.txt, DEV badge and title, Studio links), refuses
// requests under the other contour's host, and refuses to serve in the other
// contour or with a wrong switch. Only loopback services are contacted; hosted
// origins appear as link text or as a Host header sent to loopback, never as a
// request target.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer, request as httpRequest } from "node:http";

const required = JSON.parse(await readFile(new URL("../.next/required-server-files.json", import.meta.url), "utf8"));
const built = required.config?.env?.OMOBA_BUILT_CONTOUR;
assert.ok(built === "production" || built === "dev", "the build carries no contour; run npm run build first");
const other = built === "production" ? "dev" : "production";
const STUDIO = { production: "https://studio.ekza.io", dev: "https://studio.dev.ekza.io" };
const HOST = { production: "app.omoba.io", dev: "app.dev.omoba.io" };

// A Registry double with an empty, valid catalogue; nothing else is reachable.
const registry = createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  if (req.method === "GET" && url.pathname === "/v2/assets" && url.search === "?project=omoba") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ schema: "ekza.asset.catalog.v2", count: 0, items: [] }));
  }
  res.writeHead(404);
  res.end();
});
await new Promise((resolve) => registry.listen(0, "127.0.0.1", resolve));
const registryOrigin = "http://127.0.0.1:" + registry.address().port;

const clean = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("OMOBA_") && !key.startsWith("VERCEL")));
let nextPort = 40700 + Math.floor(Math.random() * 200);
function local(contour, port) {
  return {
    OMOBA_CONTOUR: contour,
    OMOBA_ALLOW_INSECURE_LOCAL: "1",
    OMOBA_PORTAL_ORIGIN: "http://127.0.0.1:" + port,
    OMOBA_ACCOUNT_MODE: "disabled",
    OMOBA_REGISTRY_URL: registryOrigin,
  };
}

/** GET on loopback with an explicit Host header (fetch does not allow one). */
function get(port, path, host) {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: "127.0.0.1", port, path, method: "GET", headers: host ? { host } : {}, timeout: 8000 }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
}

async function run(name, makeEnv, body) {
  const port = nextPort++;
  // Own process group: start.mjs and its next-server child are stopped together.
  const server = spawn(process.execPath, ["scripts/start.mjs"], {
    env: { ...clean, ...makeEnv(port), PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  let log = "";
  server.stdout.on("data", (chunk) => (log += chunk));
  server.stderr.on("data", (chunk) => (log += chunk));
  const origin = "http://127.0.0.1:" + port;
  try {
    let first;
    for (let attempt = 0; attempt < 80 && !first; attempt++) {
      if (server.exitCode !== null) break;
      try {
        // A request that arrives while a refused server is still preparing never
        // gets an answer; later ones get a 500.
        first = await fetch(origin + "/creators", { signal: AbortSignal.timeout(4000) });
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    await body({ origin, port, first, log: () => log });
    console.log("ok -", name);
  } catch (error) {
    console.error("not ok -", name, "\n" + log);
    throw error;
  } finally {
    await stop(server);
  }
}

/** Graceful shutdown can wait on idle keep-alive sockets; escalate after a grace period. */
async function stop(server) {
  const exited = new Promise((resolve) =>
    server.exitCode !== null || server.signalCode !== null ? resolve() : server.once("exit", resolve),
  );
  const signal = (name) => {
    try {
      process.kill(-server.pid, name);
    } catch {}
  };
  signal("SIGTERM");
  const timer = setTimeout(() => signal("SIGKILL"), 3000);
  await exited;
  clearTimeout(timer);
  signal("SIGKILL");
}

async function refused(response, log, pattern) {
  // Next keeps the process up but answers nothing: every request fails.
  assert.ok(response, "server never answered");
  assert.equal(response.status, 500);
  assert.ok(!/data-contour-badge|studio\.(dev\.)?ekza\.io\/studio/.test(await response.text()), "a refused server rendered a page");
  for (let i = 0; i < 20 && !pattern.test(log()); i++) await new Promise((resolve) => setTimeout(resolve, 100));
  assert.match(log(), pattern);
}

try {
  await run(`a ${built} build serves in its own contour`, (port) => local(built, port), async ({ origin, port, first, log }) => {
    assert.ok(first, "server did not start");
    assert.equal(first.status, 200);
    const robots = first.headers.get("x-robots-tag");
    const html = await first.text();
    if (built === "dev") {
      assert.equal(robots, "noindex, nofollow");
      assert.ok(/<span class="contour-badge" data-contour-badge="dev"[^>]*>DEV<\/span>/.test(html), "DEV badge missing");
      assert.ok(/<title>DEV · /.test(html), "DEV title prefix missing");
    } else {
      assert.equal(robots, null);
      // The stylesheet is inlined in both contours; the element is dev-only.
      assert.ok(!html.includes("data-contour-badge"), "DEV badge rendered in production");
      assert.ok(!/<title>DEV/.test(html), "DEV title in production");
    }
    // Studio links are the contour's own; the other contour's Studio never appears.
    assert.ok(html.includes(STUDIO[built] + "/studio?view=new"), "contour Studio link missing");
    assert.ok(!html.includes(STUDIO[other]), "other contour's Studio linked");
    const market = await fetch(origin + "/market");
    assert.equal(market.status, 200);
    assert.equal(market.headers.get("x-robots-tag"), robots);
    const page = await market.text();
    assert.ok(page.includes(STUDIO[built] + "/studio?view=new"), "market Studio link missing");
    assert.ok(!page.includes(STUDIO[other]), "market links the other contour's Studio");
    assert.equal(/data-contour-badge="dev"/.test(page), built === "dev");
    // Headers cover API routes and static files too.
    const api = await fetch(origin + "/api/ekza/csrf");
    assert.equal(api.status, 200);
    assert.equal(api.headers.get("x-robots-tag"), robots);
    const icon = await fetch(origin + "/brand/omoba-logo.png");
    assert.equal(icon.status, 200);
    assert.equal(icon.headers.get("x-robots-tag"), robots);
    // robots.txt: disallow everything in dev; production publishes none.
    const robotsTxt = await fetch(origin + "/robots.txt");
    if (built === "dev") {
      assert.equal(robotsTxt.status, 200);
      assert.match(robotsTxt.headers.get("content-type") || "", /^text\/plain/);
      assert.match(await robotsTxt.text(), /^User-Agent: \*\nDisallow: \/\n/i);
      assert.equal(robotsTxt.headers.get("x-robots-tag"), robots);
    } else {
      assert.equal(robotsTxt.status, 404);
      await robotsTxt.arrayBuffer();
    }
    // Its own public host is served; the other contour's host is refused, pages and BFFs alike.
    const own = await get(port, "/creators", HOST[built]);
    assert.equal(own.status, 200, "own host refused");
    const foreign = await get(port, "/creators", HOST[other]);
    assert.equal(foreign.status, 500, "other contour's host served a page");
    assert.ok(!foreign.body.includes("data-contour-badge") && !/studio\.(dev\.)?ekza\.io\/studio/.test(foreign.body), "refused host rendered a page");
    for (const path of ["/api/ekza/csrf", "/api/me"]) {
      const bff = await get(port, path, HOST[other]);
      assert.equal(bff.status, 503, path);
      assert.deepEqual(JSON.parse(bff.body), { code: "configuration_unavailable" }, path);
      assert.equal(bff.headers["set-cookie"], undefined, path + " set a cookie under the other host");
    }
    for (let i = 0; i < 20 && !/request host app\.(dev\.)?omoba\.io is a/.test(log()); i++) await new Promise((resolve) => setTimeout(resolve, 100));
    assert.match(log(), new RegExp(`OMOBA contour mismatch, refusing to serve \\(fail closed\\): request host ${HOST[other].replace(/\./g, "\\.")}`));
  });

  await run(`a ${built} build refuses to serve in the ${other} contour`, (port) => local(other, port), async ({ first, log }) =>
    refused(first, log, new RegExp(`OMOBA contour mismatch.*made for OMOBA_CONTOUR=${built} but runs with OMOBA_CONTOUR=${other}`)),
  );

  await run("an unknown contour refuses to serve", (port) => ({ ...local(built, port), OMOBA_CONTOUR: "prod" }), async ({ first, log }) =>
    refused(first, log, /OMOBA_CONTOUR must be "production" or "dev"/),
  );

  if (built === "dev")
    await run("dev refuses the production Studio", (port) => ({ ...local("dev", port), OMOBA_STUDIO_URL: STUDIO.production }), async ({ first, log }) =>
      refused(first, log, /OMOBA_STUDIO_URL: Studio URL https:\/\/studio\.ekza\.io is a production origin/),
    );
  else
    await run("production refuses a dev-contour Studio", (port) => ({ ...local("production", port), OMOBA_STUDIO_URL: STUDIO.dev }), async ({ first, log }) =>
      refused(first, log, /OMOBA_STUDIO_URL names the dev-contour host studio\.dev\.ekza\.io/),
    );
  console.log(`contour e2e passed for a ${built} build`);
} finally {
  registry.close();
}
