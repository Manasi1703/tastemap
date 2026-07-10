import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { tagCapture } from "@/lib/tagging";

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey || apiKey !== process.env.TASTEMAP_API_KEY) {
    return NextResponse.json({ error: "invalid api key" }, { status: 401 });
  }

  const body = await req.json();
  const { url, title, domain, note, screenshotBase64 } = body as {
    url: string;
    title?: string;
    domain?: string;
    note?: string;
    screenshotBase64?: string;
  };

  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  let screenshotPath: string | null = null;
  if (screenshotBase64) {
    const buffer = Buffer.from(screenshotBase64.split(",").pop() ?? "", "base64");
    screenshotPath = `saves/${crypto.randomUUID()}.png`;
    const { error: uploadError } = await supabase.storage
      .from("captures")
      .upload(screenshotPath, buffer, { contentType: "image/png" });
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }
  }

  const { data: capture, error: insertError } = await supabase
    .from("captures")
    .insert({
      url,
      title: title ?? null,
      domain: domain ?? new URL(url).hostname,
      note: note ?? null,
      screenshot_path: screenshotPath,
      status: "pending",
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Fire-and-forget tagging; don't block the extension's save UX on Claude latency.
  tagCapture(capture.id).catch((err) => console.error("tagCapture failed", err));

  return NextResponse.json({ capture }, { status: 201 });
}
