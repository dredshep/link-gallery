# Link Gallery

Self-hosted image gallery designed for browsing, tagging, and copying image URLs or Markdown embeds into Obsidian (or anywhere else). Not a photo album — an asset picker.

## What it does

Upload images. Browse a dense grid. Tag them. Select many. Copy their URLs as raw links or `![markdown](embeds)`. Paste into Obsidian. That's the workflow.

<img width="500" height="932" alt="image" src="https://github.com/user-attachments/assets/8767842e-0736-4d03-a5b2-6667fbe80e07" /><img width="393" height="851" alt="image" src="https://github.com/user-attachments/assets/051e3e3f-8bdb-448c-a913-dbba5849d0b6" />



## Stack

- **Next.js 16** (App Router, standalone output)
- **Bun** (runtime, package manager, built-in SQLite)
- **SQLite** via `bun:sqlite` (no ORM, no Prisma, no better-sqlite3)
- **sharp** for thumbnail generation
- **Tailwind CSS v4**
- **TypeScript** (strict, no `any`)

## Quick start

```bash
bun install
cp .env.example .env.local   # edit URLs to match your setup
bun run dev                   # starts on http://localhost:3000
```

The dev server requires Bun — `bun:sqlite` is a Bun-only API. The `dev` script uses `bun --bun next dev` to ensure Bun's runtime is used for server-side code.

## Docker

```bash
cp docker-compose.example.yml docker-compose.yml
# edit docker-compose.yml with your domains, volume paths, ports
docker compose up --build -d
```

The app creates `/data/originals`, `/data/thumbs`, and `/data/gallery.sqlite` on first start.

## Configuration

All config is via environment variables (see `.env.example`):

| Variable | Purpose |
|---|---|
| `DATA_DIR` | Root data directory |
| `ORIGINALS_DIR` | Where uploaded originals are stored |
| `THUMBS_DIR` | Where generated thumbnails are stored |
| `DB_PATH` | SQLite database file path |
| `PUBLIC_IMAGE_BASE_URL` | Base URL for copied public image links |
| `TAILSCALE_IMAGE_BASE_URL` | Base URL for copied Tailscale/LAN links |
| `DEFAULT_COPY_MODE` | `public` or `tailscale` |
| `THUMB_SIZE` | Thumbnail dimension in pixels (default: 420) |
| `PAGE_SIZE` | Images per infinite scroll page (default: 80) |

## Selection & interaction

**Desktop:** Click to open preview. Ctrl/Cmd+click to select. Shift+click for range select. Paint mode for drag-select.

**Mobile/tablet:** Tap to open preview. Long-press to select (auto-enables paint mode). Long-press + drag to multi-select across tiles.

**When images are selected:** a bottom action bar appears with Copy MD, Copy URLs, Tag, Delete, and Clear.

## Reverse proxy

See `Caddyfile.example` for a Caddy setup with two hostnames:
- `gallery.example.com` — protected by Authelia, serves the full app
- `images.example.com` — public, only exposes `/raw/*` (image files)

The app itself has no auth. Protect it with Authelia, Authentik, or whatever you use.

## API

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/assets` | GET | Paginated asset list with search, tag filter, sort |
| `/api/upload` | POST | Multipart image upload (dedupes by sha256) |
| `/api/assets/tag` | POST | Add/remove/set tags on selected assets |
| `/api/assets/delete` | POST | Permanently delete assets from disk and DB |
| `/api/tags` | GET | All tags with counts |
| `/api/rescan` | POST | Import files manually dropped into originals dir |
| `/api/dedup` | POST | Remove duplicate assets by sha256 |
| `/api/config` | GET | Client-visible config (base URLs, copy mode) |
| `/raw/[filename]` | GET | Serve original image (DB-verified, no directory listing) |
| `/thumb/[filename]` | GET | Serve thumbnail |

## License

MIT — see [LICENSE.md](LICENSE.md).
