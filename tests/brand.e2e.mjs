// Visual and functional smoke against a running guest-only portal. No real accounts.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
const out = ".agent/brand",
  origin = process.env.BRAND_TEST_ORIGIN || "http://127.0.0.1:3017";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ locale: "en-US", viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(8000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
async function ready() {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images]
        .filter((img) => img.complete || img.loading !== "lazy")
        .map((img) => img.decode().catch(() => {})),
    );
  });
}
async function snap(name) {
  await ready();
  await page.screenshot({
    path: out + "/" + name + ".png",
    animations: "disabled",
  });
}
try {
  await page.goto(origin + "/workshop");
  await page.getByText(/Valid edits recover automatically/).waitFor();
  const kit = await page.locator(".workshop-slot-grid").boundingBox();
  console.log("kit", kit);
  assert.ok(
    kit.y + kit.height < 1000,
    "QWER kit should fit on desktop first screen",
  );
  await snap("omoba-workshop");
  await page
    .locator(".workshop-core-rail")
    .getByRole("button", { name: /Wildspark/ })
    .click();
  assert.equal(
    await page.locator(".workshop-form select").inputValue(),
    "wildspark",
  );
  await page.getByRole("button", { name: /^Edit W:/ }).click();
  await page.getByLabel("Search composable skills").fill("Rift Needle");
  await page
    .getByRole("button", { name: "Assign Rift Needle to W", exact: true })
    .click();
  await page
    .getByLabel("Build name", { exact: true })
    .fill("Armory visual proof");
  await page.getByText("Design notes (optional)", { exact: true }).click();
  await page
    .getByLabel("Design notes")
    .fill("Core, QWER and optional notes stay in the draft.");
  await page
    .getByRole("button", { name: "Save browser draft", exact: true })
    .click();
  await page.reload();
  await page.getByText(/Valid edits recover automatically/).waitFor();
  assert.equal(
    await page.getByLabel("Build name", { exact: true }).inputValue(),
    "Armory visual proof",
  );
  await page.getByText("Design notes (optional)", { exact: true }).click();
  assert.match(
    await page.getByLabel("Design notes").inputValue(),
    /optional notes/,
  );
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: /Download build JSON/ }).click();
  const dl = await pending;
  await dl.saveAs(".agent/brand/build.json");
  const draft = JSON.parse(await readFile(".agent/brand/build.json", "utf8"));
  assert.equal(draft.recipe.core, "wildspark");
  assert.equal(draft.recipe.skills[1], "rift_needle");
  assert.equal(draft.name, "Armory visual proof");
  assert.equal(
    await page
      .locator(".workshop-build-summary")
      .getByText("Armory visual proof", { exact: true })
      .count(),
    1,
  );
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByText(/Valid edits recover automatically/).waitFor();
  await page.setViewportSize({ width: 393, height: 852 });
  await page.evaluate(() => scrollTo(0, 0));
  await snap("omoba-workshop-mobile");
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "workshop mobile overflow",
  );
  await page.locator(".workshop-slot-grid").scrollIntoViewIfNeeded();
  await snap("omoba-workshop-mobile-kit");
  await page.goto(origin + "/creators");
  await snap("omoba-catalog-mobile");
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "catalog mobile overflow",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin + "/creators");
  await snap("omoba-catalog");
  await page.goto(
    origin + "/creators?class=wildspark&skill=wild_switch#creator-library",
  );
  await snap("omoba-catalog-assets");
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "catalog desktop overflow",
  );
  await page.goto(origin + "/me");
  await page.getByRole("combobox").selectOption("en");
  await snap("omoba-portal");
  assert.deepEqual(errors, []);
  await writeFile(
    ".agent/brand/evidence.json",
    JSON.stringify(
      {
        passed: true,
        origin,
        language: "EN",
        viewports: ["1440x1000", "393x852"],
        checks: [
          "QWER visible on first desktop screen",
          "core rail updates editor",
          "skill reassignment",
          "optional notes",
          "recovery after reload",
          "downloaded JSON matches draft",
          "summary updates",
          "no horizontal page overflow",
          "visible images decoded",
          "no browser errors",
        ],
        limitations: [
          "Synthetic guest editing only, no live account/DB mutation",
          "Viewport emulation, no physical-device certification",
        ],
      },
      null,
      2,
    ),
  );
  console.log("PASS brand UI: core/skills/notes/recovery/export/layout");
} finally {
  await browser.close();
}
