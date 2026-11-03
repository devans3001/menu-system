"use client";
import type { MenuDocument } from "../../lib/types";
import { activeMenu, activeSpecials, isSoldOut } from "../../lib/specials";
import { SectionTitle, scheduleSummary, type EditorSectionId } from "./shared";
import type { FirstRunFlags } from "../AdminEditor";

// Overview: the state of the menu today, the quick actions, and the
// first-run checklist. The checklist ticks itself off from the real
// document and two remembered actions (viewing the live menu, opening
// the QR room); when every job is done it retires into one line, so it
// teaches at the start and never nags after (first-run standard,
// fullstack skill, Nov 3, 2026).
export default function OverviewSection({ doc, go, flags, onViewLive, onReplayTour }: {
  doc: MenuDocument;
  go: (section: EditorSectionId, action?: "new-item") => void;
  flags: FirstRunFlags;
  onViewLive: () => void;
  onReplayTour: () => void;
}) {
  const now = new Date();
  const liveItems = doc.items.filter(i => i.active);
  const soldOut = liveItems.filter(i => isSoldOut(doc, i.id));
  const liveSpecials = activeSpecials(doc, now);
  const currentMenu = activeMenu(doc, now);

  const stats: { value: string; label: string; flame?: boolean }[] = [
    { value: String(doc.menus.length), label: doc.menus.length === 1 ? "Menu on the venue" : "Menus on the venue" },
    { value: String(liveItems.length), label: "Dishes guests can order" },
    { value: String(soldOut.length), label: "Sold out right now", flame: soldOut.length > 0 },
    { value: String(liveSpecials.length), label: "Specials running now", flame: liveSpecials.length > 0 },
  ];

  const checklist: { label: string; hint: string; done: boolean; action: () => void; cta: string }[] = [
    {
      label: "Add a dish with a photo and a price",
      hint: "Your menu starts here. One dish, done well, is enough to begin.",
      done: doc.items.some(i => i.active && i.photoUrl && (i.basePrice !== null || i.variantIds.length > 0)),
      action: () => go("items", "new-item"),
      cta: "Add food",
    },
    {
      label: "See your menu the way guests see it",
      hint: "Open the live page and read it like a customer.",
      done: flags.viewedLive,
      action: () => { onViewLive(); window.open("/", "_blank"); },
      cta: "View live menu",
    },
    {
      label: "Get your QR code and menu link",
      hint: "For your tables, your Instagram bio and your Google profile.",
      done: flags.visitedQr,
      action: () => go("qr"),
      cta: "Get QR",
    },
    {
      label: "Try marking a dish sold out",
      hint: "So the first real sold out moment is not your first practice.",
      done: doc.availability.length > 0,
      action: () => go("availability"),
      cta: "Open Sold out",
    },
  ];
  const doneCount = checklist.filter(c => c.done).length;
  const allDone = doneCount === checklist.length;

  return (
    <div>
      <SectionTitle eyebrow="At a glance" title="Overview" />
      <p className="mt-3 text-[15px] opacity-80 leading-relaxed max-w-xl">
        {currentMenu ? (
          <>Right now guests are seeing the <strong>{currentMenu.name}</strong> menu ({scheduleSummary(currentMenu.schedule.days, currentMenu.schedule.windows)}).</>
        ) : (
          <>No menu yet, so guests are seeing a placeholder page for now. Add a menu and its first dishes and this page becomes your daily control room.</>
        )}
        {soldOut.length > 0 && <> {soldOut.map(i => i.name).join(", ")} {soldOut.length === 1 ? "is" : "are"} marked sold out.</>}
        {liveSpecials.length > 0 && <> Running now: {liveSpecials.map(s => s.name).join(", ")}.</>}
      </p>

      <section className="mt-8 border hairline p-5" style={{ background: "var(--color-surface)" }} aria-label="Get your menu ready">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h3 className="font-display uppercase text-2xl">Get your menu ready</h3>
          <span className="font-mono2 text-[13px] font-bold uppercase tracking-wider" style={{ color: "var(--color-accent2)" }}>
            {allDone ? "All done" : `${doneCount} of ${checklist.length} done`}
          </span>
        </div>
        {allDone ? (
          <p className="text-[15px] opacity-80 mt-2.5 leading-relaxed">
            Your menu is ready for guests. This list has done its job; the quick actions below are your everyday controls.
          </p>
        ) : (
          <div className="mt-3 grid">
            {checklist.map(c => (
              <div key={c.label} className="flex items-center gap-3.5 py-3 border-b hairline last:border-b-0">
                <span
                  aria-hidden
                  className="w-7 h-7 shrink-0 border flex items-center justify-center font-mono2 text-[13px] font-bold"
                  style={c.done ? { background: "var(--color-accent2)", color: "#0D0A07", borderColor: "transparent" } : { borderColor: "color-mix(in srgb, var(--color-ink) 30%, transparent)" }}
                >
                  {c.done ? "✓" : ""}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={"font-semibold text-[15px] leading-tight " + (c.done ? "opacity-50 line-through" : "")}>{c.label}</p>
                  {!c.done && <p className="text-[13px] opacity-60 mt-0.5">{c.hint}</p>}
                </div>
                {!c.done && (
                  <button type="button" onClick={c.action} className="shrink-0 px-3.5 py-2.5 min-h-11 border hairline font-mono2 text-[13px] font-bold uppercase tracking-wider">
                    {c.cta}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        <button type="button" onClick={onReplayTour} className="mt-4 font-mono2 text-[13px] font-bold uppercase tracking-wider" style={{ color: "var(--color-accent)" }}>
          Show me around again
        </button>
      </section>

      <div className="mt-7 border-t hairline">
        {stats.map(s => (
          <div key={s.label} className="flex items-baseline justify-between gap-4 py-4 border-b hairline">
            <span className="text-[15px] font-semibold">{s.label}</span>
            <span className="font-display text-5xl leading-none" style={s.flame ? { color: "var(--color-accent)" } : undefined}>{s.value}</span>
          </div>
        ))}
      </div>

      <h3 className="font-display uppercase text-2xl mt-9">Quick actions</h3>
      <div className="mt-4 grid gap-2.5">
        <button type="button" onClick={() => go("items", "new-item")} className="text-left px-5 py-4 min-h-11 font-mono2 text-[13px] font-bold uppercase tracking-wider" style={{ background: "var(--color-accent)", color: "#0D0A07" }}>
          Add food
        </button>
        <button type="button" onClick={() => go("availability")} className="text-left px-5 py-4 min-h-11 border hairline font-mono2 text-[13px] font-bold uppercase tracking-wider">
          Mark a dish sold out
        </button>
        <div className="grid grid-cols-2 gap-2.5">
          <a href="/" target="_blank" rel="noreferrer" onClick={onViewLive} className="px-5 py-4 min-h-11 border hairline font-mono2 text-[13px] font-bold uppercase tracking-wider text-center">
            View live menu
          </a>
          <button type="button" onClick={() => go("qr")} className="px-5 py-4 min-h-11 border hairline font-mono2 text-[13px] font-bold uppercase tracking-wider">
            Download QR
          </button>
        </div>
      </div>

      <p className="text-[13px] opacity-60 mt-7 leading-relaxed">
        Everything here saves itself as you work, so a busy service never waits on a Save button. Guests see each change on their next visit.
      </p>
    </div>
  );
}
