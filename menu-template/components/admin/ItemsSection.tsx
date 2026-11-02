"use client";
import { useEffect, useMemo, useState } from "react";
import type { Item, MenuDocument } from "../../lib/types";
import { displayPriceForItem } from "../../lib/format";
import { isSoldOut } from "../../lib/specials";
import ItemForm from "./ItemForm";
import { EmptyState, PrimaryButton, SectionTitle, inputCls } from "./shared";

// Items: every dish on the venue, grouped by the section guests find it
// in. Search, tap a dish to edit everything about it, or add new food.
export default function ItemsSection({ doc, onCommit, startNewItem, onConsumeStartNew }: {
  doc: MenuDocument;
  onCommit: (next: MenuDocument) => void;
  startNewItem: boolean;
  onConsumeStartNew: () => void;
}) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Item | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    if (startNewItem) {
      setEditing(null);
      setFormOpen(true);
      onConsumeStartNew();
    }
  }, [startNewItem, onConsumeStartNew]);

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

  return (
    <div>
      <SectionTitle eyebrow="Everything you serve" title="Items">
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
                  return (
                    <button key={item.id} type="button" onClick={() => openEdit(item)} className="w-full text-left flex gap-3.5 py-3.5 border-b hairline items-center" data-item-row={item.id}>
                      {item.photoUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={item.photoUrl} alt="" className={"w-14 h-14 object-cover shrink-0 photo-grade " + (sold ? "grayscale opacity-60" : "")} />
                      ) : (
                        <span className="w-14 h-14 shrink-0 border hairline flex items-center justify-center font-display text-xl" style={{ background: "var(--color-surface)" }}>{item.name.charAt(0)}</span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="font-bold leading-tight text-[15px]">{item.name}{!item.active && <span className="opacity-50 font-semibold"> (off menu)</span>}</span>
                          <span className="font-mono2 text-[13px] shrink-0">{displayPriceForItem(item, doc.venue.currency) || "Set by options"}</span>
                        </span>
                        <span className="flex gap-2 mt-1.5 flex-wrap items-center">
                          {sold && <span className="font-mono2 text-[13px] font-bold uppercase tracking-wider px-2 py-0.5" style={{ background: "var(--color-accent)", color: "#0D0A07" }}>Sold out</span>}
                          {item.variantIds.length > 0 && <span className="text-[13px] opacity-60">{item.variantIds.length} variants</span>}
                          {item.modifierGroupIds.length > 0 && <span className="text-[13px] opacity-60">{item.modifierGroupIds.length} add-on groups</span>}
                          {item.badges[0] && <span className="text-[13px]" style={{ color: "var(--color-accent2)" }}>{item.badges[0].label}</span>}
                        </span>
                      </span>
                      <span className="font-mono2 text-[13px] font-bold uppercase tracking-wider shrink-0" style={{ color: "var(--color-accent)" }}>Edit</span>
                    </button>
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
        />
      )}
    </div>
  );
}
