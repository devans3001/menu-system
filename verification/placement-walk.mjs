import { chromium } from "playwright-core";

// Menu-first placement walk (Nov 6, 2026). Isolated in-memory
// instance only (port 3116); the live demo is never touched. The
// instance is set to Evans's exact state when he hit the bug: one
// menu (Brunch), no sections, no dishes, AND a stale new-dish draft
// planted in local storage, written by the old form shape with
// "no section yet" picked and an empty menu tick list. The walk
// proves the dead end is gone: the menu is offered up front, the
// stale placement is re-synced, and the saved dish lands on Brunch
// where guests can see it.
const exe = process.env.HOME + "/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell";
const proxyUrl = new URL(process.env.https_proxy || process.env.HTTPS_PROXY);
const proxy = { server: proxyUrl.protocol + "//" + proxyUrl.host, username: decodeURIComponent(proxyUrl.username), password: decodeURIComponent(proxyUrl.password), bypass: "localhost,127.0.0.1" };

const B = "http://localhost:3116";
const log = (...a) => console.log(...a);
let failures = 0;
function check(cond, msg) { log(cond ? "ok:" : "FAIL:", msg); if (!cond) failures++; }

const seedDoc = await (await fetch(B + "/api/menu")).json();
const brunchDoc = {
  venue: seedDoc.venue,
  menus: [{ id: "menu-brunch-test", venueId: seedDoc.venue.id, name: "Brunch", schedule: { days: [0, 1, 2, 3, 4, 5, 6], windows: [{ start: "09:00", end: "22:00" }] }, precedence: -1, taxIncluded: true, priceNote: "", sectionIds: [] }],
  sections: [], items: [], variants: [], modifierGroups: [], modifierOptions: [], bundles: [], specials: [], availability: [],
  version: seedDoc.version, updatedAt: new Date().toISOString(),
};
const put = await fetch(B + "/api/menu", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(brunchDoc) });
check(put.ok, "isolated instance set to one menu, nothing on it");

const staleDraft = {
  name: "", subtitle: "", description: "", sectionId: "__none__", newSectionName: "",
  newSectionMenuIds: [], priceType: "fixed", basePrice: "", todaysMarketPrice: "", photoUrl: "",
  dietaryTags: [], allergenContains: [], badgeLabel: "", serves: "", isHot: false, active: true,
  soldOut: false, variants: [], groups: [],
};

const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"], proxy });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(B + "/admin", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(900);
  await page.evaluate(d => window.localStorage.setItem("claro-menu-draft-v1:new", JSON.stringify(d)), staleDraft);
  await page.click("text=Continue in demo mode");
  await page.waitForTimeout(1200);
  const skip = page.getByRole("button", { name: "Skip tour" });
  if (await skip.isVisible().catch(() => false)) { await skip.click(); await page.waitForTimeout(400); }

  await page.getByRole("button", { name: "Dishes", exact: true }).first().click();
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: "Add your first dish" }).click();
  await page.waitForTimeout(800);

  const body = await page.evaluate(() => document.body.textContent);
  check(body.includes("brought back the draft"), "the stale draft really was restored (the trap was armed)");
  const menuSelect = page.getByTestId("item-menu");
  check(await menuSelect.isVisible().catch(() => false), "the form now leads with a Menu picker");
  check((await menuSelect.inputValue()) === "menu-brunch-test", "Brunch is the picked menu");
  check(await page.getByTestId("new-section-name").isVisible().catch(() => false), "placement re-synced to creating a section (no-section dead end cleared)");
  check(!(await page.getByText("Show this section on").isVisible().catch(() => false)), "the old chip row is gone");
  await page.screenshot({ path: "placement-mobile.png" });

  await page.getByTestId("item-name").fill("Test Jollof");
  await page.getByTestId("new-section-name").fill("Mains");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForTimeout(500);
  await page.getByTestId("item-price").fill("5000");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Add to menu" }).click();
  await page.waitForTimeout(1200);

  const after = await (await fetch(B + "/api/menu")).json();
  check(after.items.length === 1 && after.items[0].name === "Test Jollof", "dish saved");
  check(after.sections.length === 1 && after.sections[0].name === "Mains", "section created with the dish");
  check(after.menus[0].sectionIds.includes(after.sections[0].id), "section is attached to Brunch automatically");
  check(after.sections[0].itemIds.includes(after.items[0].id), "dish sits in the section");
  const guest = await (await fetch(B + "/")).text();
  check(guest.includes("Test Jollof"), "guest page shows the dish on Brunch");

  // Editing the dish opens with its real placement preselected.
  await page.getByRole("button", { name: /Test Jollof/ }).first().click();
  await page.waitForTimeout(800);
  check((await page.getByTestId("item-menu").inputValue()) === "menu-brunch-test", "edit opens on Brunch");
  check((await page.getByTestId("item-section").inputValue()) === after.sections[0].id, "edit opens on the Mains section");
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.waitForTimeout(400);
  await page.close();
} finally {
  await browser.close();
}
log(failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
