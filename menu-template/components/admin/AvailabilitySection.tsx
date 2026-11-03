"use client";
import { useMemo, useState } from "react";
import type { AutoReturnPreset, Item, MenuDocument } from "../../lib/types";
import { BigToggle, SectionTitle, inputCls } from "./shared";

// THE SOLD OUT BOARD. Built for mid-service: one tap marks a dish sold
// out, one tap brings it back, and every change saves itself
// immediately. The return choice decides when the dish quietly comes
// back: end of service, tomorrow, a time you pick, or only when you
// switch it back. Return choices show ONLY on dishes that are sold out
// (Nov 3, 2026 usability fix: four chips on every row, available or
// not, buried the board mid-service). One default return everywhere:
// tomorrow, the same default the dish form uses.
const PRESETS: { value: AutoReturnPreset; label: string }[] = [
  { value: "end_of_service", label: "Back at end of service" },
  { value: "tomorrow", label: "Back tomorrow" },
  { value: "custom", label: "Back at a time" },
  { value: "indefinite", label: "Until I switch it back" },
];

export default function AvailabilitySection({ doc, onCommit }: { doc: MenuDocument; onCommit: (next: MenuDocument) => void }) {
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (name: string) => !q || name.toLowerCase().includes(q);
    const bySection = doc.sections.slice().sort((a, b) => a.sortOrder - b.sortOrder).map(sec => ({
      id: sec.id, name: sec.name,
      items: sec.itemIds.map(id => doc.items.find(i => i.id === id)).filter((i): i is Item => !!i && matches(i.name)),
    })).filter(g => g.items.length > 0);
    const placed = new Set(doc.sections.flatMap(s => s.itemIds));
    const loose = doc.items.filter(i => !placed.has(i.id) && matches(i.name));
    if (loose.length) bySection.push({ id: "__loose__", name: "Not in a section yet", items: loose });
    return bySection;
  }, [doc, query]);

  function setAvailability(itemId: string, soldOut: boolean, preset: AutoReturnPreset, returnAt?: string) {
    const next = structuredClone(doc);
    const rest = next.availability.filter(a => !(a.entityType === "item" && a.entityId === itemId));
    next.availability = [...rest, {
      entityType: "item" as const, entityId: itemId, soldOut, autoReturn: preset,
      ...(preset === "custom" && returnAt ? { returnAt } : {}),
      updatedAt: new Date().toISOString(),
    }];
    onCommit(next);
  }

  const soldCount = doc.items.filter(i => doc.availability.find(a => a.entityType === "item" && a.entityId === i.id && a.soldOut)).length;

  return (
    <div>
      <SectionTitle eyebrow="Mid-service control" title="Sold out board" />
      <p className="mt-3 text-[15px] opacity-80 leading-relaxed max-w-xl">
        When the kitchen runs out of something, tap it here. Guests see it greyed out with a sold out stamp, and it returns on the schedule you choose. Every tap saves itself.
        {soldCount > 0 && <> <strong style={{ color: "var(--color-accent)" }}>{soldCount} sold out right now.</strong></>}
      </p>

      <div className="mt-5">
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Find a dish fast..." className={inputCls} aria-label="Find a dish" />
      </div>

      <div className="mt-7 grid gap-9">
        {groups.map(group => (
          <section key={group.id} aria-label={group.name}>
            <h3 className="font-display uppercase text-2xl">{group.name}</h3>
            <div className="mt-2 border-t hairline">
              {group.items.map(item => {
                const av = doc.availability.find(a => a.entityType === "item" && a.entityId === item.id);
                const sold = !!av?.soldOut;
                const preset = av?.autoReturn ?? "tomorrow";
                return (
                  <div key={item.id} className="py-4 border-b hairline" data-availability-row={item.id}>
                    <div className="flex items-center gap-3.5">
                      {item.photoUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={item.photoUrl} alt="" className={"w-12 h-12 object-cover shrink-0 photo-grade " + (sold ? "grayscale opacity-60" : "")} />
                      ) : (
                        <span className="w-12 h-12 shrink-0 border hairline flex items-center justify-center font-display text-lg" style={{ background: "var(--color-surface)" }}>{item.name.charAt(0)}</span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-[15px] leading-tight">{item.name}</p>
                        <p className="font-mono2 text-[13px] font-bold uppercase tracking-wider mt-1" style={{ color: sold ? "var(--color-accent)" : "var(--color-accent2)" }}>
                          {sold ? `Sold out · ${PRESETS.find(p => p.value === preset)?.label.toLowerCase()}` : "Available"}
                        </p>
                      </div>
                      <BigToggle on={sold} onChange={v => setAvailability(item.id, v, preset, av?.returnAt)} label={`Sold out toggle for ${item.name}`} />
                    </div>
                    {sold && (
                      <div className="flex gap-1.5 flex-wrap mt-3">
                        {PRESETS.map(p => {
                          const on = preset === p.value;
                          return (
                            <button key={p.value} type="button" aria-pressed={on}
                              onClick={() => setAvailability(item.id, sold, p.value, av?.returnAt)}
                              className="px-3 py-2 min-h-11 inline-flex items-center text-[13px] font-semibold border"
                              style={on ? { background: "var(--color-ink)", color: "var(--color-bg)", borderColor: "transparent" } : { borderColor: "color-mix(in srgb, var(--color-ink) 20%, transparent)" }}>
                              {p.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {sold && preset === "custom" && (
                      <div className="mt-3 flex items-center gap-3 flex-wrap">
                        <span className="text-[13px] font-semibold uppercase tracking-wide opacity-80">Returns at</span>
                        <input type="datetime-local"
                          value={av?.returnAt ? av.returnAt.slice(0, 16) : ""}
                          onChange={e => setAvailability(item.id, sold, "custom", e.target.value ? new Date(e.target.value).toISOString() : undefined)}
                          className={inputCls + " font-mono2"} style={{ width: 240 }} aria-label="Return at" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
        {groups.length === 0 && <p className="text-[15px] opacity-70">Nothing matches "{query}".</p>}
      </div>
    </div>
  );
}
