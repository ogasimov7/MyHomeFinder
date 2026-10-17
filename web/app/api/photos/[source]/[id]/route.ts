import { getDetail } from "@/lib/detail";

/* A card's photos, fetched when the card comes into view so they can be
   flicked through without opening the listing. The listing page reads the
   same cached detail, so opening it afterwards costs nothing more. */
export async function GET(_request: Request, { params }: RouteContext<"/api/photos/[source]/[id]">) {
  const { source, id } = await params;
  if ((source !== "bina" && source !== "kub") || !/^\d{1,12}$/.test(id)) {
    return Response.json({ error: "id" }, { status: 400 });
  }
  try {
    const detail = await getDetail(source, id);
    if (!detail) return Response.json({ error: "missing" }, { status: 404 });
    return Response.json(
      { photos: detail.photos.map((p) => p.medium) },
      { headers: { "cache-control": "public, max-age=3600, s-maxage=3600" } },
    );
  } catch {
    return Response.json({ error: "upstream" }, { status: 502 });
  }
}
