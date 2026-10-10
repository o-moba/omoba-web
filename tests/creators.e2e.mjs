// Public catalogue only. No Account API or database is required.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
const origin = process.env.CREATOR_TEST_ORIGIN || "http://127.0.0.1:3012";
const out = ".agent/tasks/ASSET-CATALOG-20261010";
await mkdir(out, { recursive: true });
const catalog = JSON.parse(
  await readFile("public/asset-catalog/catalog.json", "utf8"),
);
let accountCalls = 0;
const trap = createServer((_req, res) => {
  accountCalls++;
  res.writeHead(503);
  res.end("Account API must not be used by creators");
});
await new Promise((resolve) => trap.listen(40559, "127.0.0.1", resolve));
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [],
  apiRequests = [],
  badAssets = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (new URL(r.url()).pathname.startsWith("/api/")) apiRequests.push(r.url());
});
page.on("response", (r) => {
  if (r.url().includes("/asset-catalog/") && r.status() >= 400)
    badAssets.push(r.url());
});
try {
  await page.goto(origin + "/creators");
  await page.getByRole("heading", { name: "The asset library" }).waitFor();
  assert.equal(
    await page
      .getByRole("navigation", { name: "Class kits" })
      .getByRole("link")
      .count(),
    17,
  );
  assert.equal(await page.locator(".creator-page").getAttribute("lang"), "en");
  const search = page.getByRole("searchbox", {
    name: "Search classes, skills & assets",
  });
  await search.fill("rocket");
  await page
    .getByRole("navigation", { name: "Class kits" })
    .getByRole("link", { name: /Wildspark/ })
    .click();
  await search.fill("");
  await page.getByRole("heading", { name: "Wildspark", exact: true }).waitFor();
  const wildspark = catalog.classes.find((c) => c.id === "wildspark"),
    q = catalog.skills.find(
      (s) => s.id === wildspark.skills.find((s) => s.slot === "q").id,
    );
  await page
    .getByRole("navigation", { name: "Wildspark skills" })
    .getByRole("link", { name: new RegExp(q.name) })
    .click();
  await page.waitForURL((url) => url.searchParams.get("skill") === q.id);
  assert.equal(new URL(page.url()).searchParams.get("skill"), q.id);
  const classNavigation = page.getByRole("navigation", { name: "Class kits" });
  assert.equal(
    await classNavigation
      .getByRole("link", { name: /Wildspark/ })
      .getAttribute("aria-current"),
    "true",
  );
  assert.equal(
    await classNavigation
      .getByRole("link", { name: /Adventurer/ })
      .getAttribute("aria-current"),
    null,
  );
  assert.equal(await classNavigation.locator(".is-selected").count(), 1);
  const skillNavigation = page.getByRole("navigation", {
    name: "Wildspark skills",
  });
  assert.equal(
    await skillNavigation
      .getByRole("link", { name: new RegExp(q.name) })
      .getAttribute("aria-current"),
    "true",
  );
  assert.equal(
    await skillNavigation
      .getByRole("link", { name: /Whole kit/ })
      .getAttribute("aria-current"),
    null,
  );
  assert.equal(await skillNavigation.locator(".is-selected").count(), 1);
  const supported = catalog.requirements.filter(
    (r) => q.requirementIds.includes(r.id) && r.status === "supported",
  );
  assert.equal(supported.length, 2);
  const cards = page.getByRole("article");
  for (let i = 0; i < 2; i++) {
    const name = await cards.nth(i).getAttribute("aria-label");
    assert.ok(supported.some((r) => r.name === name));
  }
  await page
    .locator(".creator-class-heading")
    .evaluate((el) => el.scrollIntoView({ block: "start" }));
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".creator-preview img")].every(
      (i) => i.complete && i.naturalWidth > 0,
    ),
  );
  await page.screenshot({
    path: out + "/creators-wildspark-q.png",
    fullPage: false,
    animations: "disabled",
  });
  const chosen =
    supported.find((r) => r.id.includes("repeater")) || supported[0];
  await page
    .getByRole("article", { name: chosen.name, exact: true })
    .getByRole("link", { name: "Link to " + chosen.name })
    .click();
  await page.waitForURL(
    (url) => url.searchParams.get("requirement") === chosen.id,
  );
  assert.equal(new URL(page.url()).searchParams.get("requirement"), chosen.id);
  assert.equal(await page.getByRole("article").count(), 1);
  await page.goBack();
  await page
    .getByRole("article", { name: supported[0].name, exact: true })
    .waitFor();
  assert.equal(new URL(page.url()).searchParams.has("requirement"), false);
  await page.goForward();
  await page.getByRole("article", { name: chosen.name, exact: true }).waitFor();
  await page.waitForURL(
    (url) => url.searchParams.get("requirement") === chosen.id,
  );
  assert.equal(new URL(page.url()).searchParams.get("requirement"), chosen.id);
  const card = page.getByRole("article", { name: chosen.name, exact: true });
  const pendingDownload = page.waitForEvent("download");
  await card.getByRole("button", { name: "Download brief" }).click();
  const download = await pendingDownload,
    brief = JSON.parse(await readFile(await download.path(), "utf8"));
  assert.equal(brief.catalogRevision, catalog.revision);
  assert.equal(brief.requirementId, chosen.id);
  assert.equal(brief.classId, "wildspark");
  assert.deepEqual(brief.profile, chosen.profile);
  assert.match(brief.workflow, /not exact-slot/);
  const studio = card.getByRole("link", { name: "Start a Studio draft" });
  assert.equal(
    await studio.getAttribute("href"),
    "https://studio.ekza.io/studio?view=new",
  );
  await card
    .getByText("Default & technical reference", { exact: true })
    .click();
  const baseline = card.getByRole("link", { name: /Download baseline GLB/ });
  assert.equal(await baseline.getAttribute("href"), chosen.baseline.url);
  const response = await page.request.get(origin + chosen.baseline.url);
  assert.equal(response.status(), 200);
  assert.equal((await response.body()).length, chosen.baseline.bytes);
  await page
    .locator(".creator-class-heading")
    .evaluate((el) => el.scrollIntoView({ block: "start" }));
  await page.screenshot({
    path: out + "/creators-requirement.png",
    fullPage: false,
    animations: "disabled",
  });
  await page.goto(origin + "/creators?class=wildspark&skill=wild_traps");
  await page.getByRole("heading", { name: "Wildspark", exact: true }).waitFor();
  assert.equal(
    await page.getByRole("link", { name: "Start a Studio draft" }).count(),
    0,
  );
  assert.ok(
    (await page
      .getByText("No static preview available", { exact: true })
      .count()) > 0,
  );
  await search.fill("not-a-real-asset-xyz");
  await page
    .getByRole("heading", { name: "No matching design references" })
    .waitFor();
  await page.getByRole("button", { name: "Clear search" }).click();
  assert.equal(await search.inputValue(), "");
  for (const query of [
    "class=missing",
    "class=wildspark&skill=dagger_backstab",
    "class=wildspark&skill=wild_traps&requirement=" + chosen.id,
  ]) {
    await page.goto(origin + "/creators?" + query);
    await page
      .getByRole("heading", { name: "This catalogue link is unavailable" })
      .waitFor();
    assert.equal(await page.getByRole("article").count(), 0);
  }
  await page.goto(origin + "/creators?class=wildspark&skill=wild_switch");
  await page.getByRole("heading", { name: "Wildspark", exact: true }).waitFor();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(badAssets, []);
  assert.deepEqual(apiRequests, []);
  assert.equal(accountCalls, 0);
  await writeFile(
    out + "/browser-evidence.json",
    JSON.stringify(
      {
        passed: true,
        viewport: "1440x1000 desktop",
        revision: catalog.revision,
        accountApiCalls: accountCalls,
        browserApiRequests: apiRequests,
        checks: [
          "17 class links",
          "asset-name search discovers classes",
          "QWER skill navigation",
          "Wildspark Q has two model previews first",
          "class/skill/requirement deep links",
          "back and forward navigation",
          "revision-pinned downloaded brief",
          "licensed GLB download",
          "Studio draft link restricted to supported handhelds",
          "explicit absent preview",
          "empty search reset",
          "invalid and incompatible links",
          "no horizontal overflow",
          "no page errors or broken catalogue assets",
        ],
        limitations: [
          "No upload, registry, approval or equip mutation is implemented.",
          "Desktop web viewport only; no native runtime verification.",
        ],
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "PASS creators public catalogue desktop flow; Account API requests: 0",
  );
} finally {
  await browser.close();
  await new Promise((resolve) => trap.close(resolve));
}
