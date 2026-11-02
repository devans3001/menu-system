"use client";
import type { MenuDocument } from "../../lib/types";
import { activeMenu, activeSpecials, isSoldOut } from "../../lib/specials";
import { SectionTitle, scheduleSummary, type EditorSectionId } from "./shared";

export default function OverviewSection({ doc, go }: {
  doc: MenuDocument;
  go: (section: EditorSectionId, action?: "new-item") => void;
}) {
  const now = new Date();
  const liveItems = doc.items.filter(i => i.active);
  const soldOut = liveItems.filter(i => isSoldOut(doc, i.id));
  const liveSpecials = activeSpecials(doc, now);
  const currentMenu = activeMenu(doc, now);

  const stats: { value: string; label: string; flame?: boolean }[] = [
    { value: String(doc.menus.length), label: doc.menus.length === 1 ? "Menu on the venue" : "Menus on the venue" },
    { value: String(liveItems.length), label: "Dishes guests can order" },
    { value: String(soldOut.length), label: "Sold out right now (86)", flame: soldOut.length > 0 },
    { value: String(liveSpecials.length), label: "Specials running now", flame: liveSpecials.length > 0 },
  ];

  return (
    <div>
      <SectionTitle eyebrow="At a glance" title="Overview" />
      <p className="mt-3 text-[15px] opacity-80 leading-relaxed max-w-xl">
        Right now guests are seeing the <strong>{currentMenu.name}</strong> menu ({scheduleSummary(currentMenu.schedule.days, currentMenu.schedule.windows)}).
        {soldOut.length > 0 && <> {soldOut.map(i => i.name).join(", ")} {soldOut.length === 1 ? "is" : "are"} marked sold out.</>}
        {liveSpecials.length > 0 && <> Running now: {liveSpecials.map(s => s.name).join(", ")}.</>}
      </p>

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
        <button type="button" onClick={() => go("items", "new-item")} className="text-left px-5 py-4 font-mono2 text-[13px] font-bold uppercase tracking-wider" style={{ background: "var(--color-accent)", color: "#0D0A07" }}>
          Add food
        </button>
        <button type="button" onClick={() => go("availability")} className="text-left px-5 py-4 border hairline font-mono2 text-[13px] font-bold uppercase tracking-wider">
          Mark an item sold out
        </button>
        <div className="grid grid-cols-2 gap-2.5">
          <a href="/" target="_blank" rel="noreferrer" className="px-5 py-4 border hairline font-mono2 text-[13px] font-bold uppercase tracking-wider text-center">
            View live menu
          </a>
          <button type="button" onClick={() => go("qr")} className="px-5 py-4 border hairline font-mono2 text-[13px] font-bold uppercase tracking-wider">
            Download QR
          </button>
        </div>
      </div>

      <p className="text-[13px] opacity-60 mt-7 leading-relaxed">
        Changes you make here reach guests the moment you save. Sold out switches and new dishes save on their own, so a busy service never waits on you.
      </p>
    </div>
  );
}
