# TasteMap

A personal Chrome extension + web app that turns anything you save from around the web into an evolving, auto-tagged map of your taste.

Save an image with one click. A local CLIP model classifies its aesthetic (vaporwave, brutalism, cottagecore, glitch art, …) and drops it into a force-directed graph, clustered with everything else that shares its style.

Single-user by design — no accounts, no login. The extension and server just share one API key.

## Features

- **One-click capture** — save any image from any page via the extension popup
- **Automatic style tagging** — zero-shot CLIP classification against an 80+ label aesthetic vocabulary, running locally (no LLM calls, no external API costs)
- **Living taste graph** — nodes cluster by category, cluster labels render inline, click a node to zoom in and inspect it
- **Timeline view** — flat chronological grid of everything you've saved
- **Delete / retag** — remove captures or fix a bad classification straight from the UI

## Tech stack

| Layer          | Tech                                                              |
| -------------- | ------------------------------------------------------------------ |
| Web app        | Next.js 16, React 19, Tailwind CSS 4                              |
| Graph / motion | `react-force-graph-2d`, `d3-force-3d`, GSAP                       |
| Classification | `@xenova/transformers` (CLIP ViT-B/32, zero-shot image classification) |
| Extension      | Chrome MV3, TypeScript, esbuild                                   |
| Data           | Supabase (Postgres + pgvector + Storage)                          |

## Project structure

```
tastemap/
├── web/                     Next.js app
│   ├── src/app/map/         Force-directed graph view
│   ├── src/app/captures/    Timeline grid view
│   ├── src/app/api/         Ingest, graph, retag, delete endpoints
│   └── src/lib/             CLIP classifier, style label vocabulary, tagging pipeline
├── extension/                Chrome MV3 extension (popup capture)
└── supabase/migrations/      Schema: captures table, pgvector, storage bucket
```

## Setup

### 1. Supabase project

Create a project at [supabase.com](https://supabase.com), then run the migrations **in order** in the SQL Editor:

1. `supabase/migrations/0001_init.sql`
2. `supabase/migrations/0002_drop_auth.sql`

### 2. Web app

```bash
cd web
cp .env.local.example .env.local   # fill in Supabase keys, pick a TASTEMAP_API_KEY
npm install
npm run dev
```

Environment variables:

| Variable                     | Where to get it                                                        |
| ---------------------------- | ----------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`   | Supabase project settings                                              |
| `SUPABASE_SERVICE_ROLE_KEY`  | Supabase project settings                                              |
| `TASTEMAP_API_KEY`           | Any random string (e.g. `openssl rand -hex 24`) — the extension sends this on every save |

### 3. Extension

```bash
cd extension
npm install
npm run build
```

In Chrome: `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select `extension/dist`. Click the extension icon once and paste in the same `TASTEMAP_API_KEY` from `.env.local`.

### 4. Use it

- Click the extension icon on any page to save it
- `http://localhost:3000/map` — the taste graph
- `http://localhost:3000/captures` — timeline grid

While developing the extension, `npm run watch` (in `extension/`) rebuilds on save. Reload the extension in `chrome://extensions` after each change.
