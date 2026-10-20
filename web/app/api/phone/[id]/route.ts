import { connection } from "next/server";
import { TIMEOUT_MS, USER_AGENT } from "@/lib/http";

/* A seller's phone, asked of bina.az only when a visitor presses call or
   WhatsApp on that one listing — the same request bina.az's own "show the
   number" button makes. Nothing is cached or kept here: the number is
   passed through and forgotten. */
export async function GET(_request: Request, { params }: RouteContext<"/api/phone/[id]">) {
  await connection();
  const { id } = await params;
  if (!/^\d{1,12}$/.test(id)) return Response.json({ error: "id" }, { status: 400 });
  try {
    const res = await fetch(`https://bina.az/items/${id}/phones`, {
      headers: { "user-agent": USER_AGENT, accept: "application/json", "x-requested-with": "XMLHttpRequest" },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return Response.json({ error: "upstream" }, { status: res.status === 404 ? 404 : 502 });
    const { phones } = (await res.json()) as { phones?: string[] };
    return Response.json({ phones: (phones ?? []).filter(Boolean) }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "upstream" }, { status: 502 });
  }
}
