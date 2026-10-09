import { automationMode, qualifyLead } from "@/lib/automation";

export async function GET() {
  return Response.json({ mode: automationMode() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { lead?: unknown } | null;
  if (typeof body?.lead !== "string" || !body.lead.trim()) {
    return Response.json({ error: "Please paste a lead first." }, { status: 400 });
  }
  try {
    return Response.json(await qualifyLead({ lead: body.lead }));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Automation failed.";
    return Response.json({ error: message }, { status: 502 });
  }
}
