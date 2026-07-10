import { createServiceRoleClient } from "@/lib/supabase/server";
import { classifyImage } from "@/lib/clip";

export async function tagCapture(captureId: string) {
  const supabase = createServiceRoleClient();

  try {
    const { data: capture, error } = await supabase
      .from("captures")
      .select("screenshot_path")
      .eq("id", captureId)
      .single();

    if (error || !capture) throw new Error(`capture ${captureId} not found`);
    if (!capture.screenshot_path) throw new Error("no screenshot to classify");

    const { data: signed } = await supabase.storage
      .from("captures")
      .createSignedUrl(capture.screenshot_path, 60);
    if (!signed?.signedUrl) throw new Error("could not sign screenshot url");

    const imageResp = await fetch(signed.signedUrl);
    const imageBuffer = Buffer.from(await imageResp.arrayBuffer());

    const { tags, category, scores } = await classifyImage(imageBuffer);

    await supabase
      .from("captures")
      .update({
        tags,
        category,
        style_scores: scores,
        status: "tagged",
      })
      .eq("id", captureId);
  } catch (err) {
    console.error(`tagCapture(${captureId}) failed, marking untagged`, err);
    await supabase.from("captures").update({ status: "untagged" }).eq("id", captureId);
  }
}
