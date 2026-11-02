import type { RestaurantConfig } from "../../restaurant.config";
// Palette tokens become CSS variables. Type is loaded once in the root
// layout via next/font and mapped in globals.css (.font-display,
// .font-serif2, body, .font-mono2), so the skin only carries colour.
export function skinCssVars(config: RestaurantConfig): Record<string, string> {
  const p = config.skin.palette;
  return {
    "--color-bg": p.bg, "--color-surface": p.surface, "--color-ink": p.ink,
    "--color-accent": p.accent, "--color-accent2": p.accent2,
  } as Record<string, string>;
}
export function skinStyle(config: RestaurantConfig): React.CSSProperties {
  return skinCssVars(config) as React.CSSProperties;
}
