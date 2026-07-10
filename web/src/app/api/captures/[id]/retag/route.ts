import { NextResponse } from "next/server";
import { tagCapture } from "@/lib/tagging";

export async function POST(_req: Request, context: RouteContext<"/api/captures/[id]/retag">) {
  const { id } = await context.params;
  await tagCapture(id);
  return NextResponse.json({ ok: true });
}
