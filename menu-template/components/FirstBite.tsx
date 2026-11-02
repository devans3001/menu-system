"use client";
import { useEffect, useState } from "react";
import { restaurantConfig } from "../restaurant.config";

// THE FIRST BITE: a film poster, not a welcome screen.
// The signature dish fills the whole viewport, the name devours the
// lower page in stacked Anton caps, one italic line, one flame pill.
// Honest scope: poster-first player with a timed hold and skip. The
// per-client 50-frame sequence plugs into this player later via
// firstBite.framesBaseUrl. No fake frame sequence is claimed as real.
export default function FirstBite({ posterUrl, name, durationSec, onDone }: { posterUrl: string; name: string; durationSec: number; onDone: () => void }) {
  const [gone, setGone] = useState(false);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    if (mq.matches) return;
    const t = setTimeout(() => { setGone(true); onDone(); }, durationSec * 1000);
    return () => clearTimeout(t);
  }, [durationSec, onDone]);
  if (gone) return null;
  const words = name.toUpperCase().split(" ");
  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden" style={{ background: "var(--color-bg)" }} role="dialog" aria-label="Welcome">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={posterUrl} alt={name + " signature dish"} className={"absolute inset-0 h-full w-full object-cover photo-grade " + (reduced ? "" : "bite-settle")} />
      <div className="absolute inset-x-0 bottom-0 h-2/3 pointer-events-none" style={{ background: "linear-gradient(to top, rgba(6,4,2,0.94) 22%, rgba(6,4,2,0.45) 55%, transparent)" }} />
      <div className="absolute top-5 left-5 right-5 flex items-center justify-between">
        <span className="font-mono2 text-[10px] uppercase tracking-[0.3em] px-2.5 py-1 border hairline" style={{ background: "rgba(6,4,2,0.55)" }}>The first bite</span>
        <span className="font-mono2 text-[10px] uppercase tracking-[0.3em] opacity-90">{restaurantConfig.city}</span>
      </div>
      <div className="relative mt-auto px-5 pb-7">
        <p className="font-serif2 italic text-[19px] leading-snug max-w-[19rem]" style={{ color: "var(--color-ink)" }}>
          Charcoal chicken, marinated overnight, finished over open fire until the skin crisps.
        </p>
        <h1 className="font-display uppercase leading-[0.88] mt-3" style={{ fontSize: "clamp(4.2rem, 21vw, 9rem)", color: "var(--color-ink)" }}>
          {words.map(w => <span key={w} className="block">{w}</span>)}
        </h1>
        <div className="flex items-end justify-between gap-4 mt-5">
          <p className="font-mono2 text-[10px] uppercase tracking-[0.22em] leading-relaxed opacity-85">
            Charcoal grill house<br />{restaurantConfig.contacts.phone}
          </p>
          <button onClick={() => { setGone(true); onDone(); }} className="shrink-0 rounded-full px-7 py-3.5 font-mono2 text-sm font-bold uppercase tracking-wider" style={{ background: "var(--color-accent)", color: "#0D0A07" }}>
            See the menu
          </button>
        </div>
        {reduced && <p className="mt-3 text-xs opacity-75">Reduced motion is on, so the intro is shown as a still.</p>}
      </div>
      {!reduced && (
        <div className="absolute bottom-0 left-0 right-0 h-[3px]" style={{ background: "rgba(247,239,227,0.18)" }}>
          <div className="bite-progress h-full w-full" style={{ background: "var(--color-accent)", animationDuration: durationSec + "s" }} />
        </div>
      )}
    </div>
  );
}
