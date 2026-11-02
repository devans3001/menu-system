import { dataLayer } from "../../lib/data";
import { restaurantConfig } from "../../restaurant.config";
import AdminEditor from "../../components/AdminEditor";
export default async function AdminPage() {
  const doc = await dataLayer.getMenuDocument(restaurantConfig.slug);
  const billingState = await dataLayer.getRegistryState(restaurantConfig.slug).catch(() => "unknown");
  return <AdminEditor initialDoc={doc} billingState={billingState} />;
}
