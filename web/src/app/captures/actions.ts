"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function deleteCapture(id: string) {
  const supabase = createServiceRoleClient();

  const { data: capture } = await supabase
    .from("captures")
    .select("screenshot_path")
    .eq("id", id)
    .single();

  if (capture?.screenshot_path) {
    await supabase.storage.from("captures").remove([capture.screenshot_path]);
  }

  await supabase.from("captures").delete().eq("id", id);

  revalidatePath("/captures");
}

export async function setTags(id: string, tagsInput: string) {
  const supabase = createServiceRoleClient();

  const tags = tagsInput
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  await supabase
    .from("captures")
    .update({ tags, status: tags.length > 0 ? "tagged" : "untagged" })
    .eq("id", id);

  revalidatePath("/captures");
  revalidatePath("/map");
}
