import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { MenuDocument } from "../types";
import { seedMenu } from "./seed";
import { getBillingStateFromRegistry } from "../db/registry-status";

// Data layer interface. Local seed implementation needs no database.
// Neon implementation reads the shared registry: billing state always comes
// from the restaurants table (written by menu-billing), and the menu
// document comes from the menus jsonb row when one exists, falling back to
// the seed document until the editor's first save lands.
export interface MenuDataLayer {
  getMenuDocument(slug: string): Promise<MenuDocument>;
  saveMenuDocument(slug: string, doc: MenuDocument, updatedBy: string): Promise<MenuDocument>;
  getRegistryState(slug: string): Promise<string>;
}

class LocalSeedDataLayer implements MenuDataLayer {
  private doc: MenuDocument = structuredClone(seedMenu);
  async getMenuDocument(_slug: string): Promise<MenuDocument> { return structuredClone(this.doc); }
  async saveMenuDocument(_slug: string, doc: MenuDocument, _updatedBy?: string): Promise<MenuDocument> {
    this.doc = { ...structuredClone(doc), version: doc.version + 1, updatedAt: new Date().toISOString() };
    return structuredClone(this.doc);
  }
  async getRegistryState(_slug: string): Promise<string> {
    const { restaurantConfig } = await import("../../restaurant.config");
    return restaurantConfig.registryState;
  }
}

// Neon data layer: selected automatically when DATABASE_URL is set (or when
// MENU_DATA_SOURCE=neon). Billing state is registry-driven; the menu
// document falls back to the seed until a menus row exists for the slug.
class NeonDataLayer implements MenuDataLayer {
  private sql: NeonQueryFunction<false, false> | null = null;
  private db(): NeonQueryFunction<false, false> {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("Neon data layer selected but DATABASE_URL is not set. Set DATABASE_URL or unset MENU_DATA_SOURCE.");
    if (!this.sql) this.sql = neon(url);
    return this.sql;
  }
  async getMenuDocument(slug: string): Promise<MenuDocument> {
    const found = await this.db().query("SELECT menu FROM menus WHERE slug = $1", [slug]);
    const row = found[0] as { menu?: MenuDocument } | undefined;
    if (row?.menu) return structuredClone(row.menu);
    return structuredClone(seedMenu);
  }
  async saveMenuDocument(slug: string, doc: MenuDocument, updatedBy: string): Promise<MenuDocument> {
    const sql = this.db();
    const saved: MenuDocument = { ...structuredClone(doc), version: doc.version + 1, updatedAt: new Date().toISOString() };
    // menus.slug references restaurants(slug): make sure the row exists.
    await sql.query("INSERT INTO restaurants (slug) VALUES ($1) ON CONFLICT (slug) DO NOTHING", [slug]);
    await sql.query(
      `INSERT INTO menus (slug, menu, version, updated_by, updated_at)
       VALUES ($1, $2::jsonb, $3, $4, now())
       ON CONFLICT (slug) DO UPDATE SET menu = EXCLUDED.menu, version = EXCLUDED.version, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [slug, JSON.stringify(saved), saved.version, updatedBy],
    );
    return structuredClone(saved);
  }
  async getRegistryState(slug: string): Promise<string> {
    const state = await getBillingStateFromRegistry(slug);
    if (state) return state;
    const { restaurantConfig } = await import("../../restaurant.config");
    return restaurantConfig.registryState;
  }
}

export function getDataLayer(): MenuDataLayer {
  if (process.env.MENU_DATA_SOURCE === "neon" || process.env.DATABASE_URL) return new NeonDataLayer();
  if (process.env.MENU_DATA_SOURCE === "local") return new LocalSeedDataLayer();
  return new LocalSeedDataLayer();
}
export const dataLayer = getDataLayer();
