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

// Owner editor shell. One document, seven rooms: Overview, Menus,
// Dishes, Specials, Sold out, QR and Links, Settings. The document loads
// from /api/menu. ONE save model everywhere (decided Nov 3, 2026 after
// the usability pass found two models fighting): every change autosaves
// through /api/menu PUT into the Neon menus row when DATABASE_URL is
// set, debounced about 800ms, with the state always visible in the
// header (unsaved, saving, saved with time, failed with retry). There
// is no Save button to hunt for and none that sits dead. Sign-in stays
// demo mode until magic links wire.
//
// First run (Nov 3, 2026, Evans's first-run tour standard, fullstack
// skill): a first-time owner gets a short tour on first open, skippable
// at any step, remembered per device, replayable from Overview; under
// it sits a self-ticking "Get your menu ready" checklist on Overview.
const SECTIONS: { id: EditorSectionId; label: string; short: string }[] = [
  { id: "overview", label: "Overview", short: "Overview" },
  { id: "menus", label: "Menus", short: "Menus" },
  { id: "items", label: "Dishes", short: "Dishes" },
  { id: "specials", label: "Specials", short: "Specials" },
  { id: "availability", label: "Sold out", short: "Sold out" },
  { id: "qr", label: "QR and Links", short: "QR + Links" },
  { id: "settings", label: "Settings", short: "Settings" },
];

const TOUR_KEY = `claro-menu-tour-v1:${restaurantConfig.domain.primary}`;
const FIRSTRUN_KEY = `claro-menu-firstrun-v1:${restaurantConfig.domain.primary}`;

const TOUR_STEPS: { section: EditorSectionId; title: string; body: string }[] = [
  { section: "overview", title: "Welcome to your menu editor", body: "Everything your guests see on your menu page is controlled from here, on your phone. This short walk shows you the four jobs that matter. Skip it any time." },
  { section: "items", title: "Your dishes live here", body: "Tap Add food to put a new dish on the menu with its photo and price. To change just a price later, tap the price itself, type the new one, and you are done." },
  { section: "availability", title: "When the kitchen runs out", body: "Open Sold out and tap the dish. Guests see it marked sold out at once, and it comes back when you say: end of service, tomorrow, or when you switch it back." },
  { section: "specials", title: "Offers run themselves", body: "A special is a timed offer, like happy hour. Set it once with its days and hours, and it switches itself on and off. Your normal prices are never touched." },
  { section: "qr", title: "Put your link everywhere", body: "Download the QR code for your tables, and paste your menu link into your Instagram bio and Google profile. That is how guests find the menu." },
];

type SaveState = "clean" | "dirty" | "saving" | "saved" | "error";
export interface FirstRunFlags { viewedLive: boolean; visitedQr: boolean }

// Shape guard before any save: a corrupt document must never reach the
// database. Mirrors the promises the dish and special forms already make.
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

function FirstRunTour({ step, onStep, onClose }: { step: number; onStep: (n: number) => void; onClose: () => void }) {
  const s = TOUR_STEPS[step];
  const last = step === TOUR_STEPS.length - 1;
  // Evans (Nov 3, 2026, after using the editor himself): the card must
  // not sit solid over the bottom of the page while the owner scrolls.
  // While any scroll is moving it fades to a ghost and blurs slightly,
  // so the page reads through it; when scrolling rests it comes back
  // solid for reading and tapping. A tour that blocks the page fails
  // the first-run rule in the fullstack skill.
  const [dimmed, setDimmed] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      setDimmed(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setDimmed(false), 180);
    };
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll, { capture: true });
      if (timer) clearTimeout(timer);
    };
  }, []);
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[70] p-4 pb-6"
      role="dialog"
      aria-label="Welcome tour"
      style={{
        opacity: dimmed ? 0.18 : 1,
        filter: dimmed ? "blur(2px)" : "blur(0px)",
        transition: "opacity 300ms ease, filter 300ms ease",
        pointerEvents: dimmed ? "none" : "auto",
      }}
    >
      <div className="max-w-xl mx-auto border hairline p-5" style={{ background: "var(--color-surface)" }}>
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-mono2 text-[13px] uppercase tracking-[0.22em]" style={{ color: "var(--color-accent)" }}>
            Step {step + 1} of {TOUR_STEPS.length}
          </p>
          <button type="button" onClick={onClose} className="font-mono2 text-[13px] font-bold uppercase tracking-wider px-2 py-1 opacity-80">
            Skip tour
          </button>
        </div>
        <h2 className="font-display uppercase text-3xl leading-none mt-3">{s.title}</h2>
        <p className="text-[15px] leading-relaxed mt-2.5 opacity-90">{s.body}</p>
        <div className="flex gap-2.5 mt-5">
          {step > 0 && (
            <button type="button" onClick={() => onStep(step - 1)} className="px-4 py-3 border hairline font-mono2 text-[13px] font-bold uppercase tracking-wider">
              Back
            </button>
          )}
          <button
            type="button"
            onClick={() => (last ? onClose() : onStep(step + 1))}
            className="flex-1 px-4 py-3 font-mono2 text-[13px] font-bold uppercase tracking-wider"
            style={{ background: "var(--color-accent)", color: "#0D0A07" }}
          >
            {last ? "Finish, show my overview" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
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
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [flags, setFlags] = useState<FirstRunFlags>({ viewedLive: false, visitedQr: false });
  const docRef = useRef(doc);
  docRef.current = doc;
  const savingRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    try {
      const raw = window.localStorage.getItem(FIRSTRUN_KEY);
      if (raw) setFlags({ viewedLive: false, visitedQr: false, ...JSON.parse(raw) });
    } catch { /* flags are a nicety, never a blocker */ }
    return () => { cancelled = true; };
  }, []);

  const setFlag = useCallback((patch: Partial<FirstRunFlags>) => {
    setFlags(prev => {
      const next = { ...prev, ...patch };
      try { window.localStorage.setItem(FIRSTRUN_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // Visiting the QR room ticks that checklist job on its own.
  useEffect(() => { if (section === "qr") setFlag({ visitedQr: true }); }, [section, setFlag]);

  // First open after sign-in: offer the tour once per device.
  useEffect(() => {
    if (!signedIn) return;
    try {
      if (!window.localStorage.getItem(TOUR_KEY)) { setTourStep(0); setTourOpen(true); }
    } catch { /* if storage is unavailable the tour simply does not nag */ }
  }, [signedIn]);

  const closeTour = useCallback(() => {
    try { window.localStorage.setItem(TOUR_KEY, new Date().toISOString()); } catch { /* ignore */ }
    setTourOpen(false);
    setSection("overview");
  }, []);

  const goTourStep = useCallback((n: number) => {
    setTourStep(n);
    setSection(TOUR_STEPS[n].section);
  }, []);

  const replayTour = useCallback(() => { setTourStep(0); setTourOpen(true); setSection("overview"); }, []);

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

  // The one save model: edits debounce about 800ms, then save on their
  // own. Structural changes (commit) skip the wait and save at once.
  // A failed save does not auto-retry in a loop; the header offers Retry.
  useEffect(() => {
    if (!dirty || saveState === "saving" || saveState === "error") return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void saveWith(docRef.current); }, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [dirty, doc, saveState, saveWith]);

  const update = useCallback((next: MenuDocument) => { setDoc(next); }, []);
  const commit = useCallback((next: MenuDocument) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setDoc(next);
    void saveWith(next);
  }, [saveWith]);
  const retrySave = useCallback(() => { void saveWith(docRef.current); }, [saveWith]);

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
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder={restaurantConfig.editor.ownerEmail} className="mt-2 w-full border hairline bg-transparent px-3 py-2.5 text-base outline-none focus:border-[var(--color-accent)]" />
          </label>
          <button onClick={() => setSignedIn(true)} className="mt-5 w-full py-3.5 font-mono2 text-[13px] font-bold uppercase tracking-wider" style={{ background: "var(--color-accent)", color: "#0D0A07" }}>Continue in demo mode</button>
          <p className="font-mono2 text-[13px] uppercase tracking-[0.2em] opacity-60 mt-4">Demo mode. No email is sent.</p>
        </div>
      </div>
    </main>
  );

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
        {/* Header: identity and the always-visible save state. Sticky. */}
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
                {saveState === "saving" ? "Saving..." : saveState === "error" ? "Save failed" : dirty ? "Unsaved changes, saving shortly" : saveMessage || "All changes saved"}
              </span>
              {saveState === "error" && (
                <button type="button" onClick={retrySave}
                  className="px-4 py-2.5 font-mono2 text-[13px] font-bold uppercase tracking-wider"
                  style={{ background: "var(--color-accent)", color: "#0D0A07" }}>
                  Retry save
                </button>
              )}
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
                  className="shrink-0 px-4 py-2.5 min-h-11 font-mono2 text-[13px] font-bold uppercase tracking-wider border"
                  style={current ? { background: "var(--color-accent)", color: "#0D0A07", borderColor: "transparent" } : { borderColor: "color-mix(in srgb, var(--color-ink) 20%, transparent)" }}>
                  {s.short}
                </button>
              );
            })}
          </nav>
        </header>

        <main className="px-5 py-7 md:px-10 md:py-9 max-w-3xl">
          {section === "overview" && <OverviewSection doc={doc} go={go} flags={flags} onViewLive={() => setFlag({ viewedLive: true })} onReplayTour={replayTour} />}
          {section === "menus" && <MenusSection doc={doc} onChange={update} onCommit={commit} />}
          {section === "items" && <ItemsSection doc={doc} onCommit={commit} startNewItem={pendingNewItem} onConsumeStartNew={() => setPendingNewItem(false)} />}
          {section === "specials" && <SpecialsSection doc={doc} onCommit={commit} />}
          {section === "availability" && <AvailabilitySection doc={doc} onCommit={commit} />}
          {section === "qr" && <QrSection />}
          {section === "settings" && <SettingsSection doc={doc} onCommit={commit} />}
        </main>
      </div>

      {tourOpen && <FirstRunTour step={tourStep} onStep={goTourStep} onClose={closeTour} />}
    </div>
  );
}
