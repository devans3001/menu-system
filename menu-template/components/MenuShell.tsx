"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { CustomEase } from "gsap/CustomEase";
import type { MenuDocument, Special } from "../lib/types";
import { activeMenu, activeSpecials, isSoldOut, specialForItem, specialPrice } from "../lib/specials";
import { formatPrice, displayPriceForItem } from "../lib/format";
import FirstBite from "./FirstBite";
import { restaurantConfig } from "../restaurant.config";

// MIDNIGHT GRILL POSTER: the guest view. One flame accent for action and
// price, gold spent only on specials, monumental Anton dish names,
// Cormorant italic for the poetry, Space Mono for every number.
//
// THE FLIP motion: a GSAP fold. The incoming page is already rendered
// beneath; the outgoing page folds away from its spine edge (rightward
// travel folds from the left spine, reverse mirrors it) with a soft
// shadow sweeping across the folding sheet, and the incoming page
// settles from a 0.985 scale. Single turn 580ms on a custom ease in
// the power3.out family (fast lift, soft land, no bounce). Category
// jumps riffle: two quick partial folds, then the full fold lands the
// chapter. Honest scope note: the homework spec calls for a shared
// 16-frame photoreal page-curl sequence composited over the dish
// photo. That photographed engine asset does not exist yet, so this
// GSAP fold is the engine until the asset is shot or generated.
// Transforms and opacity only, so it holds frame rate on modest phones.

type Turn = { from: number; to: number; dir: 1 | -1; kind: "turn" | "riffle"; spread: boolean };

if (typeof window !== "undefined") {
  try { gsap.registerPlugin(CustomEase); CustomEase.create("flipEase", "M0,0 C0.16,0.06 0.3,0.34 0.5,0.6 C0.68,0.83 0.86,0.96 1,1"); } catch { /* fall back to power3.inOut */ }
}
const FLIP_EASE = (() => { try { return CustomEase.get("flipEase") ? "flipEase" : "power3.inOut"; } catch { return "power3.inOut"; } })();

type PageEntry = { item: MenuDocument["items"][number]; sectionName: string; sectionId: string };

export default function MenuShell({ doc }: { doc: MenuDocument }) {
  const [showIntro, setShowIntro] = useState(true);
  const [view, setView] = useState<"flip" | "list">("flip");
  const [page, setPage] = useState(0);
  const [turn, setTurn] = useState<Turn | null>(null);
  const [turnH, setTurnH] = useState<number | null>(null);
  const [reducedMotion] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const currency = doc.venue.currency;
  const menu = useMemo(() => activeMenu(doc), [doc]);
  const specialsNow = useMemo(() => activeSpecials(doc), [doc]);
  const sections = useMemo(() => menu.sectionIds.map(id => doc.sections.find(s => s.id === id)).filter(Boolean) as typeof doc.sections, [doc, menu]);
  const pages = useMemo(() => {
    const out: PageEntry[] = [];
    for (const sec of sections) for (const iid of sec.itemIds) {
      const item = doc.items.find(i => i.id === iid);
      if (item && item.active) out.push({ item, sectionName: sec.name, sectionId: sec.id });
    }
    return out;
  }, [doc, sections]);
  const safePage = Math.min(page, Math.max(0, pages.length - 1));
  const current = pages[safePage];
  const shownIdx = turn ? turn.to : safePage;
  const shown = pages[shownIdx];

  const stageRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLDivElement>(null);
  const outRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const touchRef = useRef<{ x: number; y: number } | null>(null);

  const startTurn = (to: number, kind: "turn" | "riffle") => {
    if (turn || to === safePage || to < 0 || to >= pages.length) return;
    const h = baseRef.current?.offsetHeight;
    if (h) setTurnH(h);
    // At 640px and up the card is an open book spread, and the turning
    // sheet is one page of that spread folding around the centre spine.
    const spread = typeof window !== "undefined" && window.innerWidth >= 640;
    setTurn({ from: safePage, to, dir: to > safePage ? 1 : -1, kind, spread });
  };
  const goNext = () => startTurn(safePage + 1, "turn");
  const goPrev = () => startTurn(safePage - 1, "turn");

  // The fold itself. Runs once per turn, after the overlay has rendered.
  useLayoutEffect(() => {
    if (!turn) return;
    const out = outRef.current, inn = baseRef.current, sh = shadowRef.current;
    if (!out || !inn) { setPage(turn.to); setTurn(null); setTurnH(null); return; }
    const finish = () => { gsap.set(inn, { clearProps: "transform" }); setPage(turn.to); setTurn(null); setTurnH(null); };
    if (reducedMotion) {
      // Reduced motion: 200ms crossfade, no fold, no scale.
      const tween = gsap.to(out, { opacity: 0, duration: 0.2, ease: "power1.out", onComplete: finish });
      return () => { tween.kill(); };
    }
    const endAngle = turn.dir === 1 ? -104 : 104;
    gsap.set(out, { rotateY: 0, transformOrigin: turn.dir === 1 ? "left center" : "right center" });
    gsap.set(inn, { scale: 0.985, transformOrigin: "center center" });
    if (sh) gsap.set(sh, { opacity: 0 });
    const tl = gsap.timeline({ onComplete: finish });
    if (turn.kind === "riffle") {
      // Two quick partial folds (about 250ms of flutter), then the full fold.
      const mid1 = turn.dir === 1 ? -34 : 34;
      const midBack = turn.dir === 1 ? -13 : 13;
      const mid2 = turn.dir === 1 ? -40 : 40;
      tl.to(out, { rotateY: mid1, duration: 0.11, ease: "power2.in" }, 0)
        .to(out, { rotateY: midBack, duration: 0.06, ease: "power1.out" }, 0.11)
        .to(out, { rotateY: mid2, duration: 0.09, ease: "power2.in" }, 0.17)
        .to(out, { rotateY: endAngle, duration: 0.36, ease: FLIP_EASE }, 0.26)
        .to(sh, { opacity: 0.8, duration: 0.2, ease: "power1.out" }, 0)
        .to(sh, { opacity: 0.2, duration: 0.3, ease: "power1.inOut" }, 0.3)
        .to(inn, { scale: 1, duration: 0.62, ease: "power2.out" }, 0);
    } else {
      tl.to(out, { rotateY: endAngle, duration: 0.58, ease: FLIP_EASE }, 0)
        .to(sh, { opacity: 0.85, duration: 0.24, ease: "power1.out" }, 0)
        .to(sh, { opacity: 0.2, duration: 0.34, ease: "power1.inOut" }, 0.24)
        .to(inn, { scale: 1, duration: 0.58, ease: "power2.out" }, 0);
    }
    return () => { tl.kill(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn]);

  // Preload the photos two pages either side, so a turn never waits.
  useEffect(() => {
    if (typeof window === "undefined") return;
    for (let d = -2; d <= 2; d++) {
      const p = pages[shownIdx + d];
      if (p?.item.photoUrl) { const img = new Image(); img.src = p.item.photoUrl; }
    }
  }, [shownIdx, pages]);

  // Arrow keys turn the page, like a book on a stand.
  useEffect(() => {
    if (view !== "flip" || showIntro) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, showIntro, turn, safePage, pages.length]);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.changedTouches[0];
    touchRef.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchRef.current;
    touchRef.current = null;
    if (!start || turn) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      if (dx < 0) goNext(); else goPrev();
    }
  };

  const jumpToSection = (secId: string) => {
    const idx = pages.findIndex(p => p.sectionId === secId);
    if (idx < 0) return;
    if (view !== "flip") { setPage(idx); setView("flip"); return; }
    if (idx === safePage) return;
    startTurn(idx, Math.abs(idx - safePage) === 1 ? "turn" : "riffle");
  };

  return (
    <main className="min-h-screen">
      {showIntro && restaurantConfig.registryState !== "paused" && (
        <FirstBite posterUrl={restaurantConfig.firstBite.posterUrl} name={restaurantConfig.displayName} durationSec={restaurantConfig.firstBite.durationSec} onDone={() => setShowIntro(false)} />
      )}
      <div className="mx-auto w-full max-w-3xl sm:max-w-[1120px]">
        <header className="px-5 pt-5 pb-3 flex items-center justify-between gap-3">
          <h1 className="font-display uppercase leading-none text-[22px] min-w-0 truncate">{restaurantConfig.displayName}</h1>
          <div className="flex shrink-0 border hairline rounded-full overflow-hidden" role="tablist" aria-label="Menu view">
            <button onClick={() => setView("flip")} className="px-4 py-2 font-mono2 text-xs font-bold uppercase tracking-wider" style={view === "flip" ? { background: "var(--color-accent)", color: "#0D0A07" } : {}}>Flip</button>
            <button onClick={() => setView("list")} className="px-4 py-2 font-mono2 text-xs font-bold uppercase tracking-wider" style={view === "list" ? { background: "var(--color-accent)", color: "#0D0A07" } : {}}>List</button>
          </div>
        </header>
        <p className="px-5 pb-3 font-mono2 text-xs uppercase tracking-[0.22em] opacity-70">{menu.name} menu · {menu.priceNote}</p>

        {specialsNow.length > 0 && (
          <div className="gold-leaf px-5 py-2.5" style={{ background: "var(--color-accent2)", color: "#0D0A07" }}>
            <p className="font-mono2 text-xs font-bold uppercase tracking-[0.14em]">{stripText(doc, specialsNow[0])}</p>
          </div>
        )}

        <nav className="flex gap-2 overflow-x-auto no-scrollbar px-5 py-3" aria-label="Sections">
          {sections.map(sec => {
            const isActive = view === "flip" && shown?.sectionId === sec.id;
            return (
              <button key={sec.id} onClick={() => jumpToSection(sec.id)}
                className="whitespace-nowrap shrink-0 rounded-full border px-3.5 py-2 font-mono2 text-xs uppercase tracking-[0.14em]"
                style={isActive ? { background: "var(--color-accent)", borderColor: "transparent", color: "#0D0A07", fontWeight: 700 } : { borderColor: "color-mix(in srgb, var(--color-ink) 25%, transparent)" }}>
                {sec.name}
              </button>
            );
          })}
        </nav>

        {view === "flip" && shown && (
          <section className="px-4 sm:px-5 pb-6 pt-1">
            <div ref={stageRef} className="flip-stage relative" style={{ perspective: "1400px", height: turnH ?? undefined }}
              onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
              <div ref={baseRef} style={{ willChange: "transform" }}>
                <FlipCard doc={doc} entry={shown} index={shownIdx} total={pages.length} currency={currency} />
              </div>
              {turn && pages[turn.from] && (!turn.spread || reducedMotion) && (
                <div ref={outRef} className="flip-out absolute inset-0 z-30" style={{ backfaceVisibility: "hidden", willChange: "transform" }} aria-hidden="true">
                  <FlipCard doc={doc} entry={pages[turn.from]} index={turn.from} total={pages.length} currency={currency} fill />
                  <div ref={shadowRef} className="absolute inset-0 z-40 pointer-events-none opacity-0"
                    style={{ background: turn.dir === 1 ? "linear-gradient(to right, rgba(6,4,2,0) 30%, rgba(6,4,2,0.88) 100%)" : "linear-gradient(to left, rgba(6,4,2,0) 30%, rgba(6,4,2,0.88) 100%)" }} />
                </div>
              )}
              {turn && pages[turn.from] && turn.spread && !reducedMotion && (
                <div ref={outRef} className="flip-out absolute top-0 bottom-0 z-30 overflow-hidden" aria-hidden="true"
                  style={{ backfaceVisibility: "hidden", willChange: "transform", width: "50%", left: turn.dir === 1 ? "50%" : "0" }}>
                  {turn.dir === 1
                    ? <FlipPanel doc={doc} entry={pages[turn.from]} currency={currency} sheet />
                    : <FlipPhoto doc={doc} entry={pages[turn.from]} index={turn.from} total={pages.length} currency={currency} sheet />}
                  <div ref={shadowRef} className="absolute inset-0 z-40 pointer-events-none opacity-0"
                    style={{ background: turn.dir === 1 ? "linear-gradient(to right, rgba(6,4,2,0) 30%, rgba(6,4,2,0.88) 100%)" : "linear-gradient(to left, rgba(6,4,2,0) 30%, rgba(6,4,2,0.88) 100%)" }} />
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 mt-5">
              <button disabled={!!turn || shownIdx === 0} onClick={goPrev} className="flex-1 border hairline py-4 font-mono2 text-sm font-bold uppercase tracking-wider disabled:opacity-35">Previous</button>
              <span className="font-mono2 text-[13px] opacity-75 shrink-0">{shownIdx + 1} / {pages.length}</span>
              <button disabled={!!turn || shownIdx >= pages.length - 1} onClick={goNext} className="flex-1 py-4 font-mono2 text-sm font-bold uppercase tracking-wider disabled:opacity-35" style={{ background: "var(--color-accent)", color: "#0D0A07" }}>Next dish</button>
            </div>
          </section>
        )}

        {view === "list" && (
          <section className="px-5 pb-6 space-y-10">
            {sections.map(sec => (
              <div key={sec.id}>
                <h2 className="font-display uppercase text-[28px] leading-none">{sec.name}</h2>
                {sec.note && <p className="font-serif2 italic text-lg leading-[1.5] mt-1.5 opacity-85">{sec.note}</p>}
                <div className="mt-2 sm:grid sm:grid-cols-2 sm:gap-x-10">
                  {sec.itemIds.map(iid => {
                    const item = doc.items.find(i => i.id === iid);
                    if (!item || !item.active) return null;
                    const sold = isSoldOut(doc, item.id);
                    const special = specialForItem(doc, item.id, [sec.id]);
                    const sp = special && item.basePrice !== null ? specialPrice(item.basePrice, special) : null;
                    return (
                      <article key={item.id} className={"py-4 flex gap-4 border-b hairline " + (sold ? "opacity-60" : "")}>
                        {item.photoUrl && /* eslint-disable-next-line @next/next/no-img-element */ <img src={item.photoUrl} alt="" className={"w-[92px] h-[92px] object-cover shrink-0 photo-grade " + (sold ? "grayscale" : "")} />}
                        <div className="min-w-0 flex-1">
                          <h3 className="font-display uppercase text-lg leading-tight tracking-wide">{item.name}</h3>
                          <p className="font-serif2 italic text-[16px] leading-[1.5] opacity-85 mt-0.5 line-clamp-2">{item.description}</p>
                          {sold && <p className="font-mono2 text-xs font-bold uppercase tracking-[0.2em] mt-1.5" style={{ color: "var(--color-accent)" }}>Sold out</p>}
                          {special && !sold && <p className="font-mono2 text-xs font-bold uppercase tracking-[0.2em] mt-1.5" style={{ color: "var(--color-accent2)" }}>{special.badgeText}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          {sp !== null && item.basePrice !== null ? (<>
                            <div className="font-mono2 text-[13px] line-through opacity-55">{formatPrice(item.basePrice, currency)}</div>
                            <div className="font-mono2 text-sm">{formatPrice(sp, currency)}</div>
                          </>) : (
                            <span className="font-mono2 text-sm">{displayPriceForItem(item, currency)}</span>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ))}
            {doc.bundles.map(b => (
              <div key={b.id} className="border hairline p-5 grain" style={{ background: "var(--color-surface)" }}>
                <p className="font-mono2 text-xs uppercase tracking-[0.24em] opacity-70">For the table</p>
                <h3 className="font-display uppercase text-2xl mt-1.5">{b.name}</h3>
                <p className="font-serif2 italic text-lg leading-[1.5] mt-1 opacity-90">{b.description}</p>
                <p className="font-mono2 mt-2">{formatPrice(b.price, currency)}</p>
                <ul className="text-sm mt-3 space-y-1.5">{b.slots.map(s => <li key={s.id} className="flex justify-between gap-3 border-t hairline pt-1.5"><span>{s.label}</span><span className="opacity-75 text-right">{s.optionItemIds.map(id => doc.items.find(i => i.id === id)?.name).filter(Boolean).join(", ")}</span></li>)}</ul>
              </div>
            ))}
          </section>
        )}
        <footer className="px-5 pb-10 pt-2 border-t hairline mx-5 px-0 font-mono2 text-xs uppercase tracking-[0.2em] opacity-70" style={{ paddingLeft: 0, paddingRight: 0 }}>
          <p>{restaurantConfig.city} · Open daily · {restaurantConfig.contacts.phone}</p>
          <p className="mt-1.5 normal-case tracking-normal font-sans text-[13px] leading-[1.5]" style={{ fontFamily: "var(--f-body)" }}>Menu shown: {menu.name}. {menu.priceNote}</p>
        </footer>
      </div>
    </main>
  );
}

function FlipCard({ doc, entry, index, total, currency, fill }: { doc: MenuDocument; entry: PageEntry; index: number; total: number; currency: string; fill?: boolean }) {
  const sold = isSoldOut(doc, entry.item.id);
  const special = specialForItem(doc, entry.item.id, [entry.sectionId]);
  return (
    <div data-flip-card className={"grain relative border hairline overflow-hidden sm:grid sm:grid-cols-2 " + (fill ? "h-full " : "") + (sold ? "is-86 " : "") + (special ? "gold-leaf" : "")}
      style={{ background: "var(--color-surface)", boxShadow: "0 30px 80px rgba(0,0,0,0.55)" }}>
      <FlipPhoto doc={doc} entry={entry} index={index} total={total} currency={currency} />
      <FlipPanel doc={doc} entry={entry} currency={currency} />
      {/* The centre spine of the open book: a soft vertical shadow where
          the pages meet, spread widths only. */}
      <div className="hidden sm:block absolute inset-y-0 left-1/2 w-20 -translate-x-1/2 z-30 pointer-events-none"
        style={{ background: "linear-gradient(to right, transparent, rgba(6,4,2,0.5) 50%, transparent)" }} aria-hidden="true" />
    </div>
  );
}

// The photo page. On a phone it is the top of the card and carries the
// dish name over a scrim, poster style, so the food gets the biggest
// share of the card. In the spread it is the left page, full bleed.
export function FlipPhoto({ doc, entry, index, total, currency, sheet }: { doc: MenuDocument; entry: PageEntry; index: number; total: number; currency: string; sheet?: boolean }) {
  const sold = isSoldOut(doc, entry.item.id);
  return (
    <div data-flip-photo className={"relative " + (sheet ? "h-full w-full" : "h-[86dvh] max-h-[740px] min-h-[380px] sm:h-auto sm:max-h-none sm:min-h-[620px]")}>
      <div className="absolute inset-0 overflow-hidden">
        {entry.item.photoUrl && /* eslint-disable-next-line @next/next/no-img-element */ <img src={entry.item.photoUrl} alt={entry.item.name} className="absolute inset-0 h-full w-full object-cover photo-grade" />}
        <div className="absolute top-3 left-4 right-4 z-20 flex gap-1" aria-hidden="true">
          {Array.from({ length: total }).map((_, i) => <span key={i} className="h-[3px] flex-1" style={{ background: i <= index ? "var(--color-accent)" : "rgba(247,239,227,0.35)" }} />)}
        </div>
        <span className="absolute top-7 left-4 z-20 font-mono2 text-xs uppercase tracking-[0.24em] px-2 py-1" style={{ background: "rgba(6,4,2,0.6)" }}>{entry.sectionName}</span>
        {entry.item.isHot && !sold && <div className="steam-layer" aria-hidden="true" />}
        {sold && (
          <span className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 -rotate-[10deg] border-[3px] px-4 py-1.5 font-display uppercase text-4xl tracking-wide whitespace-nowrap" style={{ borderColor: "var(--color-ink)", color: "var(--color-ink)", background: "rgba(6,4,2,0.35)", textShadow: "0 2px 0 rgba(0,0,0,0.4)" }}>Sold out</span>
        )}
        {/* Phone only: the dish name rides the bottom of the photo over
            a dark scrim. In the spread the name lives on the right page. */}
        <div className="absolute inset-x-0 bottom-0 z-20 pl-5 pr-[8.5rem] pb-7 pt-20 sm:hidden" style={{ background: "linear-gradient(to top, rgba(6,4,2,0.9) 22%, rgba(6,4,2,0.45) 62%, transparent)" }}>
          <h2 className="font-display uppercase leading-[0.95]" style={{ fontSize: "clamp(2.5rem, 11vw, 4rem)", letterSpacing: "0.025em", textShadow: "0 2px 18px rgba(0,0,0,0.55)" }}>{entry.item.name}</h2>
          {entry.item.subtitle && <p className="font-serif2 italic text-xl leading-[1.4] mt-1" style={{ color: "var(--color-accent)" }}>{entry.item.subtitle}</p>}
        </div>
        <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none hidden sm:block" style={{ background: "linear-gradient(to top, rgba(6,4,2,0.3), transparent)" }} />
      </div>
      <PricePill doc={doc} itemId={entry.item.id} sectionId={entry.sectionId} currency={currency} />
    </div>
  );
}

// The text page. A phone shows it under the photo, tight, choices in the
// print-menu way: a tracked label, then the options on flowing lines.
// In the spread it is the right page.
export function FlipPanel({ doc, entry, currency, sheet }: { doc: MenuDocument; entry: PageEntry; currency: string; sheet?: boolean }) {
  const sold = isSoldOut(doc, entry.item.id);
  return (
    <div className={"relative px-5 pb-4 pt-9 sm:px-9 sm:py-10 sm:flex sm:flex-col sm:justify-center " + (sheet ? "h-full overflow-hidden " : "")}
      style={{ background: "var(--color-surface)" }}>
      <div className={sold ? "opacity-60" : ""}>
        <div className="hidden sm:block">
          <h2 className="font-display uppercase leading-[0.95]" style={{ fontSize: "clamp(2.5rem, 4.2vw, 3.9rem)", letterSpacing: "0.025em" }}>{entry.item.name}</h2>
          {entry.item.subtitle && <p className="font-serif2 italic text-xl leading-[1.4] mt-1.5" style={{ color: "var(--color-accent)" }}>{entry.item.subtitle}</p>}
        </div>
        <p className="font-serif2 italic text-[19px] leading-[1.5] opacity-95 sm:mt-3">{entry.item.description}</p>
        <ItemDetail doc={doc} itemId={entry.item.id} currency={currency} />
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 sm:mt-4 pt-3 border-t hairline font-mono2 text-xs uppercase tracking-[0.16em] opacity-80">
          {entry.item.serves && <span>Serves {entry.item.serves}</span>}
          {entry.item.badges.map(b => <span key={b.label}>{b.label}</span>)}
          {entry.item.dietaryTags.map(t => <span key={t}>{t.replaceAll("_", " ")}</span>)}
          {entry.item.allergenContains.length > 0 && <span>Contains {entry.item.allergenContains.join(", ")}</span>}
        </div>
      </div>
    </div>
  );
}

function stripText(doc: MenuDocument, s: Special): string {
  const end = s.schedule.windows[0]?.end ?? "";
  const [eh, em] = end.split(":").map(Number);
  const till = end ? " · Till " + ((eh % 12) || 12) + (em ? ":" + String(em).padStart(2, "0") : "") + (eh >= 12 ? "pm" : "am") : "";
  if (s.ruleType === "percent_off") {
    const secName = s.targetSectionIds.map(id => doc.sections.find(x => x.id === id)?.name).filter(Boolean).join(", ");
    return s.name + " · " + s.ruleValue + "% off " + (secName || "selected items") + till;
  }
  if (s.ruleType === "fixed_special_price") return s.name + " · " + s.headline + till;
  return s.name + " · " + s.headline;
}

function PricePill({ doc, itemId, sectionId, currency }: { doc: MenuDocument; itemId: string; sectionId: string; currency: string }) {
  const item = doc.items.find(i => i.id === itemId)!;
  const special = specialForItem(doc, itemId, [sectionId]);
  const sp = special && item.basePrice !== null ? specialPrice(item.basePrice, special) : null;
  // The pill rides the photo's bottom edge on a phone (half over the
  // photo, half over the panel) and sits inside the photo page in the
  // spread, where the panel is beside the photo, not below it.
  const pill = "absolute -bottom-6 right-5 sm:bottom-5 sm:right-5 z-30 rounded-full px-5 py-2.5 font-mono2 text-base font-bold shadow-lg";
  if (item.wine) return <div className={pill} style={{ background: "var(--color-accent)", color: "#0D0A07" }}>Glass {formatPrice(item.wine.glassPrice, currency)}</div>;
  if (sp !== null && item.basePrice !== null) return (<>
    <div className={pill} style={{ background: "var(--color-accent2)", color: "#0D0A07" }}>{formatPrice(sp, currency)}</div>
    <div className="absolute -bottom-6 left-5 sm:bottom-5 sm:left-5 z-30 font-mono2 text-sm line-through opacity-70 px-2 py-1" style={{ background: "rgba(6,4,2,0.55)" }}>{formatPrice(item.basePrice, currency)}</div>
  </>);
  const variantPrices = doc.variants.filter(v => v.itemId === itemId && v.price !== null).map(v => v.price as number);
  const label = variantPrices.length ? "From " + formatPrice(Math.min(...variantPrices), currency) : displayPriceForItem(item, currency);
  return <div className={pill} style={{ background: "var(--color-accent)", color: "#0D0A07" }}>{label}</div>;
}

function PosterRows({ children }: { children: React.ReactNode }) {
  return <div className="border-y hairline divide-y divide-[color-mix(in_srgb,var(--color-ink)_14%,transparent)]">{children}</div>;
}
function Row({ left, right }: { left: React.ReactNode; right?: React.ReactNode }) {
  return <div className="flex items-baseline justify-between gap-4 py-2"><span className="min-w-0">{left}</span>{right !== undefined && <span className="font-mono2 text-sm shrink-0">{right}</span>}</div>;
}
function GroupLabel({ children }: { children: React.ReactNode }) {
  return <p className="font-mono2 text-xs font-bold uppercase tracking-[0.24em] mt-5 mb-2" style={{ color: "var(--color-accent)" }}>{children}</p>;
}

function ItemDetail({ doc, itemId, currency }: { doc: MenuDocument; itemId: string; currency: string }) {
  const item = doc.items.find(i => i.id === itemId)!;
  const variants = doc.variants.filter(v => v.itemId === itemId);
  const groups = doc.modifierGroups.filter(g => g.itemId === itemId).sort((a, b) => a.sortOrder - b.sortOrder);
  if (!variants.length && !groups.length && !item.wine) return null;
  return (
    <div className="text-[15px] leading-[1.5]">
      {item.wine && (<>
        <GroupLabel>{item.wine.producer}{item.wine.vintage ? " · " + item.wine.vintage : ""}{item.wine.appellation ? " · " + item.wine.appellation : ""}</GroupLabel>
        <PosterRows>
          <Row left="By the glass" right={formatPrice(item.wine.glassPrice, currency)} />
          <Row left="Carafe" right={formatPrice(item.wine.carafePrice, currency)} />
          <Row left="Bottle" right={formatPrice(item.wine.bottlePrice, currency)} />
        </PosterRows>
      </>)}
      {variants.length > 0 && (
        <p className="mt-3 sm:mt-4 leading-[1.55]">
          <span className="font-mono2 text-xs font-bold uppercase tracking-[0.24em] mr-2.5" style={{ color: "var(--color-accent)" }}>{variants.some(v => v.price !== null) ? "Choose your size" : "Choose yours"}</span>
          {variants.map((v, i) => (
            <span key={v.id}>{i > 0 && <span className="opacity-40"> · </span>}{v.name} <span className="font-mono2 text-[13px] opacity-80">{v.price !== null ? formatPrice(v.price, currency) : "Included"}</span></span>
          ))}
        </p>
      )}
      {groups.map(g => {
        const options = doc.modifierOptions.filter(o => o.groupId === g.id).sort((a, b) => a.sortOrder - b.sortOrder);
        return (
          <p key={g.id} className="mt-3 sm:mt-4 leading-[1.55]">
            <span className="font-mono2 text-xs font-bold uppercase tracking-[0.24em] mr-2.5" style={{ color: "var(--color-accent)" }}>{g.name}{g.required ? "" : " · Optional"}</span>
            {options.map((o, i) => (
              <span key={o.id}>
                {i > 0 && <span className="opacity-40"> · </span>}{o.name}
                {o.priceByVariant
                  ? <span className="font-mono2 text-[13px] opacity-75"> ({Object.entries(o.priceByVariant).map(([vid, p]) => { const v = doc.variants.find(x => x.id === vid); return (v ? v.name.split(" ")[0] : vid) + " " + formatPrice(p, currency); }).join(" · ")})</span>
                  : o.price !== 0 && <span className="font-mono2 text-[13px] opacity-80"> +{formatPrice(o.price, currency)}</span>}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
