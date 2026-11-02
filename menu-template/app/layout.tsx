import type { Metadata } from "next";
import { Anton, Cormorant_Garamond, Manrope, Space_Mono } from "next/font/google";
import "./globals.css";
import { restaurantConfig } from "../restaurant.config";
import { skinStyle } from "../lib/engine/skin";

const anton = Anton({ weight: "400", subsets: ["latin"], variable: "--f-display", display: "swap" });
const cormorant = Cormorant_Garamond({ weight: ["500", "600"], style: ["italic", "normal"], subsets: ["latin"], variable: "--f-serif", display: "swap" });
const manrope = Manrope({ weight: ["400", "600", "700", "800"], subsets: ["latin"], variable: "--f-body", display: "swap" });
const spaceMono = Space_Mono({ weight: ["400", "700"], subsets: ["latin"], variable: "--f-mono", display: "swap" });

export const metadata: Metadata = { title: restaurantConfig.displayName + " Menu", description: restaurantConfig.skin.spine };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fontVars = [anton.variable, cormorant.variable, manrope.variable, spaceMono.variable].join(" ");
  return (
    <html lang="en" className={fontVars}>
      <body style={skinStyle(restaurantConfig)}>{children}</body>
    </html>
  );
}
