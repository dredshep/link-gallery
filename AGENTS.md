<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Agent Guide

## Critical runtime constraint

The database uses `bun:sqlite` — a **Bun-only built-in**. It does not exist in Node.js.

- `bun run dev` runs `bun --bun next dev` to force Bun's runtime for server-side code. Without `--bun`, all API routes crash with `Cannot find module 'bun:sqlite'`.
- `next.config.ts` has `serverExternalPackages: ["bun:sqlite"]` so the bundler leaves it alone.
- `@types/bun` provides type declarations.
- The Dockerfile uses `oven/bun:1` — production also runs on Bun.

**Never** replace `bun:sqlite` with `better-sqlite3`, `sqlite3`, or Drizzle. It's a deliberate design choice.

## Project structure

```
app/                    # Next.js App Router
  api/                  # Route handlers (all server-side, use bun:sqlite)
    assets/route.ts     # GET paginated assets
    assets/tag/route.ts # POST tag operations
    assets/delete/      # POST permanent deletion
    upload/route.ts     # POST multipart upload
    tags/route.ts       # GET all tags
    rescan/route.ts     # POST scan originals dir
    dedup/route.ts      # POST remove duplicates
    config/route.ts     # GET client config
  raw/[filename]/       # Serve originals (DB-verified)
  thumb/[filename]/     # Serve thumbnails
  page.tsx              # Renders <Gallery />
  layout.tsx            # Root layout (dark theme)

components/             # Client components ("use client")
  Gallery.tsx           # Main orchestrator — state, selection, infinite scroll
  ImageTile.tsx         # Single tile — pointer events, long-press, paint select
  TopBar.tsx            # Search, filters, toggles, auto-hide on scroll
  BottomBar.tsx         # Action bar when images are selected
  PreviewModal.tsx      # Full image view with nav, swipe, keyboard
  UploadModal.tsx       # File upload with drag-drop and duplicate detection
  TagModal.tsx          # Tag input for selected images
  DeleteModal.tsx       # Two-step delete confirmation

lib/                    # Shared modules
  db.ts                 # SQLite singleton, schema, all queries
  config.ts             # Env-based config object
  files.ts              # File helpers (sanitize, hash, thumbnail, path safety)
  types.ts              # Shared TypeScript interfaces
  clipboard.ts          # Clipboard with execCommand fallback for non-HTTPS
```

## Key patterns

**Route handler params are async** (Next.js 16):
```ts
export async function GET(_req: Request, ctx: { params: Promise<{ filename: string }> }) {
  const { filename } = await ctx.params;
}
```

**Database is a lazy singleton** — `getDb()` in `lib/db.ts`. Schema runs on first call. All SQL is explicit prepared statements, no ORM.

**Selection state** lives in `Gallery.tsx` as `Set<string>` of asset IDs. Three input paths: click/ctrl+click (desktop), long-press (touch), paint mode (drag). Long-press auto-enables paint mode.

**Clipboard** uses `navigator.clipboard` on HTTPS, falls back to `document.execCommand("copy")` on HTTP (e.g. LAN IP access). See `lib/clipboard.ts`.

**Image serving** (`/raw/`, `/thumb/`) verifies filenames against the database and rejects path traversal. These are the only routes safe to expose publicly.

## When editing

- Run `bun run lint` after changes — React 19 has a strict `react-hooks/set-state-in-effect` rule. Don't call `setState` directly inside `useEffect` bodies; use refs or derive state from existing values.
- No `any`, no `unknown` casts. TypeScript strict mode is enforced.
- Thumbnails are always `.webp` regardless of the original format.
- Uploaded files are renamed to `{uuid}-{sanitized-original}.{ext}`. Display names strip the UUID prefix.
- The `.env.local` and `docker-compose.yml` are gitignored — they contain real hostnames and IPs. Use `.env.example` and `docker-compose.example.yml` as templates.
