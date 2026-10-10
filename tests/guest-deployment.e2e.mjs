// Self-contained production smoke: no real account service or credentials.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
const out = ".agent/tasks/VERCEL-PREP-20261010";
await mkdir(out, { recursive: true });
let upstreamCalls = 0;
const trap = createServer((_req, res) => {
  upstreamCalls++;
  res.writeHead(500);
  res.end("Unexpected account request");
});
await new Promise((resolve) => trap.listen(0, "127.0.0.1", resolve));
const apiOrigin = "http://127.0.0.1:" + trap.address().port;
const port = 3013,
  origin = "http://127.0.0.1:" + port;
const server = spawn(process.execPath, ["scripts/start.mjs"], {
  env: {
    ...process.env,
    PORT: String(port),
    OMOBA_PORTAL_ORIGIN: origin,
    OMOBA_ALLOW_INSECURE_LOCAL: "1",
    OMOBA_ACCOUNT_API_URL: apiOrigin,
    OMOBA_ACCOUNT_MODE: "disabled",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "";
server.stdout.on("data", (chunk) => (serverLog += chunk));
server.stderr.on("data", (chunk) => (serverLog += chunk));
let browser;
try {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null)
      throw new Error("Guest server exited: " + serverLog);
    try {
      if ((await fetch(origin + "/workshop")).ok) break;
    } catch {}
    if (attempt === 59)
      throw new Error("Guest server did not start: " + serverLog);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const root = await fetch(origin + "/", { redirect: "manual" });
  assert.equal(root.status, 307);
  assert.equal(root.headers.get("location"), "/workshop");
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  // Stale cookies must not trigger a server fetch or revive disabled accounts.
  await context.addCookies([
    {
      name: "omoba-session",
      value: "a".repeat(64),
      url: origin,
      httpOnly: true,
    },
  ]);
  const page = await context.newPage(),
    errors = [],
    apiRequests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/"))
      apiRequests.push(request.url());
  });
  await page.goto(origin + "/");
  await page.waitForURL("**/workshop");
  await page.getByText(/Valid edits recover automatically/).waitFor();
  const headingCopy = await page.locator(".workshop-heading").innerText();
  assert.match(headingCopy, /Keep a browser draft, download the build/);
  assert.doesNotMatch(headingCopy, /save it privately to your account/);
  await page
    .getByText("Guest prototype · account service is not connected", {
      exact: true,
    })
    .waitFor();
  assert.equal(
    await page
      .getByRole("link", { name: "Sign in with game account ↗", exact: true })
      .count(),
    0,
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Refresh account connection", exact: true })
      .count(),
    0,
  );
  await page
    .getByLabel("Build name", { exact: true })
    .fill("Public guest smoke");
  await page
    .getByRole("button", { name: "Save browser draft", exact: true })
    .click();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: /Download build JSON/ }).click();
  await (await pending).saveAs(out + "/guest-build.json");
  assert.equal(
    JSON.parse(await readFile(out + "/guest-build.json", "utf8")).name,
    "Public guest smoke",
  );
  assert.equal(
    await page
      .locator(".workshop-layout")
      .evaluate((el) => getComputedStyle(el).display),
    "grid",
  );
  await page
    .locator("#workshop-account")
    .evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.screenshot({
    path: out + "/guest-deployment.png",
    animations: "disabled",
  });
  for (const path of ["/login", "/me"]) {
    await page.goto(origin + path);
    await page
      .getByRole("heading", {
        name: /Аккаунты пока недоступны|Accounts are not connected yet/,
      })
      .waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Получить код", exact: true })
        .count(),
      0,
    );
    await page
      .getByRole("link", { name: /Открыть конструктор|Open class workshop/ })
      .click();
    await page.waitForURL("**/workshop");
  }
  await page.goto(origin + "/creators");
  await page.getByRole("heading", { name: "The asset library" }).waitFor();
  assert.equal(
    await page
      .getByRole("link", { name: "Player portal", exact: true })
      .getAttribute("href"),
    "/me",
  );
  assert.deepEqual(apiRequests, []);
  for (const [path, method] of [
    ["me", "GET"],
    ["csrf", "GET"],
    ["auth/pairings", "POST"],
    ["me/class-builds", "POST"],
  ]) {
    const response = await fetch(origin + "/api/" + path, { method });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, "account_service_disabled");
    assert.equal(response.headers.get("set-cookie"), null);
  }
  assert.equal((await fetch(origin + "/api/not-allowed")).status, 404);
  assert.equal(upstreamCalls, 0);
  assert.deepEqual(errors, []);
  await writeFile(
    out + "/evidence.json",
    JSON.stringify(
      {
        passed: true,
        viewport: "1440x1000",
        upstreamCalls,
        browserApiRequests: apiRequests.length,
        checks: [
          "root redirect",
          "stale session ignored",
          "truthful disabled account/login UI",
          "browser draft/download",
          "public gallery",
          "BFF503 without cookies or upstream",
          "production CSS",
        ],
      },
      null,
      2,
    ) + "\n",
  );
  console.log("PASS disabled-account production smoke; upstream calls: 0");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  trap.close();
  await writeFile(out + "/server.log", serverLog);
}
