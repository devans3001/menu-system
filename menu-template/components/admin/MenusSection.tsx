"use client";
import { useEffect, useRef, useState } from "react";
import type { MenuDocument, MenuEntity } from "../../lib/types";
import { DayChips, EmptyState, Field, PrimaryButton, SectionTitle, UndoToast, inputCls, scheduleSummary, uid } from "./shared";

// Menus: the venue can run several (lunch, dinner, late night). Each has
// its own days and hours; when schedules overlap the guest side shows the
// highest precedence menu. Every change here autosaves like the rest of
// the editor (the one save model, Nov 3, 2026). Removing a menu offers
// Undo for 10 seconds instead of a browser confirm box, and the Add
// button never sits dead: it always answers, with the reason when the
// name is missing.
export default function MenusSection({ doc, onChange, onCommit }: {
  doc: MenuDocument;
  onChange: (next: MenuDocument) => void;
  onCommit: (next: MenuDocument) => void;
}) {
  const [newName, setNewName] = useState("");
  const [addError, setAddError] = useState("");
  const [undo, setUndo] = useState<{ snapshot: MenuDocument; label: string } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current); }, []);

  function patchMenu(id: string, patch: Partial<MenuEntity>) {
    onChange({ ...doc, menus: doc.menus.map(m => (m.id === id ? { ...m, ...patch } : m)) });
  }
  function patchWindow(menu: MenuEntity, idx: number, patch: Partial<{ start: string; end: string }>) {
    patchMenu(menu.id, { schedule: { ...menu.schedule, windows: menu.schedule.windows.map((w, i) => (i === idx ? { ...w, ...patch } : w)) } });
  }
  function addMenu() {
    const name = newName.trim();
    if (!name) { setAddError("Give the menu a name first, like Brunch or Late Night."); return; }
    setAddError("");
    const menu: MenuEntity = {
      id: uid("menu"),
      venueId: doc.venue.id,
      name,
      schedule: { days: [0, 1, 2, 3, 4, 5, 6], windows: [{ start: "09:00", end: "22:00" }] },
      precedence: Math.min(0, ...doc.menus.map(m => m.precedence)) - 1,
      taxIncluded: true,
      priceNote: doc.menus[0]?.priceNote ?? "",
      sectionIds: [],
    };
    setNewName("");
    onCommit({ ...doc, menus: [...doc.menus, menu] });
  }
  function removeMenu(menu: MenuEntity) {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo({ snapshot: structuredClone(doc), label: `${menu.name} menu removed. Its sections and dishes are untouched.` });
    undoTimer.current = setTimeout(() => setUndo(null), 10000);
    onCommit({ ...doc, menus: doc.menus.filter(m => m.id !== menu.id) });
  }
  function doUndo() {
    if (!undo) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    onCommit(undo.snapshot);
    setUndo(null);
  }

  return (
    <div>
      <SectionTitle eyebrow="When each menu runs" title="Menus" />
      <p className="mt-3 text-[15px] opacity-80 leading-relaxed max-w-xl">
        Guests always see one menu at a time: the one whose day and hours match the moment. Tick the sections each menu should carry.
        Every change here saves itself as you make it.
      </p>

      <div className="mt-7 grid gap-6">
        {doc.menus.map(menu => (
          <article key={menu.id} className="border hairline p-5 grain" style={{ background: "var(--color-surface)" }}>
            <div className="relative z-[2]">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1 basis-56">
                  <Field label="Menu name">
                    <input value={menu.name} onChange={e => patchMenu(menu.id, { name: e.target.value })} className={inputCls} aria-label="Menu name" />
                  </Field>
                </div>
                {doc.menus.length > 1 && (
                  <button type="button" onClick={() => removeMenu(menu)} className="mt-6 px-4 py-2.5 border hairline font-mono2 text-[13px] font-bold uppercase tracking-wider" style={{ color: "var(--color-accent)" }}>
                    Remove menu
                  </button>
                )}
              </div>
              <p className="font-mono2 text-[13px] mt-3" style={{ color: "var(--color-accent2)" }}>{scheduleSummary(menu.schedule.days, menu.schedule.windows)}</p>

              <div className="mt-5">
                <span className="text-[13px] font-semibold uppercase tracking-wide opacity-90">Days it runs</span>
                <div className="mt-2">
                  <DayChips days={menu.schedule.days} onChange={days => patchMenu(menu.id, { schedule: { ...menu.schedule, days } })} />
                </div>
              </div>

              <div className="mt-5">
                <span className="text-[13px] font-semibold uppercase tracking-wide opacity-90">Hours</span>
                <div className="grid gap-2 mt-2">
                  {menu.schedule.windows.map((w, i) => (
                    <div key={i} className="flex items-center gap-2 flex-wrap">
                      <input type="time" value={w.start} onChange={e => patchWindow(menu, i, { start: e.target.value })} className={inputCls + " font-mono2"} style={{ width: 140 }} aria-label="Opens" />
                      <span className="opacity-60 text-[13px] font-semibold uppercase">to</span>
                      <input type="time" value={w.end} onChange={e => patchWindow(menu, i, { end: e.target.value })} className={inputCls + " font-mono2"} style={{ width: 140 }} aria-label="Closes" />
                      {menu.schedule.windows.length > 1 && (
                        <button type="button" onClick={() => patchMenu(menu.id, { schedule: { ...menu.schedule, windows: menu.schedule.windows.filter((_, j) => j !== i) } })} className="px-3 py-2 border hairline font-mono2 text-[13px] font-bold uppercase">Remove</button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={() => patchMenu(menu.id, { schedule: { ...menu.schedule, windows: [...menu.schedule.windows, { start: "12:00", end: "14:00" }] } })} className="justify-self-start px-3 py-2 border hairline font-mono2 text-[13px] font-bold uppercase tracking-wider">
                    Add hours
                  </button>
                </div>
                <p className="text-[13px] opacity-60 mt-2">A close time earlier than the open time runs past midnight.</p>
              </div>

              <div className="mt-5">
                <span className="text-[13px] font-semibold uppercase tracking-wide opacity-90">Sections on this menu</span>
                <div className="flex gap-1.5 flex-wrap mt-2">
                  {doc.sections.map(sec => {
                    const on = menu.sectionIds.includes(sec.id);
                    return (
                      <button key={sec.id} type="button" aria-pressed={on}
                        onClick={() => patchMenu(menu.id, { sectionIds: on ? menu.sectionIds.filter(id => id !== sec.id) : [...menu.sectionIds, sec.id] })}
                        className="px-3 py-2.5 min-h-11 text-[13px] font-semibold border"
                        style={on ? { background: "var(--color-ink)", color: "var(--color-bg)", borderColor: "transparent" } : { borderColor: "color-mix(in srgb, var(--color-ink) 20%, transparent)" }}>
                        {sec.name}
                      </button>
                    );
                  })}
                  {doc.sections.length === 0 && <span className="text-[13px] opacity-60">No sections yet. Sections are created from the Items page when you add food.</span>}
                </div>
              </div>

              <div className="grid sm:grid-cols-[1fr_auto] gap-4 mt-5 items-end">
                <Field label="Price note shown to guests">
                  <input value={menu.priceNote} onChange={e => patchMenu(menu.id, { priceNote: e.target.value })} className={inputCls} placeholder="All prices include taxes." />
                </Field>
                <label className="flex items-center gap-3 text-[13px] font-semibold uppercase tracking-wide pb-1">
                  <input type="checkbox" checked={menu.taxIncluded} onChange={e => patchMenu(menu.id, { taxIncluded: e.target.checked })} className="w-5 h-5 accent-[#FF5C1F]" />
                  Prices include tax
                </label>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-8 border-t hairline pt-6">
        <h3 className="font-display uppercase text-2xl">Add a menu</h3>
        <p className="text-[15px] opacity-75 mt-2 max-w-lg leading-relaxed">A brunch menu, a Ramadan menu, a late night menu. It starts empty: give it hours above, then tick its sections.</p>
        <div className="flex gap-2.5 mt-4 flex-wrap">
          <input value={newName} onChange={e => { setNewName(e.target.value); if (addError) setAddError(""); }} placeholder="Menu name, e.g. Brunch" className={inputCls} style={{ maxWidth: 320 }} aria-label="New menu name" />
          <PrimaryButton onClick={addMenu}>Add menu</PrimaryButton>
        </div>
        {addError && <p className="text-[13px] mt-2.5" style={{ color: "var(--color-accent)" }} role="alert">{addError}</p>}
      </div>

      {undo && <UndoToast message={undo.label} onUndo={doUndo} />}

      {doc.menus.length === 0 && <div className="mt-6"><EmptyState title="No menus yet" body="Add your first menu above. Guests cannot see anything until a menu carries at least one section." /></div>}
    </div>
  );
}
