"use client";
import { useState } from "react";
import type { MenuDocument, Special, SpecialRuleType } from "../../lib/types";
import { formatPrice } from "../../lib/format";
import { isScheduleActive } from "../../lib/specials";
import { DayChips, EmptyState, Field, GhostButton, PrimaryButton, SectionTitle, inputCls, parsePrice, scheduleSummary, uid } from "./shared";

// Specials are scheduled price rules laid over the menu, never edited
// copies of a dish. When the window ends, the dish returns to its normal
// price on its own. Gold is the specials colour, per the poster system.
interface SpecialDraft {
  name: string;
  headline: string;
  badgeText: string;
  terms: string;
  appliesTo: "all" | "section" | "items";
  sectionId: string;
  itemIds: string[];
  ruleType: "percent_off" | "amount_off" | "fixed_special_price";
  ruleValue: string;
  days: number[];
  start: string;
  end: string;
  startsAt: string;
  endsAt: string;
}

function draftFromSpecial(doc: MenuDocument, s: Special): SpecialDraft {
  const appliesTo = s.targetItemIds.length ? "items" : s.targetSectionIds.length >= Math.max(1, doc.sections.length) && doc.sections.every(sec => s.targetSectionIds.includes(sec.id)) ? "all" : "section";
  return {
    name: s.name,
    headline: s.headline,
    badgeText: s.badgeText,
    terms: s.terms ?? "",
    appliesTo,
    sectionId: s.targetSectionIds[0] ?? doc.sections[0]?.id ?? "",
    itemIds: [...s.targetItemIds],
    ruleType: s.ruleType === "amount_off" || s.ruleType === "fixed_special_price" ? s.ruleType : "percent_off",
    ruleValue: String(s.ruleValue),
    days: [...s.schedule.days],
    start: s.schedule.windows[0]?.start ?? "16:00",
    end: s.schedule.windows[0]?.end ?? "19:00",
    startsAt: s.schedule.startsAt ? s.schedule.startsAt.slice(0, 10) : "",
    endsAt: s.schedule.endsAt ? s.schedule.endsAt.slice(0, 10) : "",
  };
}

function blankDraft(doc: MenuDocument): SpecialDraft {
  return {
    name: "", headline: "", badgeText: "", terms: "",
    appliesTo: "section", sectionId: doc.sections[0]?.id ?? "", itemIds: [],
    ruleType: "percent_off", ruleValue: "20",
    days: [1, 2, 3, 4, 5], start: "16:00", end: "19:00", startsAt: "", endsAt: "",
  };
}

function ruleSummary(doc: MenuDocument, s: Special): string {
  const c = doc.venue.currency;
  switch (s.ruleType) {
    case "percent_off": return `${s.ruleValue}% off`;
    case "amount_off": return `${formatPrice(s.ruleValue, c)} off`;
    case "fixed_special_price": return `Fixed at ${formatPrice(s.ruleValue, c)}`;
    case "bundle_price": return `Bundle at ${formatPrice(s.ruleValue, c)}`;
    case "buy_x_get_y": return `Buy ${s.buyX ?? 0} get ${s.getY ?? 0}`;
    default: return s.ruleType;
  }
}

export default function SpecialsSection({ doc, onCommit }: { doc: MenuDocument; onCommit: (next: MenuDocument) => void }) {
  const [editing, setEditing] = useState<Special | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<SpecialDraft>(() => blankDraft(doc));
  const [errors, setErrors] = useState<string[]>([]);

  const openNew = () => { setEditing(null); setDraft(blankDraft(doc)); setErrors([]); setFormOpen(true); };
  const openEdit = (s: Special) => { setEditing(s); setDraft(draftFromSpecial(doc, s)); setErrors([]); setFormOpen(true); };
  const set = (patch: Partial<SpecialDraft>) => setDraft(d => ({ ...d, ...patch }));

  function save() {
    const errs: string[] = [];
    if (!draft.name.trim()) errs.push("Give the special a name.");
    const value = parsePrice(draft.ruleValue);
    if (value === null || Number.isNaN(value) || value < 0) errs.push("The discount value must be a number, 0 or more.");
    if (draft.ruleType === "percent_off" && value !== null && value > 100) errs.push("A percent off cannot pass 100.");
    if (draft.days.length === 0) errs.push("Pick at least one day.");
    if (!draft.start || !draft.end) errs.push("Set the start and end time.");
    if (draft.appliesTo === "section" && !draft.sectionId) errs.push("Pick the section this special covers.");
    if (draft.appliesTo === "items" && draft.itemIds.length === 0) errs.push("Tick at least one dish, or apply the special to a section or the whole menu.");
    setErrors(errs);
    if (errs.length) return;

    const saved: Special = {
      id: editing?.id ?? uid("special"),
      name: draft.name.trim(),
      headline: draft.headline.trim() || draft.name.trim(),
      badgeText: draft.badgeText.trim() || draft.name.trim(),
      terms: draft.terms.trim() || undefined,
      schedule: {
        days: draft.days,
        windows: [{ start: draft.start, end: draft.end }],
        ...(draft.startsAt ? { startsAt: draft.startsAt } : {}),
        ...(draft.endsAt ? { endsAt: draft.endsAt } : {}),
      },
      ruleType: draft.ruleType as SpecialRuleType,
      ruleValue: value ?? 0,
      targetItemIds: draft.appliesTo === "items" ? draft.itemIds : [],
      targetSectionIds: draft.appliesTo === "all" ? doc.sections.map(s => s.id) : draft.appliesTo === "section" ? [draft.sectionId] : [],
    };
    const next = structuredClone(doc);
    next.specials = editing ? next.specials.map(s => (s.id === saved.id ? saved : s)) : [...next.specials, saved];
    onCommit(next);
    setFormOpen(false);
  }

  function remove(s: Special) {
    if (!window.confirm(`Delete the ${s.name} special? Dishes return to their normal prices.`)) return;
    onCommit({ ...structuredClone(doc), specials: doc.specials.filter(x => x.id !== s.id) });
  }

  return (
    <div>
      <SectionTitle eyebrow="Timed price rules" title="Specials">
        <PrimaryButton onClick={openNew}>Add special</PrimaryButton>
      </SectionTitle>
      <p className="mt-3 text-[15px] opacity-80 leading-relaxed max-w-xl">
        A special is a rule laid over your normal prices for a window of time. The dish itself is never edited, so when the window closes the real price is already back.
      </p>

      {doc.specials.length === 0 ? (
        <div className="mt-7">
          <EmptyState title="No specials yet" body="Add your first happy hour: pick the dishes or the section, the discount, and the hours. It switches itself on and off.">
            <PrimaryButton onClick={openNew}>Add your first special</PrimaryButton>
          </EmptyState>
        </div>
      ) : (
        <div className="mt-7 grid gap-4">
          {doc.specials.map(s => {
            const live = isScheduleActive(s.schedule);
            const targets = s.targetItemIds.length
              ? s.targetItemIds.map(id => doc.items.find(i => i.id === id)?.name ?? "a removed dish").join(", ")
              : s.targetSectionIds.length >= doc.sections.length && doc.sections.length > 0
                ? "Whole menu"
                : s.targetSectionIds.map(id => doc.sections.find(x => x.id === id)?.name ?? "a removed section").join(", ");
            return (
              <article key={s.id} className="border hairline p-5 gold-leaf" style={{ background: "var(--color-surface)", borderColor: live ? "var(--color-accent2)" : undefined }}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <h3 className="font-display uppercase text-2xl leading-none">{s.name}</h3>
                    <p className="font-serif2 italic text-lg mt-1.5 opacity-90">{s.headline}</p>
                  </div>
                  {live
                    ? <span className="font-mono2 text-[13px] font-bold uppercase tracking-wider px-2.5 py-1" style={{ background: "var(--color-accent2)", color: "#0D0A07" }}>Live now</span>
                    : <span className="font-mono2 text-[13px] font-bold uppercase tracking-wider px-2.5 py-1 border hairline opacity-70">Not in its window</span>}
                </div>
                <div className="flex gap-x-6 gap-y-1.5 mt-4 flex-wrap text-[15px]">
                  <span><span className="opacity-60 text-[13px] font-semibold uppercase tracking-wide">Rule&nbsp;&nbsp;</span><span className="font-mono2 text-[13px] font-bold" style={{ color: "var(--color-accent2)" }}>{ruleSummary(doc, s)}</span></span>
                  <span><span className="opacity-60 text-[13px] font-semibold uppercase tracking-wide">Covers&nbsp;&nbsp;</span>{targets}</span>
                  <span><span className="opacity-60 text-[13px] font-semibold uppercase tracking-wide">When&nbsp;&nbsp;</span>{scheduleSummary(s.schedule.days, s.schedule.windows)}</span>
                </div>
                {s.terms && <p className="text-[13px] opacity-60 mt-3">{s.terms}</p>}
                <div className="flex gap-2.5 mt-4">
                  <button type="button" onClick={() => openEdit(s)} className="px-4 py-2.5 border hairline font-mono2 text-[13px] font-bold uppercase tracking-wider">Edit</button>
                  <button type="button" onClick={() => remove(s)} className="px-4 py-2.5 font-mono2 text-[13px] font-bold uppercase tracking-wider" style={{ color: "var(--color-accent)" }}>Delete</button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: "var(--color-bg)" }} role="dialog" aria-modal="true" aria-label={editing ? "Edit special" : "Add special"}>
          <div className="max-w-3xl mx-auto px-5 py-6 pb-16">
            <div className="flex items-start justify-between gap-4 pb-5 border-b hairline sticky top-0 z-10" style={{ background: "var(--color-bg)" }}>
              <div>
                <p className="font-mono2 text-[13px] uppercase tracking-[0.22em]" style={{ color: "var(--color-accent2)" }}>{editing ? "Edit special" : "Add special"}</p>
                <h2 className="font-display uppercase text-4xl leading-none mt-2">{draft.name.trim() || "New special"}</h2>
              </div>
              <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2.5 border hairline font-mono2 text-[13px] font-bold uppercase tracking-wider shrink-0">Close</button>
            </div>

            <div className="grid gap-6 mt-7">
              <div className="grid sm:grid-cols-2 gap-5">
                <Field label="Special name">
                  <input value={draft.name} onChange={e => set({ name: e.target.value })} className={inputCls} placeholder="e.g. Happy Hour" data-testid="special-name" />
                </Field>
                <Field label="Badge guests see">
                  <input value={draft.badgeText} onChange={e => set({ badgeText: e.target.value })} className={inputCls} placeholder="e.g. Happy hour" />
                </Field>
              </div>
              <Field label="Headline">
                <input value={draft.headline} onChange={e => set({ headline: e.target.value })} className={inputCls} placeholder="e.g. 25 percent off drinks, 4 to 7" />
              </Field>

              <div>
                <span className="text-[13px] font-semibold uppercase tracking-wide opacity-90">Applies to</span>
                <div className="flex gap-1.5 mt-2 flex-wrap" role="group" aria-label="Applies to">
                  {([["all", "Whole menu"], ["section", "One section"], ["items", "Chosen dishes"]] as const).map(([v, label]) => (
                    <button key={v} type="button" aria-pressed={draft.appliesTo === v} onClick={() => set({ appliesTo: v })}
                      className="px-4 py-2.5 text-[13px] font-semibold border"
                      style={draft.appliesTo === v ? { background: "var(--color-accent2)", color: "#0D0A07", borderColor: "transparent" } : { borderColor: "color-mix(in srgb, var(--color-ink) 20%, transparent)" }}>
                      {label}
                    </button>
                  ))}
                </div>
                {draft.appliesTo === "section" && (
                  <div className="mt-3">
                    <select value={draft.sectionId} onChange={e => set({ sectionId: e.target.value })} className={inputCls} style={{ background: "var(--color-surface)", maxWidth: 360 }} aria-label="Section">
                      {doc.sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                )}
                {draft.appliesTo === "items" && (
                  <div className="flex gap-1.5 flex-wrap mt-3">
                    {doc.items.filter(i => i.active).map(i => {
                      const on = draft.itemIds.includes(i.id);
                      return (
                        <button key={i.id} type="button" aria-pressed={on}
                          onClick={() => set({ itemIds: on ? draft.itemIds.filter(id => id !== i.id) : [...draft.itemIds, i.id] })}
                          className="px-3 py-2 text-[13px] font-semibold border"
                          style={on ? { background: "var(--color-ink)", color: "var(--color-bg)", borderColor: "transparent" } : { borderColor: "color-mix(in srgb, var(--color-ink) 20%, transparent)" }}>
                          {i.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-5">
                <Field label="Discount shape">
                  <select value={draft.ruleType} onChange={e => set({ ruleType: e.target.value as SpecialDraft["ruleType"] })} className={inputCls} style={{ background: "var(--color-surface)" }}>
                    <option value="percent_off">Percent off</option>
                    <option value="amount_off">Amount off</option>
                    <option value="fixed_special_price">Fixed special price</option>
                  </select>
                </Field>
                <Field label={draft.ruleType === "percent_off" ? "Percent off" : `Value (${doc.venue.currency})`}>
                  <input inputMode="numeric" value={draft.ruleValue} onChange={e => set({ ruleValue: e.target.value })} className={inputCls + " font-mono2"} placeholder={draft.ruleType === "percent_off" ? "e.g. 25" : "e.g. 5500"} />
                </Field>
              </div>

              <div>
                <span className="text-[13px] font-semibold uppercase tracking-wide opacity-90">Days it runs</span>
                <div className="mt-2"><DayChips days={draft.days} onChange={days => set({ days })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-5" style={{ maxWidth: 420 }}>
                <Field label="Starts at">
                  <input type="time" value={draft.start} onChange={e => set({ start: e.target.value })} className={inputCls + " font-mono2"} />
                </Field>
                <Field label="Ends at">
                  <input type="time" value={draft.end} onChange={e => set({ end: e.target.value })} className={inputCls + " font-mono2"} />
                </Field>
              </div>
              <div className="grid sm:grid-cols-2 gap-5">
                <Field label="First day (optional)" hint="Leave blank to run every week.">
                  <input type="date" value={draft.startsAt} onChange={e => set({ startsAt: e.target.value })} className={inputCls + " font-mono2"} />
                </Field>
                <Field label="Last day (optional)">
                  <input type="date" value={draft.endsAt} onChange={e => set({ endsAt: e.target.value })} className={inputCls + " font-mono2"} />
                </Field>
              </div>
              <Field label="Terms (optional)">
                <input value={draft.terms} onChange={e => set({ terms: e.target.value })} className={inputCls} placeholder="e.g. Dine in only" />
              </Field>

              {errors.length > 0 && (
                <div className="border p-4" style={{ borderColor: "var(--color-accent)", background: "var(--color-surface)" }} role="alert">
                  <p className="font-mono2 text-[13px] font-bold uppercase tracking-wider" style={{ color: "var(--color-accent)" }}>Fix these first</p>
                  <ul className="mt-2 grid gap-1 text-[15px]">{errors.map(e => <li key={e}>{e}</li>)}</ul>
                </div>
              )}

              <div className="flex gap-2.5 flex-wrap border-t hairline pt-5">
                <PrimaryButton onClick={save}>{editing ? "Save special" : "Add special"}</PrimaryButton>
                <GhostButton onClick={() => setFormOpen(false)}>Cancel</GhostButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
