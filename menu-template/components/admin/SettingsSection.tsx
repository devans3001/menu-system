"use client";
import { useState } from "react";
import type { MenuDocument } from "../../lib/types";
import { restaurantConfig } from "../../restaurant.config";
import { Field, PrimaryButton, SectionTitle, inputCls } from "./shared";

// Settings: the venue's own words. Display name and holding page copy
// live in the menu document and save through the editor's save path.
// Setup facts (domain, currency, owner email) are shown for reference;
// they change at setup, not here. The photo storage meter is an honest
// placeholder: a live reading needs the Cloudinary Admin API and
// connects at the first client setup.
export default function SettingsSection({ doc, onCommit }: { doc: MenuDocument; onCommit: (next: MenuDocument) => void }) {
  const [name, setName] = useState(doc.venue.name);
  const [holding, setHolding] = useState(doc.venue.holdingMessage ?? "");
  const [cloudPct] = useState(34); // placeholder meter reading; live usage needs the Cloudinary Admin API (key + secret), connected at first client setup

  const dirty = name !== doc.venue.name || holding !== (doc.venue.holdingMessage ?? "");

  function save() {
    const next = structuredClone(doc);
    next.venue = { ...next.venue, name: name.trim() || doc.venue.name, holdingMessage: holding.trim() || undefined };
    onCommit(next);
  }

  const facts: { label: string; value: string }[] = [
    { label: "Menu address", value: "https://" + restaurantConfig.domain.primary + "/" },
    { label: "Owner email", value: restaurantConfig.editor.ownerEmail },
    { label: "Currency", value: doc.venue.currency },
    { label: "Timezone", value: doc.venue.timezone },
    { label: "Billing", value: restaurantConfig.billing.mode === "monthly" ? "Monthly plan" : "One-time payment" },
  ];

  return (
    <div>
      <SectionTitle eyebrow="The venue's own words" title="Settings" />

      <div className="grid gap-6 mt-7 max-w-xl">
        <Field label="Restaurant display name" hint="The name guests and this editor use for the venue.">
          <input value={name} onChange={e => setName(e.target.value)} className={inputCls} />
        </Field>
        <Field label="What the holding page shows" hint="When your page is paused, guests see this instead of the menu. Write it the way you would say it at the door.">
          <textarea value={holding} onChange={e => setHolding(e.target.value)} className={inputCls} rows={3} placeholder="Please check back soon. If you are at the restaurant, a member of the team can help you with today's menu." />
        </Field>
        <div>
          <PrimaryButton onClick={save} disabled={!dirty || !name.trim()}>Save settings</PrimaryButton>
        </div>
      </div>

      <section className="mt-10 border hairline p-5 grain max-w-xl" style={{ background: "var(--color-surface)" }} aria-label="Photo storage">
        <div className="relative z-[2]">
          <div className="flex justify-between items-baseline gap-3">
            <h3 className="font-semibold text-[15px]">Photo storage</h3>
            <span className="font-mono2 text-[13px] font-bold">{cloudPct}% used</span>
          </div>
          <div className="h-1.5 mt-3 overflow-hidden" style={{ background: "color-mix(in srgb, var(--color-ink) 12%, transparent)" }}>
            <div className="h-full" style={{ width: cloudPct + "%", background: "var(--color-accent2)" }} />
          </div>
          <p className="text-[13px] opacity-75 mt-2.5 leading-relaxed">
            Placeholder reading. Your photos live on your own Cloudinary account, and the live meter connects at your first client setup.
            Text and price edits are unlimited; new uploads pause at your Cloudinary cap. Every photo is finished with the realistic grade automatically.
          </p>
        </div>
      </section>

      <div className="mt-10 max-w-xl">
        <h3 className="font-display uppercase text-2xl">Setup facts</h3>
        <div className="mt-3 border-t hairline">
          {facts.map(f => (
            <div key={f.label} className="flex items-baseline justify-between gap-4 py-3 border-b hairline">
              <span className="text-[13px] font-semibold uppercase tracking-wide opacity-70">{f.label}</span>
              <span className="font-mono2 text-[13px] text-right break-all">{f.value}</span>
            </div>
          ))}
        </div>
        <p className="text-[13px] opacity-60 mt-3">These are set when your page is built. Ask Claro &amp; Co to change them.</p>
      </div>
    </div>
  );
}
