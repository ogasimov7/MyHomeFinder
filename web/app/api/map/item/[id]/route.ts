import { getPreview } from "@/lib/map";

export async function GET(_request: Request, { params }: RouteContext<"/api/map/item/[id]">) {
  const { id } = await params;
  if (!/^\d{1,12}$/.test(id)) return Response.json({ error: "id" }, { status: 400 });
  try {
    const item = await getPreview(id);
    return item ? Response.json({ item }) : Response.json({ error: "missing" }, { status: 404 });
  } catch {
    return Response.json({ error: "upstream" }, { status: 502 });
  }
}
