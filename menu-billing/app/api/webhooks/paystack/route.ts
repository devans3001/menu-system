import { createHmac, timingSafeEqual } from "node:crypto";
import { handlePaystackEvent } from "../../../../lib/event-map";
import { getRegistry } from "../../../../lib/registry";

// Paystack webhook receiver. Verifies HMAC-SHA512 on the RAW body before parsing.
// Env placeholders only: PAYSTACK_SECRET_KEY, DATABASE_URL. No real secrets in code.
export async function POST(req: Request) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return Response.json({ error: "PAYSTACK_SECRET_KEY not configured" }, { status: 500 });
  const raw = await req.text();
  const signature = req.headers.get("x-paystack-signature") ?? "";
  const expected = createHmac("sha512", secret).update(raw).digest("hex");
  const a = Buffer.from(signature); const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return Response.json({ error: "Invalid signature" }, { status: 401 });
  let payload: any;
  try { payload = JSON.parse(raw); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const result = await handlePaystackEvent(getRegistry(), String(payload?.event ?? ""), payload);
  return Response.json({ received: true, ...result }, { status: 200 });
}
