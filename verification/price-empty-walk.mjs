import { chromium } from "playwright-core";

// Price declutter + specials chip + empty-state walk (Nov 3, 2026).
// Server A (3113) runs the real document: the quick price editor
// must span the row, and special chips must name the next run.
// Server B (3114) runs the isolated in-memory layer: an empty
// document must render the calm guest placeholder, not an error,
// and the editor must open onto its empty states. Server A's
// document is snapshotted and restored; server B touches nothing
// outside its own process memory.
const exe = process.env.HOME + "/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell";
const proxyUrl = new URL(process.env.https_proxy || process.env.HTTPS_PROXY);
const proxy = { server: proxyUrl.protocol + "//" + proxyUrl.host, username: decodeURIComponent(proxyUrl.username), password: decodeURIComponent(proxyUrl.password), bypass: "localhost,127.0.0.1" };

const A = "http://localhost:3113";
const B = "http://localhost:3114";
const log = (...a) => console.log(...a);
let failures = 0;
function check(cond, msg) { log(cond ? "ok:" : "FAIL:", msg); if (!cond) failures++; }

const snapshot = await (await fetch(A + "/api/menu")).json();
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"], proxy });

async function signIn(page, base) {
  await page.goto(base + "/admin", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(800);
  await page.click("text=Continue in demo mode");
  await page.waitForTimeout(1100);
  const skip = page.getByRole("button", { name: "Skip tour" });
  if (await skip.isVisible().catch(() => false)) { await skip.click(); await page.waitForTimeout(400); }
}

try {
  // ---- Server A: price editor + specials chips --------------------
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await signIn(page, A);
  await page.getByRole("button", { name: "Dishes", exact: true }).first().click();
  await page.waitForTimeout(700);
  const priceBtn = page.locator('[data-testid="price-button"]', { hasText: "Change price" }).first();
  await priceBtn.click();
  await page.waitForTimeout(400);
  const input = page.locator('[data-testid="quick-price"]');
  check(await input.isVisible(), "quick price editor opens");
  const box = await input.boundingBox();
  check(box && box.width > 170, `price input is roomy now (width ${box ? Math.round(box.width) : "?"}px, was fixed 120px)`);
  await page.screenshot({ path: "price-edit-mobile.png" });
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.waitForTimeout(300);

  await page.getByRole("button", { name: "Specials", exact: true }).first().click();
  await page.waitForTimeout(700);
  const bodyText = await page.evaluate(() => document.body.textContent);
  check(!bodyText.includes("Not in its window"), "old vague chip is gone");
  const starts = (bodyText.match(/Starts (today|tomorrow|Mon|Tue|Wed|Thu|Fri|Sat|Sun)/g) || []);
  check(starts.length >= 2, `special chips name their next runs (${JSON.stringify(starts)})`);
  await page.screenshot({ path: "specials-chips-mobile.png" });
  await page.close();

  // ---- Server B: empty document -----------------------------------
  const seedDoc = await (await fetch(B + "/api/menu")).json();
  const emptyDoc = {
    venue: seedDoc.venue, menus: [], sections: [], items: [], variants: [],
    modifierGroups: [], modifierOptions: [], bundles: [], specials: [], availability: [],
    version: seedDoc.version, updatedAt: new Date().toISOString(),
  };
  const put = await fetch(B + "/api/menu", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(emptyDoc) });
  check(put.ok, "empty document accepted by the save path");
  const guestRes = await fetch(B + "/");
  const guestHtml = await guestRes.text();
  check(guestRes.status === 200, `guest page answers 200 on an empty document (got ${guestRes.status})`);
  check(guestHtml.includes("still writing this menu"), "guest sees the calm empty placeholder");

  const page2 = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await signIn(page2, B);
  check(await page2.getByText("Get your menu ready").isVisible().catch(() => false), "editor Overview opens on the empty document");
  await page2.getByRole("button", { name: "Dishes", exact: true }).first().click();
  await page2.waitForTimeout(600);
  check(await page2.getByText("No food yet").isVisible(), "Dishes shows its empty state");
  await page2.getByRole("button", { name: "Menus", exact: true }).first().click();
  await page2.waitForTimeout(600);
  check(await page2.getByText("No menus yet").isVisible(), "Menus shows its empty state");
  await page2.screenshot({ path: "editor-empty-mobile.png" });
  await page2.close();
} finally {
  await fetch(A + "/api/menu", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(snapshot) });
  await browser.close();
}
log(failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
