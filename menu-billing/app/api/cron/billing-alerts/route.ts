import { getRegistry } from "../../../../lib/registry";
import { runBillingAlertScan } from "../../../../lib/alerts-scan";

// Daily billing-alert scan, driven by Vercel Cron (see vercel.json in
// menu-billing: 08:00 UTC daily, which is 09:00 WAT). Vercel sends
// "Authorization: Bearer <CRON_SECRET>" automatically when the
// CRON_SECRET env var exists on the project; a manual run can use
// the same header or x-cron-secret. Without the env var the endpoint
// refuses to run, so the schedule can never scan unauthenticated.
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  const auth = req.headers.get("authorization") ?? "";
  const alt = req.headers.get("x-cron-secret") ?? "";
  if (auth !== `Bearer ${secret}` && alt !== secret) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const summary = await runBillingAlertScan(getRegistry());
  return Response.json({ ok: true, ...summary });
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
