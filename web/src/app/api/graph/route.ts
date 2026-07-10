import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServiceRoleClient();

  const { data: captures, error } = await supabase
    .from("captures")
    .select(
      "id, url, title, domain, screenshot_path, tags, category, mood, summary, style_scores, created_at, status"
    )
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const signedUrls = await Promise.all(
    captures.map((c) =>
      c.screenshot_path
        ? supabase.storage.from("captures").createSignedUrl(c.screenshot_path, 3600)
        : Promise.resolve({ data: null })
    )
  );

  const nodes = captures.map((c, i) => ({
    id: c.id,
    url: c.url,
    title: c.title ?? c.domain,
    domain: c.domain,
    imageUrl: signedUrls[i].data?.signedUrl ?? null,
    tags: c.tags ?? [],
    category: c.category,
    mood: c.mood,
    summary: c.summary,
    createdAt: c.created_at,
    status: c.status,
  }));

  // Only link nodes within the same top-level style category, so clusters stay
  // visually distinct instead of bridging into one connected blob via incidental
  // shared secondary tags.
  const links: { source: string; target: string; weight: number }[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];

      if (!a.category || a.category !== b.category) continue;

      const sharedTags = a.tags.filter((t: string) => b.tags.includes(t)).length;
      links.push({ source: a.id, target: b.id, weight: 3 + sharedTags });
    }
  }

  return NextResponse.json({ nodes, links });
}
