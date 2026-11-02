"use client";
import { useMemo, useState } from "react";
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

// Full-screen add and edit panel. One food, every part of it: section,
// price shape, photo, variants, add-on groups, dietary and allergen
// information kept separate, badge, and its sold out state. Saving writes
// the whole document through the editor's save path straight away.
export default function ItemForm({ doc, item, onClose, onCommit }: {
  doc: MenuDocument;
  item: Item | null; // null = adding new food
  onClose: () => void;
  onCommit: (next: MenuDocument) => void;
}) {
  const [draft, setDraft] = useState<ItemDraft>(() => (item ? draftFromItem(doc, item) : blankDraft(doc)));
  const [errors, setErrors] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const uploadsConfigured = cloudinaryUploadConfigured();
  const currency = doc.venue.currency;

  const set = (patch: Partial<ItemDraft>) => setDraft(d => ({ ...d, ...patch }));
  const sortedSections = useMemo(() => doc.sections.slice().sort((a, b) => a.sortOrder - b.sortOrder), [doc.sections]);

  async function doUpload(file: File | undefined) {
    if (!file) return;
    setUploadError("");
    setUploading(true);
    try {
      const url = await uploadPhotoToCloudinary(file, restaurantConfig.cloudinary.folder);
      set({ photoUrl: url });
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  }

  function validate(): string[] {
    const errs: string[] = [];
    if (!draft.name.trim()) errs.push("Give the dish a name.");
    if (draft.sectionId === NEW_SECTION && !draft.newSectionName.trim()) errs.push("Name the new section, or pick an existing one.");
    if (draft.sectionId !== NEW_SECTION && draft.sectionId !== NO_SECTION && !doc.sections.some(s => s.id === draft.sectionId)) errs.push("That section no longer exists. Pick another.");
    const base = parsePrice(draft.basePrice);
    if (Number.isNaN(base)) errs.push("The price must be a number.");
    const pricedVariant = draft.variants.some(v => v.name.trim() && parsePrice(v.price) !== null && !Number.isNaN(parsePrice(v.price)));
    if ((draft.priceType === "fixed" || draft.priceType === "per_person" || draft.priceType === "per_weight") && base === null && !pricedVariant) {
      errs.push("Set a price, or give at least one variant a price (like pizza sizes).");
    }
    if (Number.isNaN(parsePrice(draft.todaysMarketPrice))) errs.push("Today's market price must be a number.");
    for (const v of draft.variants) {
      if (!v.name.trim()) errs.push("Every variant needs a name (a size, or what is inside).");
      if (Number.isNaN(parsePrice(v.price))) errs.push(`The price for variant "${v.name}" must be a number.`);
    }
    for (const g of draft.groups) {
      if (!g.name.trim()) errs.push("Every add-on group needs a name.");
      if (g.options.length === 0) errs.push(`The group "${g.name}" has no options yet.`);
      for (const o of g.options) {
        if (!o.name.trim()) errs.push(`Every option in "${g.name}" needs a name.`);
        const p = parsePrice(o.price);
        if (p === null || Number.isNaN(p) || p < 0) errs.push(`The price for "${o.name}" must be 0 or more.`);
      }
    }
    return errs;
  }

  function save() {
    const errs = validate();
    setErrors(errs);
    if (errs.length) return;

    const next = structuredClone(doc);
    const itemId = item?.id ?? uid("item");
    const nowIso = new Date().toISOString();

    // Section: create it first when the owner asked for a new one.
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

    // Variants and modifier groups are separate entities in the document.
    // Rebuild this item's set from the draft, preserving variant dependent
    // option prices (priceByVariant) that this form does not edit.
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

    // Section membership: one home section in this editor.
    for (const s of next.sections) s.itemIds = s.itemIds.filter(id => id !== itemId);
    if (targetSectionId) {
      const home = next.sections.find(s => s.id === targetSectionId);
      if (home) home.itemIds.push(itemId);
    }

    // Availability toggle rides along.
    const rest = next.availability.filter(a => !(a.entityType === "item" && a.entityId === itemId));
    const previousAv = doc.availability.find(a => a.entityType === "item" && a.entityId === itemId);
    next.availability = [...rest, { entityType: "item" as const, entityId: itemId, soldOut: draft.soldOut, autoReturn: previousAv?.autoReturn ?? "indefinite", ...(previousAv?.returnAt ? { returnAt: previousAv.returnAt } : {}), updatedAt: nowIso }];

    onCommit(next);
    onClose();
  }

  function remove() {
    if (!item) return;
    if (!window.confirm(`Delete ${item.name} for good? It leaves every menu, and its variants and add-ons go with it.`)) return;
    const next = structuredClone(doc);
    next.items = next.items.filter(i => i.id !== item.id);
    next.variants = next.variants.filter(v => !item.variantIds.includes(v.id));
    next.modifierOptions = next.modifierOptions.filter(o => !item.modifierGroupIds.includes(o.groupId));
    next.modifierGroups = next.modifierGroups.filter(g => !item.modifierGroupIds.includes(g.id));
    for (const s of next.sections) s.itemIds = s.itemIds.filter(id => id !== item.id);
    next.availability = next.availability.filter(a => !(a.entityType === "item" && a.entityId === item.id));
    for (const sp of next.specials) sp.targetItemIds = sp.targetItemIds.filter(id => id !== item.id);
    onCommit(next);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: "var(--color-bg)" }} role="dialog" aria-modal="true" aria-label={item ? "Edit food" : "Add food"}>
      <div className="max-w-3xl mx-auto px-5 py-6 pb-16">
        <div className="flex items-start justify-between gap-4 pb-5 border-b hairline sticky top-0 z-10" style={{ background: "var(--color-bg)" }}>
          <div>
            <p className="font-mono2 text-[13px] uppercase tracking-[0.22em]" style={{ color: "var(--color-accent)" }}>{item ? "Edit food" : "Add food"}</p>
            <h2 className="font-display uppercase text-4xl leading-none mt-2">{draft.name.trim() || "New dish"}</h2>
          </div>
          <button type="button" onClick={onClose} className="px-4 py-2.5 border hairline font-mono2 text-[13px] font-bold uppercase tracking-wider shrink-0">Close</button>
        </div>

        {draft.photoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={draft.photoUrl} alt="" className="w-full h-52 object-cover mt-6 photo-grade" />
        ) : (
          <div className="w-full h-36 mt-6 border hairline border-dashed flex items-center justify-center text-[15px] opacity-60" style={{ background: "var(--color-surface)" }}>No photo yet. Add one below: it is the first thing guests taste.</div>
        )}

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
                        className="px-3 py-2.5 text-[13px] font-semibold border"
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
              <Field label={`Price (${currency})`} hint={draft.variants.length ? "Leave blank when the variants carry the prices." : undefined}>
                <input inputMode="numeric" value={draft.basePrice} onChange={e => set({ basePrice: e.target.value })} className={inputCls + " font-mono2"} placeholder="e.g. 8500" data-testid="item-price" />
              </Field>
            )}
          </div>

          <div>
            <Field label="Photo URL">
              <input value={draft.photoUrl} onChange={e => set({ photoUrl: e.target.value })} className={inputCls} placeholder="https://..." />
            </Field>
            <div className="flex items-center gap-3 mt-2.5 flex-wrap">
              <label className={"border hairline px-4 py-2.5 font-mono2 text-[13px] font-bold uppercase tracking-wider " + (uploadsConfigured && !uploading ? "cursor-pointer" : "opacity-50")} aria-disabled={!uploadsConfigured || uploading}>
                {uploading ? "Uploading..." : "Upload photo"}
                <input type="file" accept="image/*" className="hidden" disabled={!uploadsConfigured || uploading} onChange={e => { doUpload(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
              <span className="text-[13px] opacity-60">{uploadsConfigured ? "Uploads go to your own Cloudinary and get the realistic grade automatically." : "Uploads switch on when your Cloudinary cloud name and preset are set."}</span>
            </div>
            {uploadError && <p className="text-[13px] mt-2" style={{ color: "var(--color-accent)" }}>{uploadError}</p>}
          </div>

          <div className="border-t hairline pt-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display uppercase text-2xl">Variants</h3>
              <button type="button" onClick={() => set({ variants: [...draft.variants, { key: uid("vd"), name: "", price: "" }] })} className="px-3 py-2 border hairline font-mono2 text-[13px] font-bold uppercase tracking-wider">Add variant</button>
            </div>
            <p className="text-[13px] opacity-60 mt-1.5">Sizes (small, medium, large) or what is inside (single, double, special shawarma). Leave a price blank when the choice is included.</p>
            <div className="grid gap-2 mt-3">
              {draft.variants.map((v, i) => (
                <div key={v.key} className="flex gap-2 items-center">
                  <input value={v.name} onChange={e => set({ variants: draft.variants.map((x, j) => j === i ? { ...x, name: e.target.value } : x) })} className={inputCls} placeholder="Variant name" aria-label="Variant name" />
                  <input inputMode="numeric" value={v.price} onChange={e => set({ variants: draft.variants.map((x, j) => j === i ? { ...x, price: e.target.value } : x) })} className={inputCls + " font-mono2"} style={{ width: 150 }} placeholder={`Price ${currency}`} aria-label="Variant price" />
                  <button type="button" onClick={() => set({ variants: draft.variants.filter((_, j) => j !== i) })} className="px-3 py-2.5 border hairline font-mono2 text-[13px] font-bold uppercase shrink-0">Remove</button>
                </div>
              ))}
              {draft.variants.length === 0 && <p className="text-[13px] opacity-50">No variants. This dish comes one way.</p>}
            </div>
          </div>

          <div className="border-t hairline pt-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display uppercase text-2xl">Add-on groups</h3>
              <button type="button" onClick={() => set({ groups: [...draft.groups, { key: uid("gd"), name: "", required: false, min: "0", max: "1", options: [{ key: uid("od"), name: "", price: "0" }] }] })} className="px-3 py-2 border hairline font-mono2 text-[13px] font-bold uppercase tracking-wider">Add group</button>
            </div>
            <p className="text-[13px] opacity-60 mt-1.5">Choose your soup, choose your protein, paid extras. Each option carries its own price.</p>
            <div className="grid gap-4 mt-3">
              {draft.groups.map((g, gi) => (
                <div key={g.key} className="border hairline p-4" style={{ background: "var(--color-surface)" }}>
                  <div className="flex gap-2 items-center flex-wrap">
                    <input value={g.name} onChange={e => set({ groups: draft.groups.map((x, j) => j === gi ? { ...x, name: e.target.value } : x) })} className={inputCls} style={{ flex: "1 1 200px" }} placeholder="Group name, e.g. Choose your soup" aria-label="Group name" />
                    <label className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide">
                      <input type="checkbox" checked={g.required} onChange={e => set({ groups: draft.groups.map((x, j) => j === gi ? { ...x, required: e.target.checked, min: e.target.checked && Number(x.min) < 1 ? "1" : x.min } : x) })} className="w-5 h-5 accent-[#FF5C1F]" />
                      Required
                    </label>
                    <button type="button" onClick={() => set({ groups: draft.groups.filter((_, j) => j !== gi) })} className="px-3 py-2 border hairline font-mono2 text-[13px] font-bold uppercase" style={{ color: "var(--color-accent)" }}>Delete group</button>
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
                        <input value={o.name} onChange={e => set({ groups: draft.groups.map((x, j) => j === gi ? { ...x, options: x.options.map((y, k) => k === oi ? { ...y, name: e.target.value } : y) } : x) })} className={inputCls} placeholder="Option name" aria-label="Option name" />
                        <input inputMode="numeric" value={o.price} onChange={e => set({ groups: draft.groups.map((x, j) => j === gi ? { ...x, options: x.options.map((y, k) => k === oi ? { ...y, price: e.target.value } : y) } : x) })} className={inputCls + " font-mono2"} style={{ width: 150 }} placeholder={`Price ${currency}`} aria-label="Option price" />
                        <button type="button" onClick={() => set({ groups: draft.groups.map((x, j) => j === gi ? { ...x, options: x.options.filter((_, k) => k !== oi) } : x) })} className="px-3 py-2.5 border hairline font-mono2 text-[13px] font-bold uppercase shrink-0">Remove</button>
                      </div>
                    ))}
                    <button type="button" onClick={() => set({ groups: draft.groups.map((x, j) => j === gi ? { ...x, options: [...x.options, { key: uid("od"), name: "", price: "0" }] } : x) })} className="justify-self-start px-3 py-2 border hairline font-mono2 text-[13px] font-bold uppercase tracking-wider">Add option</button>
                  </div>
                </div>
              ))}
              {draft.groups.length === 0 && <p className="text-[13px] opacity-50">No add-on groups. This dish has no choices to make.</p>}
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
                  <p className="font-semibold text-[15px]">Sold out (86)</p>
                  <p className="text-[13px] opacity-60">Guests see it greyed out. Fine-tune the return time on the Availability board.</p>
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

          {errors.length > 0 && (
            <div className="border p-4" style={{ borderColor: "var(--color-accent)", background: "var(--color-surface)" }} role="alert">
              <p className="font-mono2 text-[13px] font-bold uppercase tracking-wider" style={{ color: "var(--color-accent)" }}>Fix these first</p>
              <ul className="mt-2 grid gap-1 text-[15px]">{errors.map(e => <li key={e}>{e}</li>)}</ul>
            </div>
          )}

          <div className="flex gap-2.5 flex-wrap items-center border-t hairline pt-5">
            <PrimaryButton onClick={save}>{item ? "Save changes" : "Add to menu"}</PrimaryButton>
            <GhostButton onClick={onClose}>Cancel</GhostButton>
            {item && <button type="button" onClick={remove} className="ml-auto px-4 py-3 font-mono2 text-[13px] font-bold uppercase tracking-wider" style={{ color: "var(--color-accent)" }}>Delete food</button>}
          </div>
          <p className="text-[13px] opacity-60">Saving here writes straight through: guests see the change on their next visit.</p>
        </div>
      </div>
    </div>
  );
}
