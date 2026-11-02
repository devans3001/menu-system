export async function GET() { return Response.json({ ok: true, service: "menu-billing", time: new Date().toISOString() }); }
