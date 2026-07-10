# TasteMap

Personal Chrome extension + web app that turns anything you save from around the web into an evolving, auto-tagged taste map. Single-user — no login, just a shared API key between the extension and your local server.

## Structure

- `web/` — Next.js app (dashboard, graph view, ingest API, LLM tagging)
- `extension/` — Chrome MV3 extension (popup capture)
- `supabase/migrations/` — schema (captures table, pgvector, storage bucket)

## Setup

### 1. Supabase project

Create a project at supabase.com, then paste `supabase/migrations/0001_init.sql` and `0002_drop_auth.sql` (in order) into the SQL Editor and run them.

### 2. Web app

```
cd web
cp .env.local.example .env.local   # fill in Supabase + Anthropic keys, pick a TASTEMAP_API_KEY
npm install
npm run dev
```

Env vars needed:
- `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — Supabase project settings
- `ANTHROPIC_API_KEY` — for auto-tagging
- `TASTEMAP_API_KEY` — any random string; the extension sends this on every save (e.g. `openssl rand -hex 24`)

### 3. Extension

```
cd extension
npm install
npm run build
```

In Chrome: `chrome://extensions` → enable Developer mode → **Load unpacked** → select `extension/dist`. Click the extension icon once, paste in the same `TASTEMAP_API_KEY` from `.env.local`.

### 4. Use it

Click the extension icon on any page to save it. Visit `http://localhost:3000/map` for the graph view, `/captures` for a timeline grid.

`npm run watch` in `extension/` rebuilds on save; reload the extension in `chrome://extensions` after changes.
