"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { restaurantConfig } from "../../restaurant.config";
import { SectionTitle } from "./shared";

// QR and links: the guest address, print-ready downloads, and the exact
// link text to paste into the Instagram bio and the Google profile.
export default function QrSection() {
  const menuUrl = "https://" + restaurantConfig.domain.primary + "/";
  const [qrPng, setQrPng] = useState("");
  const [qrSvg, setQrSvg] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    QRCode.toDataURL(menuUrl, { width: 1024, margin: 2 }).then(setQrPng).catch(() => {});
    QRCode.toString(menuUrl, { type: "svg" }).then(setQrSvg).catch(() => {});
  }, [menuUrl]);

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(""), 2200);
    } catch {
      setCopied("");
    }
  }

  function downloadSvg() {
    const blob = new Blob([qrSvg], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "menu-qr.svg";
    a.click();
  }

  const linkRows: { label: string; help: string; text: string }[] = [
    { label: "Your menu link", help: "The one address for everything. It always opens the menu that matches the time of day.", text: menuUrl },
    { label: "Instagram bio", help: "Paste this as the link in your Instagram bio, under a line like: See the menu and order.", text: menuUrl },
    { label: "Google profile", help: "Add it as the menu link on your Google Business Profile so searchers land on the real menu.", text: menuUrl },
  ];

  return (
    <div>
      <SectionTitle eyebrow="Put it everywhere" title="QR and links" />

      <section className="mt-7 border hairline p-5 grain" style={{ background: "var(--color-surface)" }} aria-label="QR code">
        <div className="relative z-[2]">
          <h3 className="font-display uppercase text-2xl">Your menu QR code</h3>
          <p className="text-[15px] opacity-80 mt-1.5 leading-relaxed">Free to download and print, as many as you like. It points at your own domain: <span className="font-mono2 text-[13px]">{menuUrl}</span></p>
          {qrPng && /* eslint-disable-next-line @next/next/no-img-element */ <img src={qrPng} alt={"QR code for " + menuUrl} className="w-44 h-44 mt-4 bg-white p-2" />}
          <div className="flex gap-2.5 mt-5 flex-wrap">
            {qrPng && <a href={qrPng} download="menu-qr.png" className="px-5 py-3 font-mono2 text-[13px] font-bold uppercase tracking-wider" style={{ background: "var(--color-accent)", color: "#0D0A07" }}>Download PNG</a>}
            {qrSvg && <button type="button" onClick={downloadSvg} className="px-5 py-3 border hairline font-mono2 text-[13px] font-bold uppercase tracking-wider">Download SVG</button>}
          </div>
          <p className="text-[13px] opacity-60 mt-4 leading-relaxed">
            Table tent hint: print the PNG at business card size or larger, stand it on every table with the words
            "Scan to see the menu". Test one print with your own phone before the full run: it should open your menu in one tap.
          </p>
        </div>
      </section>

      <div className="mt-8 grid gap-5">
        {linkRows.map(row => (
          <div key={row.label} className="border-b hairline pb-5">
            <h3 className="font-semibold text-[15px]">{row.label}</h3>
            <p className="text-[13px] opacity-60 mt-1">{row.help}</p>
            <div className="flex gap-2.5 mt-3 flex-wrap">
              <code className="font-mono2 text-[13px] border hairline px-3 py-2.5 break-all" style={{ background: "var(--color-surface)" }}>{row.text}</code>
              <button type="button" onClick={() => copy(row.text, row.label)} className="px-4 py-2.5 border hairline font-mono2 text-[13px] font-bold uppercase tracking-wider">
                {copied === row.label ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
