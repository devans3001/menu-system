import { dataLayer } from "../../lib/data";
import { restaurantConfig } from "../../restaurant.config";
import AdminEditor from "../../components/AdminEditor";

// The editor's billing chip must follow the registry (live, grace,
// paused) the moment a webhook changes it, so this page renders per
// request like the guest page. Without this it prerenders at build
// time and the chip freezes at the build-time state (found Nov 3,
// 2026, when a grace flip never reached the editor).
export const dynamic = "force-dynamic";
export default async function AdminPage() {
  const doc = await dataLayer.getMenuDocument(restaurantConfig.slug);
  const billingState = await dataLayer.getRegistryState(restaurantConfig.slug).catch(() => "unknown");
  return <AdminEditor initialDoc={doc} billingState={billingState} />;
}
