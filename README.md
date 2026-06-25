# Link Gallery

Self-hosted image gallery for browsing, tagging, and copying image URLs or Markdown embeds. Not a photo album — an asset picker for Obsidian, wikis, or anywhere that takes image links.

|Interactive gallery|Image preview|
|---|---|
|<img width="500" height="932" alt="image" src="https://github.com/user-attachments/assets/8767842e-0736-4d03-a5b2-6667fbe80e07" />|<img width="393" height="851" alt="image" src="https://github.com/user-attachments/assets/051e3e3f-8bdb-448c-a913-dbba5849d0b6" />|

## Requirements

- **Docker** (or Bun 1.x if running bare-metal)
- A way to access the app on your network — pick one:
  - **LAN only**: Access directly via `http://your-server-ip:25053`
  - **Tailscale**: Access via your Tailscale IP, no auth needed (network is already private)
  - **Public internet**: Requires a reverse proxy + auth wall (Authelia, Authentik, Cloudflare Access, etc.)

**This app has no built-in authentication.** Anyone who can reach it can upload, delete, and tag. Either keep it on a private network or put an auth layer in front.

## Installation

### Docker (recommended)

```bash
git clone https://github.com/dredshep/link-gallery.git
cd link-gallery
cp docker-compose.example.yml docker-compose.yml
```

Edit `docker-compose.yml` — at minimum, set your URLs:

```yaml
environment:
  PUBLIC_IMAGE_BASE_URL: https://images.yourdomain.com/raw  # or leave empty
  TAILSCALE_IMAGE_BASE_URL: http://100.x.x.x:25053/raw     # your Tailscale IP
```

Then:

```bash
docker compose up --build -d
```

The app starts on port 25053 and creates `./data/originals`, `./data/thumbs`, and `./data/gallery.sqlite` automatically.

### Bare-metal (development)

```bash
bun install
cp .env.example .env.local   # edit URLs
bun run dev                   # http://localhost:25053
```

Requires Bun — the backend uses `bun:sqlite`, a Bun-only built-in that doesn't exist in Node.js.

## Network access

### Option A: LAN / Tailscale (simplest)

No reverse proxy needed. Access the app directly at `http://<ip>:25053`. If using Tailscale, your network is already authenticated — just use your Tailscale IP.

Set `DEFAULT_COPY_MODE=tailscale` so copied URLs use your Tailscale/LAN address.

### Option B: Public with auth (Caddy + Authelia example)

For public access you need two things: a reverse proxy and an authentication wall. The typical stack is Cloudflare Tunnel → Caddy → Authelia → app.

See `Caddyfile.example` for a working config with two hostnames:

- **`gallery.yourdomain.com`** — protected by forward auth, serves the full app
- **`images.yourdomain.com`** — public, only exposes `/raw/*` for shareable image links

The gallery container must be on the same Docker network as your Caddy container. Uncomment the `networks` section in `docker-compose.yml` and set it to your Caddy's network:

```yaml
networks:
  - caddy_net    # whatever your Caddy stack's network is called

# at the bottom:
networks:
  caddy_net:
    external: true
```

Then add the domain to your auth provider's allowed list, point your tunnel/DNS at Caddy, and restart both.

## Configuration

All settings via environment variables (in `docker-compose.yml` or `.env.local`):

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `25053` | Port the app listens on |
| `PUBLIC_IMAGE_BASE_URL` | — | Base URL for public image links (e.g. `https://images.example.com/raw`) |
| `TAILSCALE_IMAGE_BASE_URL` | — | Base URL for LAN/Tailscale links (e.g. `http://100.x.x.x:25053/raw`) |
| `DEFAULT_COPY_MODE` | `public` | Which URL type to copy by default (`public` or `tailscale`) |
| `DATA_DIR` | `/data` | Root data directory inside the container |
| `ORIGINALS_DIR` | `/data/originals` | Where uploaded originals are stored |
| `THUMBS_DIR` | `/data/thumbs` | Generated WebP thumbnails |
| `DB_PATH` | `/data/gallery.sqlite` | SQLite database file |
| `THUMB_SIZE` | `420` | Thumbnail dimension in px |
| `PAGE_SIZE` | `80` | Images per infinite-scroll page |

## Usage

**Upload**: Click the upload button or drag-drop files onto the page. Duplicates are detected by SHA-256.

**Browse**: Dense grid with infinite scroll. Filter by tag, search by filename, sort by newest/oldest/alphabetical. Images with shared tags are grouped together.

**Preview**: Click any image to open a full-screen preview with swipe navigation, drag-to-dismiss, and a thumbnail strip for same-tag images.

**Select**: Ctrl/Cmd+click on desktop, long-press on mobile. Shift+click for range. Paint mode for drag-select across tiles.

**Copy**: Select images → bottom bar → Copy URLs or Copy Markdown. Pastes directly into Obsidian or any markdown editor.

**Tag**: Select images → Tag → type a tag name. Tags are freeform text. Remove with the × button.

**Bulk import**: Drop files directly into the `originals` directory on disk, then hit the Rescan button (or `POST /api/rescan`).

## API

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/assets` | GET | Paginated asset list (search, tag filter, sort) |
| `/api/upload` | POST | Multipart upload (dedupes by SHA-256) |
| `/api/assets/tag` | POST | Add/remove/set tags |
| `/api/assets/delete` | POST | Permanently delete from disk and DB |
| `/api/tags` | GET | All tags with counts |
| `/api/rescan` | POST | Import files from originals directory |
| `/api/dedup` | POST | Remove duplicates by hash |
| `/api/config` | GET | Client-visible config |
| `/raw/[filename]` | GET | Serve original (DB-verified, no traversal) |
| `/thumb/[filename]` | GET | Serve thumbnail |

## Stack

Next.js 16 (App Router, standalone) · Bun · SQLite via `bun:sqlite` · sharp · Tailwind CSS v4 · TypeScript (strict)

## License

MIT — see [LICENSE.md](LICENSE.md).
