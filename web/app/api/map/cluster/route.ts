import type { NextRequest } from "next/server";
import { getCluster, readCategory } from "@/lib/map";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const id = params.get("id") ?? "";
  // bina.az cluster ids are tile addresses: "19/334741/197760"
  if (!/^\d{1,2}\/\d{1,7}\/\d{1,7}$/.test(id)) return Response.json({ error: "params" }, { status: 400 });
  try {
    return Response.json(await getCluster(readCategory(params), id));
  } catch {
    return Response.json({ error: "upstream" }, { status: 502 });
  }
}
