import { dataLayer } from "../../lib/data";
import { restaurantConfig } from "../../restaurant.config";
import AdminEditor from "../../components/AdminEditor";
export default async function AdminPage() {
  const doc = await dataLayer.getMenuDocument(restaurantConfig.slug);
  return <AdminEditor initialDoc={doc} />;
}
