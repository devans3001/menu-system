import { dataLayer } from "../lib/data";
import { restaurantConfig } from "../restaurant.config";
import MenuShell from "../components/MenuShell";
import HoldingPage from "../components/HoldingPage";

// Billing state can change the moment a webhook lands, so the guest page is
// rendered per request, never baked at build time. With DATABASE_URL set the
// state comes from the Neon registry (written by menu-billing); without it,
// the seed/demo state in restaurant.config.ts drives the page.
export const dynamic = "force-dynamic";

export default async function Page() {
  const state = await dataLayer.getRegistryState(restaurantConfig.slug);
  if (state === "paused" || state === "churned") return <HoldingPage name={restaurantConfig.displayName} />;
  const doc = await dataLayer.getMenuDocument(restaurantConfig.slug);
  return <MenuShell doc={doc} />;
}
