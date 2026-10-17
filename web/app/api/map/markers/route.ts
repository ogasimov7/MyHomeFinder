import type { NextRequest } from "next/server";
import { MAX_DATA_ZOOM, getMarkers, readBounds, readCategory } from "@/lib/map";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const bounds = readBounds(params);
  if (!bounds) return Response.json({ error: "bounds" }, { status: 400 });
  const zoom = Math.max(10, Math.min(MAX_DATA_ZOOM, Math.round(Number(params.get("z")) || 14)));
  try {
    return Response.json({ markers: await getMarkers(readCategory(params), bounds, zoom) });
  } catch {
    return Response.json({ error: "upstream" }, { status: 502 });
  }
}
