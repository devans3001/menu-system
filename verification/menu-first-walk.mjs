import { chromium } from "playwright-core";

// Menu-before-food walk (Nov 6, 2026). Runs ONLY against an isolated
// in-memory instance (MENU_DATA_SOURCE=local, port 3115): the live
// demo document is never touched. The instance starts from the seed
// document, so the walk first replaces it with an empty document
// through the app's own API, exactly the state Evans is testing in.
// It then plays a brand-new owner: tour, checklist, the Dishes dead
// end that used to exist, menu creation, first dish, guest proof.
const exe = process.env.HOME + "/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell";
const proxyUrl = new URL(process.env.https_proxy || process.env.HTTPS_PROXY);
const proxy = { server: proxyUrl.protocol + "//" + proxyUrl.host, username: decodeURIComponent(proxyUrl.username), password: decodeURIComponent(proxyUrl.password), bypass: "localhost,127.0.0.1" };

const B = "http://localhost:3115";
const log = (...a) => console.log(...a);
let failures = 0;
function check(cond, msg) { log(cond ? "ok:" : "FAIL:", msg); if (!cond) failures++; }

const seedDoc = await (await fetch(B + "/api/menu")).json();
const emptyDoc = {
  venue: seedDoc.venue, menus: [], sections: [], items: [], variants: [],
  modifierGroups: [], modifierOptions: [], bundles: [], specials: [], availability: [],
  version: seedDoc.version, updatedAt: new Date().toISOString(),
};
const put = await fetch(B + "/api/menu", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(emptyDoc) });
check(put.ok, "isolated instance wiped to an empty document");

const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"], proxy });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(B + "/admin", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(900);
  await page.click("text=Continue in demo mode");
  await page.waitForTimeout(1200);

  // Tour: step 2 must be the new Menus step, landing on Menus.
  check(await page.getByText("Welcome to your menu editor").isVisible().catch(() => false), "tour opens on Welcome");
  await page.getByRole("button", { name: "Next" }).click();
  await page.waitForTimeout(600);
  check(await page.getByText("Start with a menu").isVisible().catch(() => false), "tour step 2 is 'Start with a menu'");
  check(await page.getByText("Step 2 of 6").isVisible().catch(() => false), "tour now runs 6 steps");
  await page.screenshot({ path: "tour-menu-step-mobile.png" });
  await page.getByRole("button", { name: "Skip tour" }).click();
  await page.waitForTimeout(500);

  // Overview checklist: menu is job one, dish job detours to Menus.
  const body1 = await page.evaluate(() => document.body.textContent);
  check(body1.includes("Create your first menu"), "checklist job one is Create your first menu");
  check(body1.includes("0 of 5 done"), `checklist starts at 0 of 5 (saw: ${(body1.match(/\d of 5 done/) || ["?"])[0]})`);
  await page.getByRole("button", { name: "Create menu first" }).first().click();
  await page.waitForTimeout(700);
  check(await page.getByText("Create your first menu", { exact: true }).last().isVisible().catch(() => false), "dish checklist action detours to the Menus page");
  await page.screenshot({ path: "menus-first-mobile.png" });

  // Dishes page: empty state teaches menu first and routes there.
  await page.getByRole("button", { name: "Dishes", exact: true }).first().click();
  const emptyTitle = page.getByText("Create a menu first", { exact: true }).last();
  check(await emptyTitle.waitFor({ state: "visible", timeout: 5000 }).then(() => true).catch(() => false), "Dishes empty state says Create a menu first");
  await page.getByRole("button", { name: "Create your first menu" }).click();
  await page.waitForTimeout(700);
  check(await page.getByLabel("New menu name").isVisible().catch(() => false), "Dishes CTA lands on the Menus create form");

  // Create the menu.
  await page.getByLabel("New menu name").fill("All Day");
  await page.getByRole("button", { name: "Create menu" }).click();
  await page.waitForTimeout(900);
  const afterMenu = await (await fetch(B + "/api/menu")).json();
  check(afterMenu.menus.length === 1 && afterMenu.menus[0].name === "All Day", "menu created and saved");

  // Now Add Food must open, and the new section must offer the menu.
  await page.getByRole("button", { name: "Dishes", exact: true }).first().click();
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: "Add your first dish" }).click();
  await page.waitForTimeout(700);
  check(await page.getByTestId("item-name").isVisible().catch(() => false), "Add Food form opens once a menu exists");
  await page.getByTestId("item-name").fill("Test Jollof");
  await page.getByTestId("new-section-name").fill("Mains");
  const formText = await page.evaluate(() => document.body.textContent);
  check(formText.includes("Show this section on") && formText.includes("All Day"), "new section offers the created menu to sit on");
  await page.screenshot({ path: "addfood-with-menu-mobile.png" });
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForTimeout(500);
  await page.getByTestId("item-price").fill("5000");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Add to menu" }).click();
  await page.waitForTimeout(1200);
  const afterDish = await (await fetch(B + "/api/menu")).json();
  check(afterDish.items.length === 1 && afterDish.items[0].name === "Test Jollof", "dish saved");
  check(afterDish.sections.length === 1 && afterDish.menus[0].sectionIds.includes(afterDish.sections[0].id), "dish's section is attached to the menu");

  const guest = await (await fetch(B + "/")).text();
  check(guest.includes("Test Jollof"), "guest page shows the dish (no orphan)");

  // Checklist progress reflects the real order of jobs.
  await page.getByRole("button", { name: "Overview", exact: true }).first().click();
  await page.waitForTimeout(700);
  const body2 = await page.evaluate(() => document.body.textContent);
  // Exactly one job done: the menu. The dish job still wants a photo,
  // and saving the dish must not tick the sold-out job on its own.
  check(body2.includes("1 of 5 done"), `checklist ticks only the menu job (saw: ${(body2.match(/\d of 5 done/) || ["?"])[0]})`);

  // Regression: wipe again in-memory and confirm the form can no
  // longer be reached at all from Dishes.
  await fetch(B + "/api/menu", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...afterDish, menus: [], sections: [], items: [], version: afterDish.version }) });
  await page.goto(B + "/admin", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(900);
  // A full reload returns to the sign-in gate; the tour stays done.
  await page.click("text=Continue in demo mode");
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Dishes", exact: true }).first().click();
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: "Create a menu first" }).first().click();
  await page.waitForTimeout(700);
  check(!(await page.getByTestId("item-name").isVisible().catch(() => false)), "with no menu, the dish form never opens");
  check(await page.getByLabel("New menu name").isVisible().catch(() => false), "the Dishes Add button routes to Menus instead");
  await page.close();
} finally {
  await browser.close();
}
log(failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
