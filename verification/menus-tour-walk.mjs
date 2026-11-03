import { chromium } from "playwright-core";

// Menus simplification + tour fade walk (Nov 3, 2026): verifies, at
// phone size, that (1) the tour card fades and blurs while the page
// scrolls and returns solid at rest, and (2) the Menus page leads
// with the live-now answer, keeps days and hours folded until asked,
// and names hidden dishes when a section is unticked. The menu
// document is snapshotted from the API first and restored at the
// end, whatever happens in between.
const exe = process.env.HOME + "/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell";
const proxyUrl = new URL(process.env.https_proxy || process.env.HTTPS_PROXY);
const proxy = { server: proxyUrl.protocol + "//" + proxyUrl.host, username: decodeURIComponent(proxyUrl.username), password: decodeURIComponent(proxyUrl.password), bypass: "localhost,127.0.0.1" };

const BASE = "http://localhost:3113";
const log = (...a) => console.log(...a);
let failures = 0;
function check(cond, msg) { log(cond ? "ok:" : "FAIL:", msg); if (!cond) failures++; }

const snapshot = await (await fetch(BASE + "/api/menu")).json();
log("snapshot: menus", snapshot.menus.length, "sections", snapshot.sections.length);

const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"], proxy });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("dialog", d => { log("FAIL: native dialog appeared:", d.message()); failures++; d.dismiss(); });

const tourOpacity = () => page.evaluate(() => {
  const el = document.querySelector('[aria-label="Welcome tour"]');
  if (!el) return null;
  const cs = getComputedStyle(el);
  return { opacity: Number(cs.opacity), filter: cs.filter };
});

try {
  await page.goto(BASE + "/admin", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(800);
  await page.click("text=Continue in demo mode");
  await page.waitForTimeout(1200);
  check(await page.getByText("Welcome to your menu editor").isVisible(), "tour shows on first open");
  const rest = await tourOpacity();
  check(rest && rest.opacity === 1, `tour solid at rest (opacity ${rest?.opacity})`);

  // Scroll in small steps and sample while the motion is live.
  let minOpacity = 1;
  for (let i = 0; i < 14; i++) {
    await page.mouse.wheel(0, 240);
    const s = await tourOpacity();
    if (s) minOpacity = Math.min(minOpacity, s.opacity);
    if (i === 6) await page.screenshot({ path: "tour-faded-mobile.png" });
  }
  check(minOpacity < 0.5, `tour fades while scrolling (min sampled opacity ${minOpacity.toFixed(2)})`);
  await page.waitForTimeout(700);
  const back = await tourOpacity();
  check(back && back.opacity === 1, `tour solid again at rest (opacity ${back?.opacity})`);
  await page.screenshot({ path: "tour-solid-mobile.png" });

  await page.getByRole("button", { name: "Skip tour" }).click();
  await page.waitForTimeout(500);

  // Menus page.
  await page.getByRole("button", { name: "Menus", exact: true }).first().click();
  await page.waitForTimeout(700);
  check(await page.getByText(/Guests are seeing/).isVisible(), "live-now status line shows");
  const liveBadges = await page.getByText("Live now", { exact: true }).count();
  check(liveBadges === 1, `exactly one Live now badge (${liveBadges})`);
  const timeVisibleBefore = await page.locator('input[type="time"]').first().isVisible().catch(() => false);
  check(!timeVisibleBefore, "days and hours folded on arrival (no time inputs visible)");
  await page.screenshot({ path: "menus-simple-mobile.png" });
  const m = await page.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth }));
  check(m.scrollW === m.innerW, `menus page no horizontal overflow (${m.scrollW}/${m.innerW})`);

  // Open the schedule editor on the first card.
  await page.getByRole("button", { name: /Change/ }).first().click();
  await page.waitForTimeout(400);
  check(await page.locator('input[type="time"]').first().isVisible(), "Change opens days and hours");

  // Untick a section that is on and carries dishes: the hidden note
  // must appear with a dish count.
  const chipInfo = await page.evaluate((sections) => {
    const chips = [...document.querySelectorAll('button[aria-pressed="true"]')];
    for (const chip of chips) {
      const sec = sections.find(s => s.name === chip.textContent.trim());
      if (sec && sec.itemIds.length > 0) return { name: sec.name, dishes: sec.itemIds.length };
    }
    return null;
  }, snapshot.sections);
  check(!!chipInfo, `found a ticked section carrying dishes (${chipInfo?.name}, ${chipInfo?.dishes})`);
  if (chipInfo) {
    await page.getByRole("button", { name: chipInfo.name, exact: true }).first().click();
    await page.waitForTimeout(500);
    const note = await page.getByText(/Not on this menu:/).first().textContent().catch(() => "");
    check(note.includes(chipInfo.name) && note.includes(String(chipInfo.dishes)), `hidden note names section and dish count: "${note.trim().slice(0, 110)}"`);
    await page.screenshot({ path: "menus-hidden-note-mobile.png" });
  }
} finally {
  await fetch(BASE + "/api/menu", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(snapshot) });
  const restored = await (await fetch(BASE + "/api/menu")).json();
  log("restored: menus", restored.menus.length, "sections", restored.sections.length, "sectionIds match:", JSON.stringify(restored.menus.map(x => x.sectionIds)) === JSON.stringify(snapshot.menus.map(x => x.sectionIds)));
  await browser.close();
}
log(failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
