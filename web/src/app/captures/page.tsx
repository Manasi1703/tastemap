import { createServiceRoleClient } from "@/lib/supabase/server";
import { deleteCapture, setTags } from "./actions";

export default async function CapturesPage() {
  const supabase = createServiceRoleClient();

  const { data: captures } = await supabase
    .from("captures")
    .select("id, url, title, domain, tags, category, mood, created_at, status")
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-black text-white">
      <header className="flex items-center justify-between px-8 py-6">
        <h1 className="text-lg font-light tracking-tight">TasteMap</h1>
        <a href="/map" className="text-sm text-white/50 hover:text-white">
          Graph view
        </a>
      </header>

      <div className="grid grid-cols-2 gap-4 px-8 pb-12 sm:grid-cols-3 lg:grid-cols-4">
        {(captures ?? []).map((c) => (
          <div
            key={c.id}
            className="group relative rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-white/25"
          >
            <form
              action={async () => {
                "use server";
                await deleteCapture(c.id);
              }}
              className="absolute right-2 top-2 opacity-0 transition group-hover:opacity-100"
            >
              <button
                type="submit"
                aria-label="Delete"
                className="flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs text-white/60 hover:text-white"
              >
                ✕
              </button>
            </form>

            <a href={c.url} target="_blank" rel="noreferrer">
              <p className="truncate pr-6 text-sm font-medium">{c.title ?? c.domain}</p>
              <p className="mt-0.5 truncate text-xs text-white/40">{c.domain}</p>
              {c.tags?.length ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {c.tags.slice(0, 3).map((t: string) => (
                    <span
                      key={t}
                      className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/60"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-[11px] text-white/25">
                  {c.status === "pending" ? "tagging…" : "untagged"}
                </p>
              )}
            </a>

            <form
              action={async (formData: FormData) => {
                "use server";
                await setTags(c.id, String(formData.get("tags") ?? ""));
              }}
              className="mt-3 flex gap-1.5"
            >
              <input
                name="tags"
                defaultValue={(c.tags ?? []).join(", ")}
                placeholder="tags, comma, separated"
                className="w-full rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-[11px] text-white/70 outline-none focus:border-white/30"
              />
              <button
                type="submit"
                className="shrink-0 rounded-full border border-white/15 px-2.5 py-1 text-[11px] text-white/60 hover:bg-white/5"
              >
                Save
              </button>
            </form>
          </div>
        ))}
        {(captures ?? []).length === 0 && (
          <p className="col-span-full py-20 text-center text-white/40">Nothing saved yet.</p>
        )}
      </div>
    </main>
  );
}
