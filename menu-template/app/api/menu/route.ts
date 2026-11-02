import { NextResponse } from "next/server";
import { dataLayer } from "../../../lib/data";
import { restaurantConfig } from "../../../restaurant.config";
// Menu read/write API. Production writes go to the Neon menus row.
// Local demo reads and writes the in-memory seed layer.
export async function GET() {
  const doc = await dataLayer.getMenuDocument(restaurantConfig.slug);
  return NextResponse.json(doc);
}
export async function PUT(req: Request) {
  const body = await req.json();
  const saved = await dataLayer.saveMenuDocument(restaurantConfig.slug, body, "owner-demo");
  return NextResponse.json(saved);
}
