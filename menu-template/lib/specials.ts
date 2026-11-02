import type { MenuDocument, Special } from "./types";
export function isScheduleActive(schedule: Special["schedule"], now = new Date()): boolean {
  // Uses venue local evaluation in the demo by taking the passed Date as local time.
  if (schedule.startsAt && now < new Date(schedule.startsAt)) return false;
  if (schedule.endsAt && now > new Date(schedule.endsAt)) return false;
  if (!schedule.days.includes(now.getDay())) return false;
  const mins = now.getHours() * 60 + now.getMinutes();
  return schedule.windows.some(w => {
    const [sh, sm] = w.start.split(":").map(Number); const [eh, em] = w.end.split(":").map(Number);
    const s = sh * 60 + sm; const e = eh * 60 + em;
    if (e <= s) return mins >= s || mins < e; // overnight window
    return mins >= s && mins < e;
  });
}
export function activeSpecials(doc: MenuDocument, now = new Date()): Special[] {
  return doc.specials.filter(s => isScheduleActive(s.schedule, now));
}
export function specialForItem(doc: MenuDocument, itemId: string, sectionIds: string[], now = new Date()): Special | undefined {
  return activeSpecials(doc, now).find(s => s.targetItemIds.includes(itemId) || s.targetSectionIds.some(id => sectionIds.includes(id)));
}
export function specialPrice(base: number | null, special: Special): number | null {
  if (base === null) return special.ruleType === "fixed_special_price" ? special.ruleValue : null;
  switch (special.ruleType) {
    case "percent_off": return Math.round(base * (1 - special.ruleValue / 100));
    case "amount_off": return Math.max(0, base - special.ruleValue);
    case "fixed_special_price": return special.ruleValue;
    case "bundle_price": return special.ruleValue;
    default: return base;
  }
}
export function activeMenu(doc: MenuDocument, now = new Date()) {
  const candidates = doc.menus.filter(m => isScheduleActive(m.schedule, now));
  if (!candidates.length) return doc.menus.slice().sort((a, b) => b.precedence - a.precedence)[0];
  return candidates.sort((a, b) => b.precedence - a.precedence)[0];
}
export function isSoldOut(doc: MenuDocument, itemId: string): boolean {
  return !!doc.availability.find(a => a.entityType === "item" && a.entityId === itemId && a.soldOut);
}
