export const config = {
  dataDir: process.env.DATA_DIR ?? "/data",
  originalsDir: process.env.ORIGINALS_DIR ?? "/data/originals",
  thumbsDir: process.env.THUMBS_DIR ?? "/data/thumbs",
  dbPath: process.env.DB_PATH ?? "/data/gallery.sqlite",
  publicImageBaseUrl: process.env.PUBLIC_IMAGE_BASE_URL ?? "http://localhost:3000/raw",
  tailscaleImageBaseUrl: process.env.TAILSCALE_IMAGE_BASE_URL ?? "http://localhost:3000/raw",
  defaultCopyMode: (process.env.DEFAULT_COPY_MODE ?? "public") as "public" | "tailscale",
  thumbSize: Number(process.env.THUMB_SIZE) || 420,
  pageSize: Number(process.env.PAGE_SIZE) || 80,
} as const;
