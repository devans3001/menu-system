"use client";
// Shared building blocks for the owner editor. MIDNIGHT GRILL POSTER
// tokens only: charcoal ground, hairline rules instead of card walls,
// flame for the one action that matters, gold reserved for specials,
// Anton for display, Space Mono for numbers and labels. Nothing under
// 13px: owners read this on phones, mid-service.
import type { ReactNode } from "react";

export type EditorSectionId = "overview" | "menus" | "items" | "specials" | "availability" | "qr" | "settings";

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAY_NAMES_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

let counter = 0;
export function uid(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

// 16px text on inputs: under 16px, iPhones zoom the page on focus
// (Design Motion bench, folded into the fullstack skill Nov 3, 2026).
export const inputCls =
  "w-full border hairline bg-transparent px-3 py-2.5 text-base outline-none focus:border-[var(--color-accent)] rounded-none";
export const labelCls = "block text-[13px] font-semibold uppercase tracking-wide opacity-90";
export const primaryBtn =
  "px-5 py-3 font-mono2 text-[13px] font-bold uppercase tracking-wider disabled:opacity-50";
export const ghostBtn =
  "px-5 py-3 border hairline font-mono2 text-[13px] font-bold uppercase tracking-wider disabled:opacity-50";

export function PrimaryButton({ children, onClick, disabled, style }: { children: ReactNode; onClick?: () => void; disabled?: boolean; style?: React.CSSProperties }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={primaryBtn} style={{ background: "var(--color-accent)", color: "#0D0A07", ...style }}>
      {children}
    </button>
  );
}

export function GhostButton({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={ghostBtn}>
      {children}
    </button>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className={labelCls}>
      {label}
      <span className="block mt-1.5 normal-case tracking-normal font-normal">{children}</span>
      {hint && <span className="block mt-1.5 text-[13px] normal-case tracking-normal font-normal opacity-60">{hint}</span>}
    </label>
  );
}

export function SectionTitle({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap">
      <div>
        <p className="font-mono2 text-[13px] uppercase tracking-[0.22em]" style={{ color: "var(--color-accent)" }}>{eyebrow}</p>
        <h2 className="font-display uppercase text-4xl leading-none mt-2">{title}</h2>
      </div>
      {children}
    </div>
  );
}

// Big, thumb-friendly sold-out / on-off switch. Flame when on. The hit
// area is 64 by 44px even though the visible track is smaller: touch
// targets pad to 44px per the interaction bench.
export function BigToggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className="relative w-16 h-11 shrink-0"
    >
      <span className="absolute left-1 top-1/2 -translate-y-1/2 w-14 h-8 rounded-full transition-colors" style={{ background: on ? "var(--color-accent)" : "color-mix(in srgb, var(--color-ink) 25%, transparent)" }} />
      <span className="absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full transition-all" style={{ left: on ? "34px" : "8px", background: "var(--color-ink)" }} />
    </button>
  );
}

// Delete feedback with a way back. Per the interaction bench, undo beats
// a confirmation dialog for anything reversible: the delete happens at
// once, and this bar offers Undo for 10 seconds. The owning section
// holds the pre-delete snapshot and clears this after the timeout.
export function UndoToast({ message, onUndo }: { message: string; onUndo: () => void }) {
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-4 px-5 py-3 border hairline max-w-[92vw]" style={{ background: "var(--color-surface)" }} role="status">
      <span className="text-[15px]">{message}</span>
      <button type="button" onClick={onUndo} className="font-mono2 text-[13px] font-bold uppercase tracking-wider px-3 py-2 shrink-0" style={{ color: "var(--color-accent)" }}>
        Undo
      </button>
    </div>
  );
}

// Day-of-week chips, Sun..Sat. Large touch targets.
export function DayChips({ days, onChange }: { days: number[]; onChange: (days: number[]) => void }) {
  return (
    <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Days of the week">
      {DAY_NAMES.map((name, d) => {
        const active = days.includes(d);
        return (
          <button
            key={name}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? days.filter(x => x !== d) : [...days, d].sort((a, b) => a - b))}
            className="min-w-11 min-h-11 inline-flex items-center justify-center px-2 py-2.5 font-mono2 text-[13px] font-bold uppercase tracking-wide border"
            style={active ? { background: "var(--color-accent)", color: "#0D0A07", borderColor: "transparent" } : { borderColor: "color-mix(in srgb, var(--color-ink) 20%, transparent)" }}
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}

// Multi-select chips for fixed vocabularies (dietary tags, allergens).
export function ChipMultiSelect<T extends string>({ options, value, onChange, format }: {
  options: readonly T[];
  value: T[];
  onChange: (v: T[]) => void;
  format?: (v: T) => string;
}) {
  const label = (v: T) => (format ? format(v) : v.replace(/_/g, " "));
  return (
    <div className="flex gap-1.5 flex-wrap">
      {options.map(opt => {
        const active = value.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? value.filter(x => x !== opt) : [...value, opt])}
            className="px-3 py-2 min-h-11 inline-flex items-center text-[13px] font-semibold border capitalize"
            style={active ? { background: "var(--color-ink)", color: "var(--color-bg)", borderColor: "transparent" } : { borderColor: "color-mix(in srgb, var(--color-ink) 20%, transparent)" }}
          >
            {label(opt)}
          </button>
        );
      })}
    </div>
  );
}

export function EmptyState({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <div className="border hairline border-dashed p-6 text-center" style={{ background: "var(--color-surface)" }}>
      <p className="font-display uppercase text-2xl">{title}</p>
      <p className="text-[15px] opacity-75 mt-2 max-w-md mx-auto leading-relaxed">{body}</p>
      {children && <div className="mt-4 flex justify-center gap-2.5 flex-wrap">{children}</div>}
    </div>
  );
}

export function scheduleSummary(days: number[], windows: { start: string; end: string }[]): string {
  const dayPart = days.length === 7 ? "Every day" : days.slice().sort((a, b) => a - b).map(d => DAY_NAMES[d]).join(", ");
  const winPart = windows.map(w => `${w.start} to ${w.end}`).join(" · ");
  return winPart ? `${dayPart} · ${winPart}` : dayPart;
}

// Parse a text field into a price. Returns null for blank, NaN for junk.
export function parsePrice(text: string): number | null {
  const t = text.replace(/[, ]/g, "");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}
