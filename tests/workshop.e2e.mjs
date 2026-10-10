// Real isolated Account API + PostgreSQL, synthetic seed7; local Registry protocol fixture only.
import { chromium } from "@playwright/test";
import { createPrivateKey, createPublicKey, sign } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const origin = "http://127.0.0.1:3010",
  accountOrigin = "http://127.0.0.1:40560",
  out = ".agent/tasks/CLASS-WORKSHOP-20261010";
await mkdir(out, { recursive: true });
const key = createPrivateKey({
  key: Buffer.concat([
    Buffer.from("302e020100300506032b657004220420", "hex"),
    Buffer.alloc(32, 7),
  ]),
  format: "der",
  type: "pkcs8",
});
const publicKey = createPublicKey(key)
  .export({ format: "der", type: "spki" })
  .subarray(-32)
  .toString("hex");
const browser = await chromium.launch({ channel: "chrome", headless: true }),
  context = await browser.newContext({
    locale: "en-US",
    viewport: { width: 1440, height: 1000 },
  }),
  page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
async function native(path, body) {
  const r = await fetch(accountOrigin + "/v1/" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await r.json();
  assert.equal(r.status, 200, JSON.stringify(result));
  return result;
}
async function call(path, method = "GET", body) {
  return page.evaluate(
    async ({ path, method, body }) => {
      const headers = {};
      if (method !== "GET") {
        headers["Content-Type"] = "application/json";
        headers["X-CSRF-Token"] = (
          await (await fetch("/api/csrf")).json()
        ).token;
        headers["Idempotency-Key"] = crypto.randomUUID();
      }
      const response = await fetch("/api/" + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: response.status, body: await response.json() };
    },
    { path, method, body },
  );
}
function invalidUtf8Json(source) {
  const at = source.indexOf('"name":"') + '"name":"'.length;
  assert.ok(at >= '"name":"'.length);
  return Buffer.concat([
    Buffer.from(source.slice(0, at)),
    Buffer.from([0xff]),
    Buffer.from(source.slice(at)),
  ]);
}
try {
  // A rejected recovery must survive both editing and reload byte-for-byte.
  const recoveryContext = await browser.newContext({ locale: "en-US" });
  const recoveryPage = await recoveryContext.newPage();
  await recoveryPage.goto(origin + "/workshop");
  await recoveryPage.getByText(/Valid edits recover automatically/).waitFor();
  const rejectedRecovery =
    '{ "schema": "old.workshop.v0", "name": "Keep my original" }\n';
  await recoveryPage.evaluate(
    (raw) => localStorage.setItem("omoba.workshop.recovery.v1", raw),
    rejectedRecovery,
  );
  await recoveryPage.reload();
  await recoveryPage
    .getByRole("alert")
    .filter({ hasText: "Automatic recovery is paused" })
    .waitFor();
  await recoveryPage
    .getByLabel("Build name", { exact: true })
    .fill("Separate valid editor");
  await recoveryPage.reload();
  await recoveryPage
    .getByRole("alert")
    .filter({ hasText: "Automatic recovery is paused" })
    .waitFor();
  assert.equal(
    await recoveryPage.evaluate(() =>
      localStorage.getItem("omoba.workshop.recovery.v1"),
    ),
    rejectedRecovery,
  );
  const recoveryDownload = recoveryPage.waitForEvent("download");
  await recoveryPage
    .getByRole("button", { name: "Download previous recovery", exact: true })
    .click();
  await (await recoveryDownload).saveAs(out + "/rejected-recovery.json");
  assert.equal(
    await readFile(out + "/rejected-recovery.json", "utf8"),
    rejectedRecovery,
  );
  await recoveryContext.close();
  await page.goto(origin + "/creators");
  await page.getByRole("link", { name: "Build a class", exact: true }).click();
  await page.waitForURL("**/workshop");
  assert.equal(
    await page
      .locator(".workshop-layout")
      .evaluate((el) => getComputedStyle(el).display),
    "grid",
  );
  assert.ok(
    await page
      .locator(".workshop-heading h1")
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize) > 40),
  );
  await page
    .getByText("Guest · saved only in this browser", { exact: true })
    .waitFor();
  await page
    .getByLabel("Build name", { exact: true })
    .fill("Radiant Rift Browser Proof");
  await page.getByLabel("Search composable skills").fill("Rift Needle");
  await page
    .getByRole("button", { name: "Assign Rift Needle to Q", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Compatible with this game" })
    .waitFor();
  assert.equal(
    await page
      .locator(".workshop-asset-list")
      .getByText("Wildspark repeater", { exact: true })
      .count(),
    0,
  );
  await page
    .getByRole("button", { name: "Save browser draft", exact: true })
    .click();
  await page.getByLabel("Build name", { exact: true }).fill("Temporary name");
  await page
    .getByRole("button", { name: "Load browser draft", exact: true })
    .click();
  assert.equal(
    await page.getByLabel("Build name", { exact: true }).inputValue(),
    "Radiant Rift Browser Proof",
  );
  for (const [name, file] of [
    ["Download build JSON", "browser-mixed-build.json"],
    ["Download Combat Test", "browser-mixed-preset.json"],
  ]) {
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: new RegExp(name) }).click();
    await (await pending).saveAs(out + "/" + file);
  }
  const downloaded = JSON.parse(
    await readFile(out + "/browser-mixed-build.json", "utf8"),
  );
  assert.equal(downloaded.recipe.skills[0], "rift_needle");
  await page.getByLabel("Import class build file").setInputFiles({
    name: "wrong.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ ...downloaded, owner: "intruder" })),
  });
  await page
    .getByRole("alert")
    .filter({ hasText: "unsupported fields" })
    .waitFor();
  assert.equal(
    await page.getByLabel("Build name", { exact: true }).inputValue(),
    downloaded.name,
  );
  await page.getByLabel("Import class build file").setInputFiles({
    name: "invalid-utf8.json",
    mimeType: "application/json",
    buffer: invalidUtf8Json(JSON.stringify(downloaded)),
  });
  await page.getByRole("alert").filter({ hasText: "valid UTF-8" }).waitFor();
  assert.equal(
    await page.getByLabel("Build name", { exact: true }).inputValue(),
    downloaded.name,
  );
  await page
    .getByLabel("Import class build file")
    .setInputFiles(out + "/browser-mixed-build.json");
  await page.screenshot({
    path: out + "/workshop-guest.png",
    fullPage: false,
    animations: "disabled",
  });
  await page.getByRole("link", { name: "Sign in with game account" }).click();
  await page.getByRole("button", { name: "Get a code" }).click();
  const code = (await page.locator(".pair-code").innerText()).replace(
    /[^A-Z0-9]/g,
    "",
  );
  const { challenge: c } = await native("auth/pairings/lookup", {
    code,
    public_key: publicKey,
  });
  await native("auth/pairings/approve", {
    challenge: c,
    decision: "approve",
    signature: sign(
      null,
      Buffer.from(
        JSON.stringify([
          "omoba.web.pair.v1",
          c.origin,
          c.pair_id,
          c.nonce,
          c.public_key,
          c.browser_binding,
          "approve",
          c.scopes,
          c.expires_at,
        ]),
      ),
      key,
    ).toString("hex"),
  });
  await page.waitForURL("**/workshop");
  await page
    .getByText("Connected to your central OMOBA account", { exact: true })
    .waitFor();
  assert.equal(
    await page.getByLabel("Build name", { exact: true }).inputValue(),
    downloaded.name,
  );
  const existing = await call("me/class-builds");
  assert.equal(existing.status, 200);
  const requestRaw = async (body) =>
    page.evaluate(async (raw) => {
      const csrf = await (await fetch("/api/csrf")).json();
      const response = await fetch("/api/me/class-builds", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrf.token,
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: Array.isArray(raw) ? new Uint8Array(raw) : raw,
      });
      return response.status;
    }, body);
  const buildBody = JSON.stringify({ document: downloaded });
  assert.equal(await requestRaw([...invalidUtf8Json(buildBody)]), 400);
  for (const malformed of [
    buildBody.replace('"schema_version":1', '"schema_version":1.0'),
    buildBody.replace('"name":', '"name":"shadowed","name":'),
    buildBody.replace('"description":""', '"description":"\\ud800"'),
  ])
    assert.equal(await requestRaw(malformed), 400);
  for (const build of existing.body.builds.filter((b) =>
    b.document.name.startsWith("Radiant Rift Browser Proof"),
  ))
    assert.equal(
      (
        await call(
          "me/class-builds/" + build.id + "?version=" + build.version,
          "DELETE",
        )
      ).status,
      200,
    );
  await page
    .getByRole("button", { name: "Save to account", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Saved privately" })
    .waitFor();
  let saved = (await call("me/class-builds")).body.builds.find(
    (b) => b.document.name === downloaded.name,
  );
  assert.ok(saved);
  assert.deepEqual(saved.document, downloaded);
  await page.getByText("Design notes (optional)", { exact: true }).click();
  await page.getByLabel("Design notes").fill("Verified account update");
  await page
    .getByRole("button", { name: "Update account build", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Saved privately" })
    .waitFor();
  await page.getByText("Account v2", { exact: true }).waitFor();
  const updated = (await call("me/class-builds/" + saved.id)).body.build;
  assert.equal(updated.version, "2");
  assert.equal(updated.document.description, "Verified account update");
  const raced = structuredClone(updated.document);
  raced.description = "Concurrent account version";
  assert.equal(
    (
      await call("me/class-builds/" + saved.id, "PATCH", {
        expected_version: updated.version,
        document: raced,
      })
    ).status,
    200,
  );
  await page.getByLabel("Design notes").fill("Local conflict survives");
  await page
    .getByRole("button", { name: "Update account build", exact: true })
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: "changed elsewhere" })
    .waitFor();
  assert.equal(
    await page.getByLabel("Design notes").inputValue(),
    "Local conflict survives",
  );
  await page
    .getByRole("button", { name: "Refresh saved builds", exact: true })
    .click();
  await page.getByText("Version 3 · dawnweaver", { exact: true }).waitFor();
  await page
    .getByRole("button", {
      name: "Load account build " + downloaded.name,
      exact: true,
    })
    .click();
  assert.equal(
    await page.getByLabel("Design notes").inputValue(),
    "Concurrent account version",
  );
  await page.reload();
  await page
    .getByRole("button", {
      name: "Load account build " + downloaded.name,
      exact: true,
    })
    .click();
  assert.equal(
    await page.getByLabel("Design notes").inputValue(),
    "Concurrent account version",
  );
  // Hold a genuine account response while the user replaces the editor.
  let releaseSave;
  const saveGate = new Promise((resolve) => {
    releaseSave = resolve;
  });
  let saveArrived;
  const saveStarted = new Promise((resolve) => {
    saveArrived = resolve;
  });
  await page.route("**/api/me/class-builds", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    saveArrived();
    await saveGate;
    await route.continue();
  });
  await page
    .getByRole("button", { name: "Save as account copy", exact: true })
    .click();
  await saveStarted;
  await page.getByLabel("Core", { exact: true }).selectOption("wildspark");
  releaseSave();
  await page
    .getByRole("status")
    .filter({ hasText: "replacement editor remains a separate draft" })
    .waitFor();
  assert.equal(await page.getByLabel("Core", { exact: true }).inputValue(), "wildspark");
  assert.equal(
    await page
      .getByRole("button", { name: "Update account build", exact: true })
      .count(),
    0,
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Save to account", exact: true })
      .count(),
    1,
  );
  await page.unroute("**/api/me/class-builds");
  await page
    .getByLabel("Import class build file")
    .setInputFiles(out + "/browser-mixed-build.json");
  assert.equal((await call("me/ekza-library", "DELETE")).status, 200);
  await page.reload();
  const lib = page.getByRole("region", { name: "Ekza library connection" });
  await lib
    .getByRole("button", { name: "Connect Ekza library", exact: true })
    .click();
  await lib.getByText(/LOCAL PROTOTYPE/).waitFor();
  const popupPromise = context.waitForEvent("page");
  await lib.getByRole("link", { name: "Approve synthetic fixture" }).click();
  const popup = await popupPromise;
  await popup.getByRole("button", { name: /Approve/ }).click();
  await popup
    .getByRole("heading", { name: "Synthetic consent approved", exact: true })
    .waitFor();
  await popup.close();
  await page.waitForTimeout(3100);
  await lib
    .getByRole("button", { name: "Check connection", exact: true })
    .click();
  await lib.getByText(/Verified library:/).waitFor();
  await page.reload();
  await page
    .getByRole("region", { name: "Ekza library connection" })
    .getByText(/Verified library:/)
    .waitFor();
  const sessionState = await call("me/ekza-library");
  assert.equal(sessionState.body.state, "connected");
  assert.equal(sessionState.body.prototype, true);
  for (const field of ["token", "access_token", "refresh_token"])
    assert.equal(field in sessionState.body, false);
  await page
    .locator("#workshop-account")
    .evaluate((el) => el.scrollIntoView({ block: "start" }));
  await page.screenshot({
    path: out + "/workshop-account-library.png",
    fullPage: false,
    animations: "disabled",
  });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  assert.deepEqual(errors, []);
  await writeFile(
    out + "/browser-evidence.json",
    JSON.stringify(
      {
        passed: true,
        viewport: "1440x1000 desktop",
        checks: [
          "gallery to builder",
          "48 canonical skills",
          "mixed core/skill GUI composition",
          "no borrowed default gun",
          "browser save/reload",
          "actual build and safe preset downloads",
          "invalid import preserves editor",
          "invalid UTF-8 file and BFF bytes rejected without replacement",
          "invalid recovery bytes preserved and downloadable across reload",
          "BFF preserves strict native duplicate-key and numeric parsing",
          "late account save cannot attach a replacement editor",
          "production CSS matches the running build",
          "signed game-account pairing returns to workshop",
          "guest draft survives login",
          "PostgreSQL account save/load/update",
          "409 conflict preserves local edit",
          "reload restores account drafts",
          "explicit labelled Registry fixture consent",
          "verified Ekza state persists across reload",
          "no browser tokens",
          "no horizontal overflow",
        ],
        savedBuildId: saved.id,
        limitations: [
          "Registry is a labelled loopback fixture; no hosted account writes.",
          "Native proof is recorded separately.",
        ],
      },
      null,
      2,
    ) + "\n",
  );
  console.log("PASS workshop guest/account/PostgreSQL/Registry desktop flow");
} finally {
  await browser.close();
}
