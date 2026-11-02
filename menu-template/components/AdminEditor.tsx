"use client";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import type { MenuDocument, AutoReturnPreset } from "../lib/types";
import { formatPrice } from "../lib/format";
import { cloudinaryUploadConfigured, uploadPhotoToCloudinary } from "../lib/upload/cloudinary";
import { restaurantConfig } from "../restaurant.config";

// Demo mode: edits live in browser state only. In production these
// writes go through /api/menu to the Neon menus row, no redeploy.
// Visual system: MIDNIGHT GRILL POSTER tokens. Dark product surface,
// flame for action, mono for numbers, hairlines instead of card walls.
export default function AdminEditor({ initialDoc }: { initialDoc: MenuDocument }) {
  const [doc, setDoc] = useState<MenuDocument>(structuredClone(initialDoc));
  const [email, setEmail] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [cloudPct] = useState(34); // placeholder meter reading; live usage needs the Cloudinary Admin API (key + secret), wired later
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<{ id: string; message: string } | null>(null);
  const uploadsConfigured = cloudinaryUploadConfigured();
  const [qrPng, setQrPng] = useState(""); const [qrSvg, setQrSvg] = useState("");
  const menuUrl = "https://" + restaurantConfig.domain.primary + "/";

  useEffect(() => {
    QRCode.toDataURL(menuUrl, { width: 1024, margin: 2 }).then(setQrPng).catch(() => {});
    QRCode.toString(menuUrl, { type: "svg" }).then(setQrSvg).catch(() => {});
  }, [menuUrl]);

  const availability = useMemo(() => new Map(doc.availability.map(a => [a.entityId, a])), [doc]);

  function setPrice(itemId: string, value: string) {
    const n = value === "" ? null : Number(value);
    setDoc(d => ({ ...d, items: d.items.map(i => i.id === itemId ? { ...i, basePrice: Number.isNaN(n as number) ? i.basePrice : n } : i) }));
  }
  function setPhoto(itemId: string, value: string) {
    setDoc(d => ({ ...d, items: d.items.map(i => i.id === itemId ? { ...i, photoUrl: value } : i) }));
  }
  // Unsigned Cloudinary upload (lib/upload/cloudinary.ts). On success the
  // graded delivery URL lands in the photo field, exactly as a pasted
  // Cloudinary URL would.
  async function uploadPhoto(itemId: string, file: File | undefined) {
    if (!file) return;
    setUploadError(null);
    setUploadingId(itemId);
    try {
      const url = await uploadPhotoToCloudinary(file, restaurantConfig.cloudinary.folder);
      setPhoto(itemId, url);
    } catch (e) {
      setUploadError({ id: itemId, message: e instanceof Error ? e.message : "Upload failed. Try again." });
    } finally {
      setUploadingId(null);
    }
  }
  function toggle86(itemId: string, preset: AutoReturnPreset) {
    setDoc(d => {
      const existing = d.availability.find(a => a.entityType === "item" && a.entityId === itemId);
      const soldOut = existing ? !existing.soldOut : true;
      const rest = d.availability.filter(a => !(a.entityType === "item" && a.entityId === itemId));
      return { ...d, availability: [...rest, { entityType: "item" as const, entityId: itemId, soldOut, autoReturn: preset, updatedAt: new Date().toISOString() }] };
    });
  }
  function downloadSvg() {
    const blob = new Blob([qrSvg], { type: "image/svg+xml" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "menu-qr.svg"; a.click();
  }

  const inputCls = "w-full border hairline bg-transparent px-3 py-2.5 text-[15px] outline-none focus:border-[var(--color-accent)]";

  if (!signedIn) return (
    <main className="min-h-screen md:grid md:grid-cols-[3fr_2fr]">
      <div className="relative h-52 md:h-auto overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={restaurantConfig.firstBite.posterUrl} alt="" className="absolute inset-0 h-full w-full object-cover photo-grade" />
        <div className="absolute inset-x-0 bottom-0 h-2/3" style={{ background: "linear-gradient(to top, rgba(6,4,2,0.92), transparent)" }} />
        <span className="absolute top-4 left-5 font-mono2 text-[10px] uppercase tracking-[0.26em] px-2 py-1 border hairline" style={{ background: "rgba(6,4,2,0.55)" }}>Owner editor · Demo mode</span>
        <h1 className="absolute bottom-4 left-5 font-display uppercase leading-[0.9] text-5xl md:text-7xl">{restaurantConfig.displayName.split(" ").map(w => <span key={w} className="block">{w}</span>)}</h1>
      </div>
      <div className="flex items-start md:items-center px-6 py-8 md:p-12">
        <div className="w-full max-w-sm">
          <h2 className="font-display uppercase text-3xl">Sign in</h2>
          <p className="mt-2 text-[15px] opacity-85 leading-relaxed">We email you a sign-in link for {restaurantConfig.editor.ownerEmail}. No password.</p>
          <label className="block mt-7 text-sm font-semibold">Owner email
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder={restaurantConfig.editor.ownerEmail} className={"mt-2 " + inputCls} />
          </label>
          <button onClick={() => setSignedIn(true)} className="mt-5 w-full py-3.5 font-mono2 text-sm font-bold uppercase tracking-wider" style={{ background: "var(--color-accent)", color: "#0D0A07" }}>Continue in demo mode</button>
          <p className="font-mono2 text-[10px] uppercase tracking-[0.2em] opacity-60 mt-4">Demo mode. No email is sent. Your page is {restaurantConfig.registryState === "paused" ? "paused" : "live"}.</p>
        </div>
      </div>
    </main>
  );

  return (
    <main className="min-h-screen px-5 py-6 max-w-3xl mx-auto">
      <div className="flex items-start justify-between gap-4 pb-5 border-b hairline">
        <div>
          <p className="font-mono2 text-[10px] uppercase tracking-[0.26em]" style={{ color: "var(--color-accent)" }}>Owner editor · Demo mode</p>
          <h1 className="font-display uppercase text-3xl leading-none mt-2">{restaurantConfig.displayName}</h1>
          <p className="font-mono2 text-[11px] uppercase tracking-[0.16em] mt-2" style={{ color: "var(--color-accent2)" }}>Your page is live</p>
          <p className="text-sm opacity-70 mt-1">Edits here are local demo state only.</p>
        </div>
        <button onClick={() => setSignedIn(false)} className="text-sm border hairline px-4 py-2 shrink-0 font-semibold">Sign out</button>
      </div>

      <section className="mt-7 border hairline p-5 grain" style={{ background: "var(--color-surface)" }} aria-label="Photo storage">
        <div className="flex justify-between items-baseline gap-3">
          <h2 className="font-semibold">Photo storage</h2>
          <span className="font-mono2 text-sm font-bold">{cloudPct}% used</span>
        </div>
        <div className="h-1.5 mt-3 overflow-hidden" style={{ background: "color-mix(in srgb, var(--color-ink) 12%, transparent)" }}>
          <div className="h-full" style={{ width: cloudPct + "%", background: cloudPct >= 80 ? "var(--color-accent)" : "var(--color-accent2)" }} />
        </div>
        <p className="text-sm opacity-75 mt-2.5">{cloudPct >= 80 ? "You are near your photo limit. Delete old photos or upgrade your own Cloudinary plan to add more." : "Your own Cloudinary account. Text and price edits are unlimited. New uploads pause at the cap. Every photo you add is finished with the Claro realistic grade automatically, so it looks like food, not a snapshot."}</p>
      </section>

      <section className="mt-9" aria-label="Menu items">
        <h2 className="font-display uppercase text-2xl">Menu items</h2>
        <div className="mt-3 border-t hairline">
          {doc.items.map(item => {
            const av = availability.get(item.id);
            const sold = !!av?.soldOut;
            return (
              <article key={item.id} className="border-b hairline py-4">
                <div className="flex gap-3.5">
                  {item.photoUrl && /* eslint-disable-next-line @next/next/no-img-element */ <img src={item.photoUrl} alt="" className={"w-14 h-14 object-cover shrink-0 photo-grade " + (sold ? "grayscale" : "")} />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-bold leading-tight">{item.name}</h3>
                      <span className="font-mono2 text-[13px] shrink-0">{item.basePrice !== null ? formatPrice(item.basePrice, doc.venue.currency) : item.priceType === "market" ? formatPrice(item.todaysMarketPrice, doc.venue.currency) + " today" : "Set by options"}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                      <button role="switch" aria-checked={sold} aria-label={"Sold out toggle for " + item.name}
                        onClick={() => { const sel = document.getElementById("ret-" + item.id) as HTMLSelectElement | null; toggle86(item.id, (sel?.value as AutoReturnPreset) ?? "tomorrow"); }}
                        className="relative w-12 h-7 rounded-full shrink-0 transition-colors" style={{ background: sold ? "var(--color-accent)" : "color-mix(in srgb, var(--color-ink) 22%, transparent)" }}>
                        <span className="absolute top-1 w-5 h-5 rounded-full transition-all" style={{ left: sold ? "24px" : "4px", background: "var(--color-ink)" }} />
                      </button>
                      <span className="font-mono2 text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: sold ? "var(--color-accent)" : undefined }}>{sold ? "Sold out (86)" : "Available"}</span>
                      <select defaultValue={av?.autoReturn ?? "tomorrow"} id={"ret-" + item.id} aria-label="Auto return when sold out" className="border hairline px-2 py-1.5 text-sm ml-auto" style={{ background: "var(--color-surface)" }}>
                        <option value="end_of_service">Returns: end of service</option><option value="tomorrow">Returns: tomorrow</option><option value="indefinite">Returns: when I switch back</option><option value="custom">Returns: custom time</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="grid sm:grid-cols-[170px_1fr] gap-3 mt-3.5">
                  <label className="text-xs font-semibold uppercase tracking-wide opacity-90">Price ({doc.venue.currency})
                    <input inputMode="numeric" value={item.basePrice ?? ""} placeholder={item.priceType === "market" ? "Market price" : "No fixed price"} onChange={e => setPrice(item.id, e.target.value)} className={"mt-1.5 font-mono2 " + inputCls} />
                  </label>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide opacity-90">Photo URL
                      <input value={item.photoUrl ?? ""} onChange={e => setPhoto(item.id, e.target.value)} className={"mt-1.5 " + inputCls} />
                    </label>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <label className={"border hairline px-4 py-2 font-mono2 text-[11px] font-bold uppercase tracking-wider " + (uploadsConfigured && uploadingId !== item.id ? "cursor-pointer" : "opacity-50")} aria-disabled={!uploadsConfigured || uploadingId === item.id}>
                        {uploadingId === item.id ? "Uploading..." : "Upload photo"}
                        <input type="file" accept="image/*" className="hidden" disabled={!uploadsConfigured || uploadingId === item.id}
                          onChange={e => { uploadPhoto(item.id, e.target.files?.[0]); e.target.value = ""; }} />
                      </label>
                      {!uploadsConfigured && <span className="text-xs opacity-60 normal-case tracking-normal font-normal">Uploads switch on when the Cloudinary cloud name and unsigned preset are set.</span>}
                    </div>
                    {uploadError?.id === item.id && <p className="text-xs mt-2" style={{ color: "var(--color-accent)" }}>{uploadError.message}</p>}
                  </div>
                </div>
                {doc.specials.some(s => s.targetItemIds.includes(item.id)) && <p className="font-mono2 text-[10px] uppercase tracking-[0.16em] mt-3" style={{ color: "var(--color-accent2)" }}>On special: {doc.specials.filter(s => s.targetItemIds.includes(item.id)).map(s => s.name).join(", ")}</p>}
              </article>
            );
          })}
        </div>
        <p className="text-xs opacity-60 mt-3">Specials are scheduled price rules in the data model, not edited copies of an item. Schedules are managed in the full editor build.</p>
      </section>

      <section className="mt-10 border hairline p-5 grain" style={{ background: "var(--color-surface)" }} aria-label="QR code">
        <h2 className="font-display uppercase text-2xl">Your menu QR code</h2>
        <p className="text-sm opacity-80 mt-1.5">Free to download and print. It points at your own domain: <span className="font-mono2 text-[13px]">{menuUrl}</span></p>
        {qrPng && /* eslint-disable-next-line @next/next/no-img-element */ <img src={qrPng} alt={"QR code for " + menuUrl} className="w-44 h-44 mt-4 bg-white p-2" />}
        <div className="flex gap-2.5 mt-5 flex-wrap">
          {qrPng && <a href={qrPng} download="menu-qr.png" className="px-6 py-3 font-mono2 text-sm font-bold uppercase tracking-wider" style={{ background: "var(--color-accent)", color: "#0D0A07" }}>Download PNG</a>}
          {qrSvg && <button onClick={downloadSvg} className="px-6 py-3 border hairline font-mono2 text-sm font-bold uppercase tracking-wider">Download SVG</button>}
        </div>
        <p className="text-xs opacity-60 mt-3">PNG is print ready at table size.</p>
      </section>
    </main>
  );
}
