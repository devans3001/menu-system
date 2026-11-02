"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MenuDocument } from "../lib/types";
import { restaurantConfig } from "../restaurant.config";
import OverviewSection from "./admin/OverviewSection";
import MenusSection from "./admin/MenusSection";
import ItemsSection from "./admin/ItemsSection";
import SpecialsSection from "./admin/SpecialsSection";
import AvailabilitySection from "./admin/AvailabilitySection";
import QrSection from "./admin/QrSection";
import SettingsSection from "./admin/SettingsSection";
import type { EditorSectionId } from "./admin/shared";

// Owner editor shell. One document, seven rooms: Overview, Menus, Items,
// Specials, Availability, QR and Links, Settings. The document loads from
// /api/menu, and saves write the whole document back through /api/menu
// PUT, which persists to the Neon menus row when DATABASE_URL is set.
// Structural changes (new dish, 86 toggle, special, menu add) save on
// their own; field edits collect under the Save button with an
// unmistakable state. Sign-in stays demo mode until magic links wire.
const SECTIONS: { id: EditorSectionId; label: string; short: string }[] = [
  { id: "overview", label: "Overview", short: "Overview" },
  { id: "menus", label: "Menus", short: "Menus" },
  { id: "items", label: "Items", short: "Items" },
  { id: "specials", label: "Specials", short: "Specials" },
  { id: "availability", label: "Availability", short: "86 Board" },
  { id: "qr", label: "QR and Links", short: "QR + Links" },
  { id: "settings", label: "Settings", short: "Settings" },
];

type SaveState = "clean" | "dirty" | "saving" | "saved" | "error";

// Shape guard before any save: a corrupt document must never reach the
// database. Mirrors the promises the item and special forms already make.
function validateDocument(doc: MenuDocument): string | null {
  const sectionIds = new Set(doc.sections.map(s => s.id));
  for (const m of doc.menus) {
    if (!m.name.trim()) return "Every menu needs a name.";
    for (const id of m.sectionIds) if (!sectionIds.has(id)) return `The ${m.name} menu points at a section that no longer exists.`;
  }
  for (const item of doc.items) {
    if (!item.name.trim()) return "Every dish needs a name.";
    if (item.basePrice !== null && !Number.isFinite(item.basePrice)) return `The price for ${item.name} is not a number.`;
    if (item.todaysMarketPrice != null && !Number.isFinite(item.todaysMarketPrice)) return `The market price for ${item.name} is not a number.`;
  }
  for (const v of doc.variants) if (v.price !== null && !Number.isFinite(v.price)) return `The price for variant ${v.name} is not a number.`;
  for (const o of doc.modifierOptions) if (!Number.isFinite(o.price) || o.price < 0) return `The price for ${o.name} must be 0 or more.`;
  for (const sp of doc.specials) {
    if (!sp.name.trim()) return "Every special needs a name.";
    if (!Number.isFinite(sp.ruleValue)) return `The discount on ${sp.name} is not a number.`;
  }
  return null;
}

function billingChip(state: string): { text: string; live: boolean } {
  switch (state) {
    case "live": return { text: "Page live", live: true };
    case "lifetime": return { text: "Page live, paid once", live: true };
    case "grace": return { text: "Page live, payment grace", live: true };
    case "paused": return { text: "Page paused", live: false };
    case "churned": return { text: "Page off", live: false };
    default: return { text: "Demo", live: true };
  }
}

export default function AdminEditor({ initialDoc, billingState }: { initialDoc: MenuDocument; billingState?: string }) {
  const [doc, setDoc] = useState<MenuDocument>(() => structuredClone(initialDoc));
  const [savedJson, setSavedJson] = useState<string>(() => JSON.stringify(initialDoc));
  const [saveState, setSaveState] = useState<SaveState>("clean");
  const [saveMessage, setSaveMessage] = useState("");
  const [email, setEmail] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [section, setSection] = useState<EditorSectionId>("overview");
  const [pendingNewItem, setPendingNewItem] = useState(false);
  const docRef = useRef(doc);
  docRef.current = doc;
  const savingRef = useRef(false);

  const dirty = useMemo(() => JSON.stringify(doc) !== savedJson, [doc, savedJson]);
  const chip = billingChip(billingState ?? "demo");

  // Freshest copy on load: the server render can lag a save made in
  // another tab, so the editor re-reads the document from the API.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/menu")
      .then(r => (r.ok ? r.json() : Promise.reject(new Error("read failed"))))
      .then((fresh: MenuDocument) => {
        if (cancelled) return;
        setDoc(structuredClone(fresh));
        setSavedJson(JSON.stringify(fresh));
        setSaveState("clean");
      })
      .catch(() => { /* keep the server-rendered copy */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (dirty && saveState !== "saving" && saveState !== "error") setSaveState("dirty");
    if (!dirty && saveState === "dirty") setSaveState("clean");
  }, [dirty, saveState]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const saveWith = useCallback(async (toSave: MenuDocument) => {
    if (savingRef.current) return;
    const problem = validateDocument(toSave);
    if (problem) {
      setSaveState("error");
      setSaveMessage(problem);
      return;
    }
    savingRef.current = true;
    setSaveState("saving");
    setSaveMessage("");
    try {
      const res = await fetch("/api/menu", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(toSave) });
      if (!res.ok) throw new Error(`Save failed (HTTP ${res.status}).`);
      const saved = (await res.json()) as MenuDocument;
      setDoc(structuredClone(saved));
      setSavedJson(JSON.stringify(saved));
      const t = new Date(saved.updatedAt);
      setSaveState("saved");
      setSaveMessage(`Saved ${t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
    } catch (e) {
      setSaveState("error");
      setSaveMessage(e instanceof Error ? e.message : "Save failed. Check your connection and retry.");
    } finally {
      savingRef.current = false;
    }
  }, []);

  const update = useCallback((next: MenuDocument) => { setDoc(next); }, []);
  const commit = useCallback((next: MenuDocument) => { setDoc(next); void saveWith(next); }, [saveWith]);
  const saveNow = useCallback(() => { void saveWith(docRef.current); }, [saveWith]);

  const go = useCallback((next: EditorSectionId, action?: "new-item") => {
    if (action === "new-item") setPendingNewItem(true);
    setSection(next);
  }, []);

  if (!signedIn) return (
    <main className="min-h-screen md:grid md:grid-cols-[3fr_2fr]">
      <div className="relative h-52 md:h-auto overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={restaurantConfig.firstBite.posterUrl} alt="" className="absolute inset-0 h-full w-full object-cover photo-grade" />
        <div className="absolute inset-x-0 bottom-0 h-2/3" style={{ background: "linear-gradient(to top, rgba(6,4,2,0.92), transparent)" }} />
        <span className="absolute top-4 left-5 font-mono2 text-[13px] uppercase tracking-[0.26em] px-2 py-1 border hairline" style={{ background: "rgba(6,4,2,0.55)" }}>Owner editor · Demo mode</span>
        <h1 className="absolute bottom-4 left-5 font-display uppercase leading-[0.9] text-5xl md:text-7xl">{restaurantConfig.displayName.split(" ").map(w => <span key={w} className="block">{w}</span>)}</h1>
      </div>
      <div className="flex items-start md:items-center px-6 py-8 md:p-12">
        <div className="w-full max-w-sm">
          <h2 className="font-display uppercase text-3xl">Sign in</h2>
          <p className="mt-2 text-[15px] opacity-85 leading-relaxed">We email you a sign-in link for {restaurantConfig.editor.ownerEmail}. No password.</p>
          <label className="block mt-7 text-[13px] font-semibold uppercase tracking-wide">Owner email
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder={restaurantConfig.editor.ownerEmail} className="mt-2 w-full border hairline bg-transparent px-3 py-2.5 text-[15px] outline-none focus:border-[var(--color-accent)]" />
          </label>
          <button onClick={() => setSignedIn(true)} className="mt-5 w-full py-3.5 font-mono2 text-[13px] font-bold uppercase tracking-wider" style={{ background: "var(--color-accent)", color: "#0D0A07" }}>Continue in demo mode</button>
          <p className="font-mono2 text-[13px] uppercase tracking-[0.2em] opacity-60 mt-4">Demo mode. No email is sent.</p>
        </div>
      </div>
    </main>
  );

  const saveLabel = saveState === "saving" ? "Saving..." : saveState === "error" ? "Retry save" : "Save changes";

  return (
    <div className="min-h-screen md:grid md:grid-cols-[248px_1fr]">
      {/* Sidebar on wide screens */}
      <aside className="hidden md:flex flex-col border-r hairline sticky top-0 h-screen" style={{ background: "var(--color-surface)" }}>
        <div className="p-5 pb-4">
          <p className="font-mono2 text-[13px] uppercase tracking-[0.22em]" style={{ color: "var(--color-accent)" }}>Owner editor</p>
          <h1 className="font-display uppercase text-3xl leading-none mt-2">{doc.venue.name}</h1>
          <span className="inline-block mt-3 font-mono2 text-[13px] font-bold uppercase tracking-wider px-2.5 py-1 border hairline" style={chip.live ? { color: "var(--color-accent2)" } : { background: "var(--color-accent)", color: "#0D0A07", borderColor: "transparent" }}>{chip.text}</span>
        </div>
        <nav className="flex-1 px-3 pb-4" aria-label="Editor sections">
          {SECTIONS.map((s, i) => {
            const current = section === s.id;
            return (
              <button key={s.id} type="button" onClick={() => go(s.id)} aria-current={current ? "page" : undefined}
                className="w-full text-left flex items-baseline gap-3 px-3 py-3 border-l-2"
                style={current ? { borderColor: "var(--color-accent)", background: "color-mix(in srgb, var(--color-accent) 12%, transparent)" } : { borderColor: "transparent" }}>
                <span className="font-mono2 text-[13px]" style={{ color: current ? "var(--color-accent)" : undefined }}>{String(i + 1).padStart(2, "0")}</span>
                <span className="font-semibold text-[15px]">{s.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t hairline">
          <button onClick={() => setSignedIn(false)} className="text-[13px] border hairline px-4 py-2 font-semibold w-full">Sign out</button>
        </div>
      </aside>

      <div className="min-w-0">
        {/* Header: identity, save state, save action. Sticky on all sizes. */}
        <header className="sticky top-0 z-40 border-b hairline" style={{ background: "var(--color-bg)" }}>
          <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0 md:hidden">
              <p className="font-mono2 text-[13px] uppercase tracking-[0.22em]" style={{ color: "var(--color-accent)" }}>Owner editor</p>
              <h1 className="font-display uppercase text-2xl leading-none mt-1.5 truncate">{doc.venue.name}</h1>
            </div>
            <div className="hidden md:block">
              <p className="font-serif2 italic text-lg opacity-85 leading-tight">{section === "overview" ? "Good to see you. Here is your menu today." : SECTIONS.find(s => s.id === section)?.label}</p>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap ml-auto">
              <span className="font-mono2 text-[13px] uppercase tracking-wider md:hidden px-2 py-1 border hairline" style={chip.live ? { color: "var(--color-accent2)" } : { background: "var(--color-accent)", color: "#0D0A07", borderColor: "transparent" }}>{chip.text}</span>
              <span className="font-mono2 text-[13px] uppercase tracking-wider" role="status" style={{ color: saveState === "error" ? "var(--color-accent)" : saveState === "dirty" ? "var(--color-accent2)" : undefined }}>
                {saveState === "saving" ? "Saving..." : saveState === "error" ? "Save failed" : dirty ? "Unsaved changes" : saveMessage || "All changes saved"}
              </span>
              <button type="button" onClick={saveNow} disabled={!dirty && saveState !== "error" || saveState === "saving"}
                className="px-4 py-2.5 font-mono2 text-[13px] font-bold uppercase tracking-wider disabled:opacity-40"
                style={{ background: "var(--color-accent)", color: "#0D0A07" }}>
                {saveLabel}
              </button>
              <button onClick={() => setSignedIn(false)} className="md:hidden text-[13px] border hairline px-3 py-2.5 font-semibold">Sign out</button>
            </div>
          </div>
          {saveState === "error" && <p className="px-5 pb-3 text-[13px]" style={{ color: "var(--color-accent)" }} role="alert">{saveMessage} Your work is still on this screen. Tap Retry save.</p>}
          {/* Tab row on phones and small tablets */}
          <nav className="md:hidden flex gap-1.5 overflow-x-auto no-scrollbar px-5 pb-3" aria-label="Editor sections">
            {SECTIONS.map(s => {
              const current = section === s.id;
              return (
                <button key={s.id} type="button" onClick={() => go(s.id)} aria-current={current ? "page" : undefined}
                  className="shrink-0 px-4 py-2.5 font-mono2 text-[13px] font-bold uppercase tracking-wider border"
                  style={current ? { background: "var(--color-accent)", color: "#0D0A07", borderColor: "transparent" } : { borderColor: "color-mix(in srgb, var(--color-ink) 20%, transparent)" }}>
                  {s.short}
                </button>
              );
            })}
          </nav>
        </header>

        <main className="px-5 py-7 md:px-10 md:py-9 max-w-3xl">
          {section === "overview" && <OverviewSection doc={doc} go={go} />}
          {section === "menus" && <MenusSection doc={doc} onChange={update} onCommit={commit} />}
          {section === "items" && <ItemsSection doc={doc} onCommit={commit} startNewItem={pendingNewItem} onConsumeStartNew={() => setPendingNewItem(false)} />}
          {section === "specials" && <SpecialsSection doc={doc} onCommit={commit} />}
          {section === "availability" && <AvailabilitySection doc={doc} onCommit={commit} />}
          {section === "qr" && <QrSection />}
          {section === "settings" && <SettingsSection doc={doc} onCommit={commit} />}
        </main>
      </div>
    </div>
  );
}
