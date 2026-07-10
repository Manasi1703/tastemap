import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function DELETE(_req: NextRequest, context: RouteContext<"/api/captures/[id]">) {
  const { id } = await context.params;
  const supabase = createServiceRoleClient();

  const { data: capture } = await supabase
    .from("captures")
    .select("screenshot_path")
    .eq("id", id)
    .single();

  if (capture?.screenshot_path) {
    await supabase.storage.from("captures").remove([capture.screenshot_path]);
  }

  const { error } = await supabase.from("captures").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
