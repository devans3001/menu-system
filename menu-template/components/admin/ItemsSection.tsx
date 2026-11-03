"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Item, MenuDocument } from "../../lib/types";
import { displayPriceForItem, formatPrice } from "../../lib/format";
import { isSoldOut } from "../../lib/specials";
import ItemForm from "./ItemForm";
import { EmptyState, PrimaryButton, SectionTitle, UndoToast, inputCls, parsePrice } from "./shared";

// Dishes: everything the venue serves, grouped by the section guests
// find it in. Tap a dish to edit everything about it. Tap its PRICE to
// change just the price, right here (Nov 3, 2026 usability fix: a
// price change used to mean opening the full dish form). Enter saves,
// Escape cancels. Deleting a dish offers Undo for 10 seconds instead
// of a browser confirm box.
export default function ItemsSection({ doc, onCommit, startNewItem, onConsumeStartNew }: {
  doc: MenuDocument;
  onCommit: (next: MenuDocument) => void;
  startNewItem: boolean;
  onConsumeStartNew: () => void;
}) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Item | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [priceEdit, setPriceEdit] = useState<{ itemId: string; value: string } | null>(null);
  const [priceError, setPriceError] = useState("");
  const [undo, setUndo] = useState<{ snapshot: MenuDocument; label: string } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (startNewItem) {
      setEditing(null);
      setFormOpen(true);
      onConsumeStartNew();
    }
  }, [startNewItem, onConsumeStartNew]);

  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current); }, []);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (i: Item) => !q || i.name.toLowerCase().includes(q) || (i.subtitle ?? "").toLowerCase().includes(q);
    const bySection = doc.sections.slice().sort((a, b) => a.sortOrder - b.sortOrder).map(sec => ({
      id: sec.id,
      name: sec.name,
      items: sec.itemIds.map(id => doc.items.find(i => i.id === id)).filter((i): i is Item => !!i && matches(i)),
    })).filter(g => g.items.length > 0);
    const placed = new Set(doc.sections.flatMap(s => s.itemIds));
    const loose = doc.items.filter(i => !placed.has(i.id) && matches(i));
    if (loose.length) bySection.push({ id: "__loose__", name: "Not in a section yet", items: loose });
    return bySection;
  }, [doc, query]);

  const openNew = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (item: Item) => { setEditing(item); setFormOpen(true); };

  // Quick price edit only where one number tells the story. Dishes
  // priced by their sizes, or with no price of their own, open the
  // full form instead, where those prices live.
  function priceEditable(item: Item): boolean {
    if (item.priceType === "market") return true;
    if (item.priceType === "none" || item.priceType === "free") return false;
    return item.basePrice !== null && item.basePrice !== undefined;
  }
  function startPriceEdit(item: Item) {
    if (!priceEditable(item)) { openEdit(item); return; }
    setPriceError("");
    setPriceEdit({
      itemId: item.id,
      value: item.priceType === "market" ? String(item.todaysMarketPrice ?? "") : String(item.basePrice ?? ""),
    });
  }
  function commitPrice(item: Item) {
    if (!priceEdit) return;
    const value = parsePrice(priceEdit.value);
    if (value === null || Number.isNaN(value) || value < 0) {
      setPriceError("Type the new price as a number, like 8500.");
      return;
    }
    const next = structuredClone(doc);
    const target = next.items.find(i => i.id === item.id);
    if (target) {
      if (target.priceType === "market") target.todaysMarketPrice = value;
      else target.basePrice = value;
    }
    setPriceEdit(null);
    setPriceError("");
    onCommit(next);
  }

  function handleDeleted(name: string) {
    // `doc` here is the document from before the delete commit.
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo({ snapshot: structuredClone(doc), label: `${name} deleted.` });
    undoTimer.current = setTimeout(() => setUndo(null), 10000);
  }
  function doUndo() {
    if (!undo) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    onCommit(undo.snapshot);
    setUndo(null);
  }

  return (
    <div>
      <SectionTitle eyebrow="Everything you serve" title="Dishes">
        <PrimaryButton onClick={openNew}>Add food</PrimaryButton>
      </SectionTitle>

      <div className="mt-5">
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search dishes..." className={inputCls} aria-label="Search dishes" />
      </div>

      {doc.items.length === 0 ? (
        <div className="mt-7">
          <EmptyState title="No food yet" body="Your menu starts with the first dish. Add it with its photo, price and section, and guests will see it the moment you save.">
            <PrimaryButton onClick={openNew}>Add your first dish</PrimaryButton>
          </EmptyState>
        </div>
      ) : groups.length === 0 ? (
        <p className="mt-7 text-[15px] opacity-70">Nothing matches "{query}". Try another name.</p>
      ) : (
        <div className="mt-7 grid gap-9">
          {groups.map(group => (
            <section key={group.id} aria-label={group.name}>
              <h3 className="font-display uppercase text-2xl">{group.name}</h3>
              <div className="mt-2 border-t hairline">
                {group.items.map(item => {
                  const sold = isSoldOut(doc, item.id);
                  const editingPrice = priceEdit?.itemId === item.id;
                  return (
                    <div key={item.id} className="flex gap-3.5 py-3.5 border-b hairline items-center" data-item-row={item.id}>
                      <button type="button" onClick={() => openEdit(item)} className="flex gap-3.5 items-center min-w-0 flex-1 text-left">
                        {item.photoUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={item.photoUrl} alt="" className={"w-14 h-14 object-cover shrink-0 photo-grade " + (sold ? "grayscale opacity-60" : "")} />
                        ) : (
                          <span className="w-14 h-14 shrink-0 border hairline flex items-center justify-center font-display text-xl" style={{ background: "var(--color-surface)" }}>{item.name.charAt(0)}</span>
                        )}
                        <span className="min-w-0">
                          <span className="block font-bold leading-tight text-[15px]">{item.name}{!item.active && <span className="opacity-50 font-semibold"> (off menu)</span>}</span>
                          <span className="flex gap-2 mt-1.5 flex-wrap items-center">
                            {sold && <span className="font-mono2 text-[13px] font-bold uppercase tracking-wider px-2 py-0.5" style={{ background: "var(--color-accent)", color: "#0D0A07" }}>Sold out</span>}
                            {item.variantIds.length > 0 && <span className="text-[13px] opacity-60">{item.variantIds.length} sizes or choices</span>}
                            {item.modifierGroupIds.length > 0 && <span className="text-[13px] opacity-60">{item.modifierGroupIds.length} sets of choices</span>}
                            {item.badges[0] && <span className="text-[13px]" style={{ color: "var(--color-accent2)" }}>{item.badges[0].label}</span>}
                          </span>
                        </span>
                      </button>
                      <span className="shrink-0 text-right">
                        {editingPrice ? (
                          <span className="block">
                            <span className="flex gap-1.5 items-center">
                              <input
                                autoFocus
                                inputMode="numeric"
                                value={priceEdit.value}
                                onChange={e => setPriceEdit({ itemId: item.id, value: e.target.value })}
                                onKeyDown={e => {
                                  if (e.key === "Enter") commitPrice(item);
                                  if (e.key === "Escape") { setPriceEdit(null); setPriceError(""); }
                                }}
                                className={inputCls + " font-mono2"}
                                style={{ width: 120 }}
                                aria-label={`New price for ${item.name}`}
                                data-testid="quick-price"
                              />
                              <button type="button" onClick={() => commitPrice(item)} className="px-3 py-2.5 min-h-11 font-mono2 text-[13px] font-bold uppercase tracking-wider" style={{ background: "var(--color-accent)", color: "#0D0A07" }}>Save</button>
                              <button type="button" onClick={() => { setPriceEdit(null); setPriceError(""); }} className="px-2.5 py-2.5 min-h-11 border hairline font-mono2 text-[13px] font-bold uppercase">Cancel</button>
                            </span>
                            {priceError
                              ? <span className="block text-[13px] mt-1.5" style={{ color: "var(--color-accent)" }} role="alert">{priceError}</span>
                              : <span className="block text-[13px] opacity-60 mt-1.5">Enter saves. It is {formatPrice(item.priceType === "market" ? item.todaysMarketPrice : item.basePrice, doc.venue.currency)} now.</span>}
                          </span>
                        ) : (
                          <button type="button" onClick={() => startPriceEdit(item)} className="block text-right py-1" title={priceEditable(item) ? "Tap to change this price" : "Open the dish to change its prices"} data-testid="price-button">
                            <span className="block font-mono2 text-[13px]">{displayPriceForItem(item, doc.venue.currency) || "Set by choices"}</span>
                            <span className="block font-mono2 text-[13px] font-bold uppercase tracking-wider mt-1" style={{ color: "var(--color-accent)" }}>
                              {priceEditable(item) ? "Change price" : "Edit dish"}
                            </span>
                          </button>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {formOpen && (
        <ItemForm
          doc={doc}
          item={editing}
          onClose={() => setFormOpen(false)}
          onCommit={onCommit}
          onDeleted={handleDeleted}
        />
      )}

      {undo && <UndoToast message={undo.label} onUndo={doUndo} />}
    </div>
  );
}
