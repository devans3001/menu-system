"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Allergen, DietaryTag, Item, MenuDocument, PriceType } from "../../lib/types";
import { ALLERGENS, DIETARY_TAGS } from "../../lib/vocab";
import { cloudinaryUploadConfigured, uploadPhotoToCloudinary } from "../../lib/upload/cloudinary";
import { restaurantConfig } from "../../restaurant.config";
import { BigToggle, ChipMultiSelect, Field, GhostButton, PrimaryButton, inputCls, parsePrice, uid } from "./shared";

const NEW_SECTION = "__new__";
const NO_SECTION = "__none__";

interface VariantDraft { key: string; id?: string; name: string; price: string }
interface OptionDraft { key: string; id?: string; name: string; price: string }
interface GroupDraft { key: string; id?: string; name: string; required: boolean; min: string; max: string; options: OptionDraft[] }

interface ItemDraft {
  name: string;
  subtitle: string;
  description: string;
  sectionId: string;
  newSectionName: string;
  newSectionMenuIds: string[];
  priceType: PriceType;
  basePrice: string;
  todaysMarketPrice: string;
  photoUrl: string;
  dietaryTags: DietaryTag[];
  allergenContains: Allergen[];
  badgeLabel: string;
  serves: string;
  isHot: boolean;
  active: boolean;
  soldOut: boolean;
  variants: VariantDraft[];
  groups: GroupDraft[];
}

function draftFromItem(doc: MenuDocument, item: Item): ItemDraft {
  const home = doc.sections.find(s => s.itemIds.includes(item.id));
  return {
    name: item.name,
    subtitle: item.subtitle ?? "",
    description: item.description,
    sectionId: home?.id ?? NO_SECTION,
    newSectionName: "",
    newSectionMenuIds: doc.menus.map(m => m.id),
    priceType: item.priceType,
    basePrice: item.basePrice === null || item.basePrice === undefined ? "" : String(item.basePrice),
    todaysMarketPrice: item.todaysMarketPrice === null || item.todaysMarketPrice === undefined ? "" : String(item.todaysMarketPrice),
    photoUrl: item.photoUrl ?? "",
    dietaryTags: [...item.dietaryTags],
    allergenContains: [...item.allergenContains],
    badgeLabel: item.badges[0]?.label ?? "",
    serves: item.serves ?? "",
    isHot: item.isHot,
    active: item.active,
    soldOut: !!doc.availability.find(a => a.entityType === "item" && a.entityId === item.id && a.soldOut),
    variants: doc.variants.filter(v => item.variantIds.includes(v.id)).sort((a, b) => a.sortOrder - b.sortOrder)
      .map(v => ({ key: v.id, id: v.id, name: v.name, price: v.price === null ? "" : String(v.price) })),
    groups: doc.modifierGroups.filter(g => item.modifierGroupIds.includes(g.id)).sort((a, b) => a.sortOrder - b.sortOrder)
      .map(g => ({
        key: g.id, id: g.id, name: g.name, required: g.required, min: String(g.min), max: String(g.max),
        options: doc.modifierOptions.filter(o => g.optionIds.includes(o.id)).sort((a, b) => a.sortOrder - b.sortOrder)
          .map(o => ({ key: o.id, id: o.id, name: o.name, price: String(o.price) })),
      })),
  };
}

function blankDraft(doc: MenuDocument): ItemDraft {
  const firstSection = doc.sections.slice().sort((a, b) => a.sortOrder - b.sortOrder)[0];
  return {
    name: "", subtitle: "", description: "",
    sectionId: firstSection?.id ?? NEW_SECTION,
    newSectionName: "", newSectionMenuIds: doc.menus.map(m => m.id),
    priceType: "fixed", basePrice: "", todaysMarketPrice: "", photoUrl: "",
    dietaryTags: [], allergenContains: [], badgeLabel: "", serves: "",
    isHot: false, active: true, soldOut: false, variants: [], groups: [],
  };
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const STEPS = [
  { n: 1, name: "The dish" },
  { n: 2, name: "Price and photo" },
  { n: 3, name: "Choices and details" },
] as const;

// Add and edit panel, in three short steps (Nov 3, 2026 usability fix:
// the old single page of about 25 fields overwhelmed non-technical
// owners). Each step validates as the owner leaves it, not in one list
// at the end. The draft autosaves to this device as they type, so
// closing the panel or taking a phone call loses nothing. Photo comes
// upload-first with progress, an in-place retry and a receipt; a photo
// link is the secondary route. Deleting asks in the design (never the
// browser's confirm box) and the Dishes list offers Undo afterwards.
export default function ItemForm({ doc, item, onClose, onCommit, onDeleted, onCreateMenuFirst }: {
  doc: MenuDocument;
  item: Item | null; // null = adding new food
  onClose: () => void;
  onCommit: (next: MenuDocument) => void;
  onDeleted?: (name: string) => void;
  onCreateMenuFirst?: () => void;
}) {
  const draftKey = `claro-menu-draft-v1:${item?.id ?? "new"}`;
  const [draft, setDraft] = useState<ItemDraft>(() => (item ? draftFromItem(doc, item) : blankDraft(doc)));
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<string[]>([]);
  const [draftRestored, setDraftRestored] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [receipt, setReceipt] = useState<{ name: string; size: string; type: string } | null>(null);
  const [showLinkField, setShowLinkField] = useState(false);
  const uploadsConfigured = cloudinaryUploadConfigured();
  const currency = doc.venue.currency;
  const restoredRef = useRef(false);

  // Restore an interrupted draft once, on open.
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (raw) {
        const parsed = JSON.parse(raw) as ItemDraft;
        if (parsed && typeof parsed.name === "string") { setDraft(parsed); setDraftRestored(true); }
      }
    } catch { /* a broken draft never blocks the form */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave the draft to this device as the owner types.
  useEffect(() => {
    if (!restoredRef.current) return;
    try { window.localStorage.setItem(draftKey, JSON.stringify(draft)); } catch { /* storage full or blocked: the form still works */ }
  }, [draft, draftKey]);

  const clearDraft = () => { try { window.localStorage.removeItem(draftKey); } catch { /* ignore */ } };
  const discardDraft = () => {
    clearDraft();
    setDraft(item ? draftFromItem(doc, item) : blankDraft(doc));
    setDraftRestored(false);
    setErrors([]);
    setStep(1);
  };

  const set = (patch: Partial<ItemDraft>) => setDraft(d => ({ ...d, ...patch }));
  const sortedSections = useMemo(() => doc.sections.slice().sort((a, b) => a.sortOrder - b.sortOrder), [doc.sections]);

  async function doUpload(file: File | undefined) {
    if (!file) return;
    setLastFile(file);
    setUploadError("");
    setUploadPct(0);
    setUploading(true);
    try {
      const url = await uploadPhotoToCloudinary(file, restaurantConfig.cloudinary.folder, pct => setUploadPct(pct));
      set({ photoUrl: url });
      setReceipt({ name: file.name, size: formatBytes(file.size), type: file.type.replace("image/", "").toUpperCase() || "Photo" });
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "The upload did not finish. Your photo is still here, tap Try again.");
    } finally {
      setUploading(false);
      setUploadPct(null);
    }
  }

  function validateStep(which: number): string[] {
    const errs: string[] = [];
    if (which === 1) {
      if (!draft.name.trim()) errs.push("Give the dish a name.");
      if (draft.sectionId === NEW_SECTION && !draft.newSectionName.trim()) errs.push("Name the new section, or pick an existing one.");
      if (draft.sectionId !== NEW_SECTION && draft.sectionId !== NO_SECTION && !doc.sections.some(s => s.id === draft.sectionId)) errs.push("That section no longer exists. Pick another.");
    }
    if (which === 2) {
      if (Number.isNaN(parsePrice(draft.basePrice))) errs.push("The price must be a number.");
      if (Number.isNaN(parsePrice(draft.todaysMarketPrice))) errs.push("Today's market price must be a number.");
    }
    if (which === 3) {
      const base = parsePrice(draft.basePrice);
      const pricedVariant = draft.variants.some(v => v.name.trim() && parsePrice(v.price) !== null && !Number.isNaN(parsePrice(v.price)));
      if ((draft.priceType === "fixed" || draft.priceType === "per_person" || draft.priceType === "per_weight") && base === null && !pricedVariant) {
        errs.push("This dish has no price yet. Add one in step 2, or give at least one size a price in this step.");
      }
      for (const v of draft.variants) {
        if (!v.name.trim()) errs.push("Every size or choice needs a name.");
        if (Number.isNaN(parsePrice(v.price))) errs.push(`The price for "${v.name}" must be a number.`);
      }
      for (const g of draft.groups) {
        if (!g.name.trim()) errs.push("Every set of choices needs a name, like Choose your soup.");
        if (g.options.length === 0) errs.push(`The set "${g.name}" has no choices yet.`);
        for (const o of g.options) {
          if (!o.name.trim()) errs.push(`Every choice in "${g.name}" needs a name.`);
          const p = parsePrice(o.price);
          if (p === null || Number.isNaN(p) || p < 0) errs.push(`The price for "${o.name}" must be 0 or more.`);
        }
      }
    }
    return errs;
  }

  function goNext() {
    const errs = validateStep(step);
    setErrors(errs);
    if (errs.length) return;
    setStep(s => Math.min(3, s + 1));
  }
  function goBack() { setErrors([]); setStep(s => Math.max(1, s - 1)); }

  function save() {
    const errs = [...validateStep(1), ...validateStep(2), ...validateStep(3)];
    setErrors(errs);
    if (errs.length) {
      // Send the owner to the earliest step that needs work.
      if (validateStep(1).length) setStep(1);
      else if (validateStep(2).length) setStep(2);
      else setStep(3);
      return;
    }

    const next = structuredClone(doc);
    const itemId = item?.id ?? uid("item");
    const nowIso = new Date().toISOString();

    let targetSectionId: string | null = draft.sectionId === NO_SECTION ? null : draft.sectionId;
    if (draft.sectionId === NEW_SECTION) {
      const secId = uid("sec");
      next.sections.push({
        id: secId, name: draft.newSectionName.trim(), note: "", parentId: null,
        sortOrder: Math.max(0, ...next.sections.map(s => s.sortOrder)) + 1,
        itemIds: [], childSectionIds: [],
      });
      for (const m of next.menus) if (draft.newSectionMenuIds.includes(m.id) && !m.sectionIds.includes(secId)) m.sectionIds.push(secId);
      targetSectionId = secId;
    }

    const oldGroupIds = item?.modifierGroupIds ?? [];
    const oldOptionIds = new Set(next.modifierOptions.filter(o => oldGroupIds.includes(o.groupId)).map(o => o.id));
    const variantIds: string[] = [];
    const newVariants = draft.variants.filter(v => v.name.trim()).map((v, i) => {
      const id = v.id ?? uid("var");
      variantIds.push(id);
      return { id, itemId, name: v.name.trim(), price: parsePrice(v.price), priceType: "fixed" as PriceType, sortOrder: i + 1, active: true };
    });
    const groupIds: string[] = [];
    const newGroups: MenuDocument["modifierGroups"] = [];
    const newOptions: MenuDocument["modifierOptions"] = [];
    draft.groups.forEach((g, gi) => {
      const gid = g.id ?? uid("grp");
      groupIds.push(gid);
      const optionIds: string[] = [];
      g.options.filter(o => o.name.trim()).forEach((o, oi) => {
        const oid = o.id ?? uid("opt");
        optionIds.push(oid);
        const previous = o.id ? next.modifierOptions.find(x => x.id === o.id) : undefined;
        newOptions.push({
          id: oid, groupId: gid, name: o.name.trim(), price: parsePrice(o.price) ?? 0, sortOrder: oi + 1,
          ...(previous?.priceByVariant ? { priceByVariant: previous.priceByVariant } : {}),
        });
      });
      const min = Math.max(0, Math.floor(Number(g.min) || 0));
      const max = Math.max(min, Math.floor(Number(g.max) || optionIds.length || 1));
      newGroups.push({ id: gid, itemId, name: g.name.trim(), min, max, required: g.required, sortOrder: gi + 1, optionIds });
    });

    next.variants = [...next.variants.filter(v => !(item?.variantIds ?? []).includes(v.id)), ...newVariants];
    next.modifierGroups = [...next.modifierGroups.filter(g => !oldGroupIds.includes(g.id)), ...newGroups];
    next.modifierOptions = [...next.modifierOptions.filter(o => !oldOptionIds.has(o.id)), ...newOptions];

    const previousBadges = item?.badges ?? [];
    const badges = draft.badgeLabel.trim()
      ? [{ type: previousBadges[0]?.type ?? ("custom" as const), label: draft.badgeLabel.trim() }, ...previousBadges.slice(1)]
      : previousBadges.slice(1);

    const savedItem: Item = {
      id: itemId,
      name: draft.name.trim(),
      subtitle: draft.subtitle.trim() || undefined,
      description: draft.description.trim(),
      photoUrl: draft.photoUrl.trim() || undefined,
      basePrice: draft.priceType === "market" ? null : parsePrice(draft.basePrice),
      priceType: draft.priceType,
      todaysMarketPrice: draft.priceType === "market" ? parsePrice(draft.todaysMarketPrice) : item?.todaysMarketPrice,
      dietaryTags: draft.dietaryTags,
      allergenContains: draft.allergenContains,
      badges,
      serves: draft.serves.trim() || undefined,
      isHot: draft.isHot,
      active: draft.active,
      wine: item?.wine,
      variantIds,
      modifierGroupIds: groupIds,
      calories: item?.calories,
      priceUnit: item?.priceUnit,
    };
    next.items = item ? next.items.map(i => (i.id === itemId ? savedItem : i)) : [...next.items, savedItem];

    for (const s of next.sections) s.itemIds = s.itemIds.filter(id => id !== itemId);
    if (targetSectionId) {
      const home = next.sections.find(s => s.id === targetSectionId);
      if (home) home.itemIds.push(itemId);
    }

    // One default return everywhere: back tomorrow, unless the owner
    // already chose a different return on the Sold out board.
    const rest = next.availability.filter(a => !(a.entityType === "item" && a.entityId === itemId));
    const previousAv = doc.availability.find(a => a.entityType === "item" && a.entityId === itemId);
    next.availability = [...rest, { entityType: "item" as const, entityId: itemId, soldOut: draft.soldOut, autoReturn: previousAv?.autoReturn ?? "tomorrow", ...(previousAv?.returnAt ? { returnAt: previousAv.returnAt } : {}), updatedAt: nowIso }];

    clearDraft();
    onCommit(next);
    onClose();
  }

  function remove() {
    if (!item) return;
    const next = structuredClone(doc);
    next.items = next.items.filter(i => i.id !== item.id);
    next.variants = next.variants.filter(v => !item.variantIds.includes(v.id));
    next.modifierOptions = next.modifierOptions.filter(o => !item.modifierGroupIds.includes(o.groupId));
    next.modifierGroups = next.modifierGroups.filter(g => !item.modifierGroupIds.includes(g.id));
    for (const s of next.sections) s.itemIds = s.itemIds.filter(id => id !== item.id);
    next.availability = next.availability.filter(a => !(a.entityType === "item" && a.entityId === item.id));
    for (const sp of next.specials) sp.targetItemIds = sp.targetItemIds.filter(id => id !== item.id);
    clearDraft();
    onCommit(next);
    onDeleted?.(item.name);
    onClose();
  }

  // Menu before food, the hard backstop (Nov 6, 2026): a NEW dish in
  // a document with no menus could only ever land in a section
  // attached to nothing, invisible to guests. Refuse the form and
  // route the owner to Menus instead. Editing an existing dish stays
  // open: fixing a name or a price must never be blocked.
  if (!item && doc.menus.length === 0) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: "var(--color-bg)" }} role="dialog" aria-modal="true" aria-label="Add food">
        <div className="max-w-3xl mx-auto px-5 py-6 pb-16">
          <div className="flex items-start justify-between gap-4 pb-5 border-b hairline">
            <div>
              <p className="font-mono2 text-[13px] uppercase tracking-[0.22em]" style={{ color: "var(--color-accent)" }}>Add food</p>
              <h2 className="font-display uppercase text-4xl leading-none mt-2">A menu comes first</h2>
            </div>
            <button type="button" onClick={onClose} className="px-4 py-2.5 min-h-11 border hairline font-mono2 text-[13px] font-bold uppercase tracking-wider shrink-0">Close</button>
          </div>
          <p className="text-[15px] opacity-80 leading-relaxed mt-6 max-w-xl">
            Food sits on a menu, and there is no menu yet. A dish added now would have nowhere to appear, and guests would never see it.
            Create your first menu, then come back and add the dish to it.
          </p>
          <div className="mt-6 flex gap-2.5 flex-wrap">
            <PrimaryButton onClick={() => { onClose(); onCreateMenuFirst?.(); }}>Create a menu</PrimaryButton>
            <GhostButton onClick={onClose}>Not now</GhostButton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: "var(--color-bg)" }} role="dialog" aria-modal="true" aria-label={item ? "Edit food" : "Add food"}>
      <div className="max-w-3xl mx-auto px-5 py-6 pb-16">
        <div className="flex items-start justify-between gap-4 pb-5 border-b hairline sticky top-0 z-10" style={{ background: "var(--color-bg)" }}>
          <div>
            <p className="font-mono2 text-[13px] uppercase tracking-[0.22em]" style={{ color: "var(--color-accent)" }}>{item ? "Edit food" : "Add food"}</p>
            <h2 className="font-display uppercase text-4xl leading-none mt-2">{draft.name.trim() || "New dish"}</h2>
            <p className="font-mono2 text-[13px] uppercase tracking-wider opacity-70 mt-2.5">
              Step {step} of 3: {STEPS[step - 1].name}
            </p>
          </div>
          <button type="button" onClick={onClose} className="px-4 py-2.5 min-h-11 border hairline font-mono2 text-[13px] font-bold uppercase tracking-wider shrink-0">Close</button>
        </div>

        <p className="text-[13px] opacity-60 mt-4">
          Your work saves on this device as you type, so a phone call or a closed tab cannot lose it.
          {draftRestored && <> We brought back the draft you left earlier. <button type="button" onClick={discardDraft} className="underline font-semibold">Start again instead</button></>}
        </p>

        {errors.length > 0 && (
          <div className="border p-4 mt-5" style={{ borderColor: "var(--color-accent)", background: "var(--color-surface)" }} role="alert">
            <p className="font-mono2 text-[13px] font-bold uppercase tracking-wider" style={{ color: "var(--color-accent)" }}>Fix these first</p>
            <ul className="mt-2 grid gap-1 text-[15px]">{errors.map(e => <li key={e}>{e}</li>)}</ul>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-6 mt-7">
            <Field label="Dish name">
              <input value={draft.name} onChange={e => set({ name: e.target.value })} className={inputCls} placeholder="e.g. Smoky Jollof Rice" data-testid="item-name" />
            </Field>
            <div className="grid sm:grid-cols-2 gap-5">
              <Field label="Section (where it sits on the menu)">
                <select value={draft.sectionId} onChange={e => set({ sectionId: e.target.value })} className={inputCls} style={{ background: "var(--color-surface)" }} data-testid="item-section">
                  {sortedSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  <option value={NEW_SECTION}>Create a new section...</option>
                  <option value={NO_SECTION}>No section yet</option>
                </select>
              </Field>
              <Field label="Short line (optional)">
                <input value={draft.subtitle} onChange={e => set({ subtitle: e.target.value })} className={inputCls} placeholder="e.g. Signature dish" />
              </Field>
            </div>
            {draft.sectionId === NEW_SECTION && (
              <div className="border hairline p-4 grid gap-4" style={{ background: "var(--color-surface)" }}>
                <Field label="New section name">
                  <input value={draft.newSectionName} onChange={e => set({ newSectionName: e.target.value })} className={inputCls} placeholder="e.g. Small Chops" data-testid="new-section-name" />
                </Field>
                <div>
                  <span className="text-[13px] font-semibold uppercase tracking-wide opacity-90">Show this section on</span>
                  <div className="flex gap-1.5 flex-wrap mt-2">
                    {doc.menus.map(m => {
                      const on = draft.newSectionMenuIds.includes(m.id);
                      return (
                        <button key={m.id} type="button" aria-pressed={on}
                          onClick={() => set({ newSectionMenuIds: on ? draft.newSectionMenuIds.filter(id => id !== m.id) : [...draft.newSectionMenuIds, m.id] })}
                          className="px-3 py-2.5 min-h-11 text-[13px] font-semibold border"
                          style={on ? { background: "var(--color-ink)", color: "var(--color-bg)", borderColor: "transparent" } : { borderColor: "color-mix(in srgb, var(--color-ink) 20%, transparent)" }}>
                          {m.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
            <Field label="Description" hint="Written like food writing, not a spec sheet. Guests read this before they order.">
              <textarea value={draft.description} onChange={e => set({ description: e.target.value })} className={inputCls} rows={3} placeholder="What is it, how is it cooked, what arrives at the table." />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-7 mt-7">
            <div className="grid sm:grid-cols-2 gap-5">
              <Field label="Price type">
                <select value={draft.priceType} onChange={e => set({ priceType: e.target.value as PriceType })} className={inputCls} style={{ background: "var(--color-surface)" }}>
                  <option value="fixed">Flat price</option>
                  <option value="per_person">Per person</option>
                  <option value="per_weight">Per weight</option>
                  <option value="market">Market price (set daily)</option>
                </select>
              </Field>
              {draft.priceType === "market" ? (
                <Field label={`Today's market price (${currency}), optional`}>
                  <input inputMode="numeric" value={draft.todaysMarketPrice} onChange={e => set({ todaysMarketPrice: e.target.value })} className={inputCls + " font-mono2"} placeholder="e.g. 14500" />
                </Field>
              ) : (
                <Field label={`Price (${currency})`} hint={draft.variants.length ? "Leave blank when the sizes carry the prices." : undefined}>
                  <input inputMode="numeric" value={draft.basePrice} onChange={e => set({ basePrice: e.target.value })} className={inputCls + " font-mono2"} placeholder="e.g. 8500" data-testid="item-price" />
                </Field>
              )}
            </div>

            <div>
              <span className="block text-[13px] font-semibold uppercase tracking-wide opacity-90">Photo</span>
              <p className="text-[13px] opacity-60 mt-1.5">It is the first thing guests taste. Upload one from this phone and it gets the realistic grade automatically.</p>

              {draft.photoUrl ? (
                <div className="flex gap-3.5 mt-3.5 items-center border hairline p-3" style={{ background: "var(--color-surface)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={draft.photoUrl} alt="" className="w-20 h-20 object-cover shrink-0 photo-grade" />
                  <div className="min-w-0 text-[13px]">
                    <p className="font-semibold text-[15px]">{receipt ? "Photo added" : "Photo on this dish"}</p>
                    {receipt && <p className="opacity-70 mt-0.5 break-all">{receipt.name} · {receipt.type} · {receipt.size}</p>}
                    <button type="button" onClick={() => { set({ photoUrl: "" }); setReceipt(null); }} className="mt-1.5 font-mono2 text-[13px] font-bold uppercase tracking-wider" style={{ color: "var(--color-accent)" }}>Remove photo</button>
                  </div>
                </div>
              ) : (
                <div className="w-full h-28 mt-3.5 border hairline border-dashed flex items-center justify-center text-[15px] opacity-60" style={{ background: "var(--color-surface)" }}>No photo yet</div>
              )}

              <div className="mt-3.5">
                <label className={"inline-flex items-center px-5 py-3.5 min-h-11 font-mono2 text-[13px] font-bold uppercase tracking-wider " + (uploadsConfigured && !uploading ? "cursor-pointer" : "opacity-50")} style={{ background: "var(--color-accent)", color: "#0D0A07" }} aria-disabled={!uploadsConfigured || uploading}>
                  {uploading ? `Uploading${uploadPct !== null ? `, ${uploadPct}%` : "..."}` : draft.photoUrl ? "Replace photo" : "Upload photo"}
                  <input type="file" accept="image/*" className="hidden" disabled={!uploadsConfigured || uploading} onChange={e => { doUpload(e.target.files?.[0]); e.target.value = ""; }} />
                </label>
                {uploading && (
                  <div className="h-1.5 mt-3 overflow-hidden" style={{ background: "color-mix(in srgb, var(--color-ink) 12%, transparent)" }} role="progressbar" aria-valuenow={uploadPct ?? 0} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-full transition-all" style={{ width: `${uploadPct ?? 5}%`, background: "var(--color-accent)" }} />
                  </div>
                )}
                {!uploadsConfigured && <p className="text-[13px] opacity-60 mt-2.5">Uploads switch on when your photo account is connected at setup.</p>}
                {uploadError && (
                  <div className="mt-2.5 flex items-center gap-3 flex-wrap">
                    <p className="text-[13px]" style={{ color: "var(--color-accent)" }} role="alert">{uploadError}</p>
                    {lastFile && uploadsConfigured && (
                      <button type="button" onClick={() => doUpload(lastFile)} className="px-3.5 py-2 min-h-11 border hairline font-mono2 text-[13px] font-bold uppercase tracking-wider">Try again</button>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-4">
                <button type="button" onClick={() => setShowLinkField(v => !v)} className="font-mono2 text-[13px] font-bold uppercase tracking-wider opacity-80" aria-expanded={showLinkField}>
                  {showLinkField ? "Hide the photo link box" : "Use a photo link instead"}
                </button>
                {showLinkField && (
                  <div className="mt-2.5">
                    <Field label="Photo link">
                      <input value={draft.photoUrl} onChange={e => { set({ photoUrl: e.target.value }); setReceipt(null); }} className={inputCls} placeholder="https://..." />
                    </Field>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-7 mt-7">
            <div>
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-display uppercase text-2xl">Sizes and choices</h3>
                <button type="button" onClick={() => set({ variants: [...draft.variants, { key: uid("vd"), name: "", price: "" }] })} className="px-3 py-2 min-h-11 border hairline font-mono2 text-[13px] font-bold uppercase tracking-wider">Add a size</button>
              </div>
              <p className="text-[13px] opacity-60 mt-1.5">Sizes (small, medium, large) or what is inside (single, double, special shawarma). Leave a price blank when the choice is included.</p>
              <div className="grid gap-2 mt-3">
                {draft.variants.map((v, i) => (
                  <div key={v.key} className="flex gap-2 items-center">
                    <input value={v.name} onChange={e => set({ variants: draft.variants.map((x, j) => j === i ? { ...x, name: e.target.value } : x) })} className={inputCls} placeholder="Name, e.g. Large" aria-label="Size or choice name" />
                    <input inputMode="numeric" value={v.price} onChange={e => set({ variants: draft.variants.map((x, j) => j === i ? { ...x, price: e.target.value } : x) })} className={inputCls + " font-mono2"} style={{ width: 150 }} placeholder={`Price ${currency}`} aria-label="Price" />
                    <button type="button" onClick={() => set({ variants: draft.variants.filter((_, j) => j !== i) })} className="px-3 py-2.5 min-h-11 border hairline font-mono2 text-[13px] font-bold uppercase shrink-0">Remove</button>
                  </div>
                ))}
                {draft.variants.length === 0 && <p className="text-[13px] opacity-50">No sizes. This dish comes one way.</p>}
              </div>
            </div>

            <div className="border-t hairline pt-6">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-display uppercase text-2xl">Choices and extras</h3>
                <button type="button" onClick={() => set({ groups: [...draft.groups, { key: uid("gd"), name: "", required: false, min: "0", max: "1", options: [{ key: uid("od"), name: "", price: "0" }] }] })} className="px-3 py-2 min-h-11 border hairline font-mono2 text-[13px] font-bold uppercase tracking-wider">Add a set of choices</button>
              </div>
              <p className="text-[13px] opacity-60 mt-1.5">Choose your soup, choose your protein, paid extras. Each choice carries its own price.</p>
              <div className="grid gap-4 mt-3">
                {draft.groups.map((g, gi) => (
                  <div key={g.key} className="border hairline p-4" style={{ background: "var(--color-surface)" }}>
                    <div className="flex gap-2 items-center flex-wrap">
                      <input value={g.name} onChange={e => set({ groups: draft.groups.map((x, j) => j === gi ? { ...x, name: e.target.value } : x) })} className={inputCls} style={{ flex: "1 1 200px" }} placeholder="Set name, e.g. Choose your soup" aria-label="Set name" />
                      <label className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide">
                        <input type="checkbox" checked={g.required} onChange={e => set({ groups: draft.groups.map((x, j) => j === gi ? { ...x, required: e.target.checked, min: e.target.checked && Number(x.min) < 1 ? "1" : x.min } : x) })} className="w-5 h-5 accent-[#FF5C1F]" />
                        Required
                      </label>
                      <button type="button" onClick={() => set({ groups: draft.groups.filter((_, j) => j !== gi) })} className="px-3 py-2 min-h-11 border hairline font-mono2 text-[13px] font-bold uppercase" style={{ color: "var(--color-accent)" }}>Delete set</button>
                    </div>
                    <div className="flex gap-2 items-center mt-3 flex-wrap">
                      <span className="text-[13px] opacity-70 font-semibold uppercase tracking-wide">Guests choose at least</span>
                      <input inputMode="numeric" value={g.min} onChange={e => set({ groups: draft.groups.map((x, j) => j === gi ? { ...x, min: e.target.value } : x) })} className={inputCls + " font-mono2"} style={{ width: 76 }} aria-label="Minimum choices" />
                      <span className="text-[13px] opacity-70 font-semibold uppercase tracking-wide">at most</span>
                      <input inputMode="numeric" value={g.max} onChange={e => set({ groups: draft.groups.map((x, j) => j === gi ? { ...x, max: e.target.value } : x) })} className={inputCls + " font-mono2"} style={{ width: 76 }} aria-label="Maximum choices" />
                    </div>
                    <div className="grid gap-2 mt-3">
                      {g.options.map((o, oi) => (
                        <div key={o.key} className="flex gap-2 items-center">
                          <input value={o.name} onChange={e => set({ groups: draft.groups.map((x, j) => j === gi ? { ...x, options: x.options.map((y, k) => k === oi ? { ...y, name: e.target.value } : y) } : x) })} className={inputCls} placeholder="Choice name" aria-label="Choice name" />
                          <input inputMode="numeric" value={o.price} onChange={e => set({ groups: draft.groups.map((x, j) => j === gi ? { ...x, options: x.options.map((y, k) => k === oi ? { ...y, price: e.target.value } : y) } : x) })} className={inputCls + " font-mono2"} style={{ width: 150 }} placeholder={`Price ${currency}`} aria-label="Choice price" />
                          <button type="button" onClick={() => set({ groups: draft.groups.map((x, j) => j === gi ? { ...x, options: x.options.filter((_, k) => k !== oi) } : x) })} className="px-3 py-2.5 min-h-11 border hairline font-mono2 text-[13px] font-bold uppercase shrink-0">Remove</button>
                        </div>
                      ))}
                      <button type="button" onClick={() => set({ groups: draft.groups.map((x, j) => j === gi ? { ...x, options: [...x.options, { key: uid("od"), name: "", price: "0" }] } : x) })} className="justify-self-start px-3 py-2 min-h-11 border hairline font-mono2 text-[13px] font-bold uppercase tracking-wider">Add choice</button>
                    </div>
                  </div>
                ))}
                {draft.groups.length === 0 && <p className="text-[13px] opacity-50">No choices or extras. This dish has nothing to pick.</p>}
              </div>
            </div>

            <div className="border-t hairline pt-6 grid gap-6">
              <div>
                <span className="text-[13px] font-semibold uppercase tracking-wide opacity-90">Dietary (what it is suitable for)</span>
                <div className="mt-2"><ChipMultiSelect options={DIETARY_TAGS} value={draft.dietaryTags} onChange={v => set({ dietaryTags: v })} /></div>
              </div>
              <div>
                <span className="text-[13px] font-semibold uppercase tracking-wide opacity-90">Allergens (what it contains)</span>
                <p className="text-[13px] opacity-60 mt-1">Kept separate from dietary on purpose: suitable-for and contains are different promises.</p>
                <div className="mt-2"><ChipMultiSelect options={ALLERGENS} value={draft.allergenContains} onChange={v => set({ allergenContains: v })} /></div>
              </div>
              <div className="grid sm:grid-cols-2 gap-5">
                <Field label="Badge (optional)">
                  <input value={draft.badgeLabel} onChange={e => set({ badgeLabel: e.target.value })} className={inputCls} placeholder="e.g. Bestseller" />
                </Field>
                <Field label="Serves (optional)">
                  <input value={draft.serves} onChange={e => set({ serves: e.target.value })} className={inputCls} placeholder="e.g. 2 to 3" />
                </Field>
              </div>
              <div className="grid gap-3">
                <div className="flex items-center justify-between gap-4 border hairline px-4 py-3.5">
                  <div>
                    <p className="font-semibold text-[15px]">Sold out</p>
                    <p className="text-[13px] opacity-60">Guests see it greyed out. Fine-tune the return time on the Sold out board.</p>
                  </div>
                  <BigToggle on={draft.soldOut} onChange={v => set({ soldOut: v })} label="Sold out" />
                </div>
                <div className="flex items-center justify-between gap-4 border hairline px-4 py-3.5">
                  <div>
                    <p className="font-semibold text-[15px]">Served hot (steam)</p>
                    <p className="text-[13px] opacity-60">Hot dishes get the steam moment on the guest page.</p>
                  </div>
                  <BigToggle on={draft.isHot} onChange={v => set({ isHot: v })} label="Served hot" />
                </div>
                <div className="flex items-center justify-between gap-4 border hairline px-4 py-3.5">
                  <div>
                    <p className="font-semibold text-[15px]">On the menu</p>
                    <p className="text-[13px] opacity-60">Off removes the dish from guests entirely, different from sold out.</p>
                  </div>
                  <BigToggle on={draft.active} onChange={v => set({ active: v })} label="On the menu" />
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2.5 flex-wrap items-center border-t hairline pt-5 mt-9">
          {step > 1 && <GhostButton onClick={goBack}>Back</GhostButton>}
          {step < 3 ? (
            <PrimaryButton onClick={goNext}>Continue</PrimaryButton>
          ) : (
            <PrimaryButton onClick={save}>{item ? "Save changes" : "Add to menu"}</PrimaryButton>
          )}
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          {item && !confirmingDelete && (
            <button type="button" onClick={() => setConfirmingDelete(true)} className="ml-auto px-4 py-3 min-h-11 font-mono2 text-[13px] font-bold uppercase tracking-wider" style={{ color: "var(--color-accent)" }}>Delete food</button>
          )}
        </div>

        {confirmingDelete && item && (
          <div className="border p-4 mt-5" style={{ borderColor: "var(--color-accent)", background: "var(--color-surface)" }} role="alert">
            <p className="text-[15px] leading-relaxed">
              Delete <strong>{item.name}</strong> for good? It leaves every menu, and its sizes, choices and extras go with it. You get 10 seconds to undo it afterwards.
            </p>
            <div className="flex gap-2.5 mt-3.5 flex-wrap">
              <button type="button" onClick={remove} className="px-4 py-3 min-h-11 font-mono2 text-[13px] font-bold uppercase tracking-wider" style={{ background: "var(--color-accent)", color: "#0D0A07" }}>Delete for good</button>
              <GhostButton onClick={() => setConfirmingDelete(false)}>Keep it</GhostButton>
            </div>
          </div>
        )}

        <p className="text-[13px] opacity-60 mt-4">Saving here writes straight through: guests see the change on their next visit.</p>
      </div>
    </div>
  );
}
