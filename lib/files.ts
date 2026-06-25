import { createHash } from "crypto";
import { readFile, mkdir } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { config } from "./config";

const ALLOWED_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
]);

const ALLOWED_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif",
]);

export function isAllowedImageMime(mime: string): boolean {
  return ALLOWED_MIMES.has(mime);
}

export function isAllowedImageExtension(ext: string): boolean {
  return ALLOWED_EXTENSIONS.has(ext.toLowerCase());
}

export function sanitizeFilename(name: string): string {
  const ext = path.extname(name).toLowerCase();
  const base = path.basename(name, path.extname(name));

  const sanitized = base
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return sanitized + ext;
}

export async function hashFile(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  return createHash("sha256").update(buffer).digest("hex");
}

export async function hashBuffer(buffer: Buffer): Promise<string> {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

export function safeJoin(baseDir: string, filename: string): string | null {
  const resolved = path.resolve(baseDir, filename);
  if (!resolved.startsWith(path.resolve(baseDir) + path.sep) && resolved !== path.resolve(baseDir)) {
    return null;
  }
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return null;
  }
  return path.join(baseDir, filename);
}

export function normalizeTag(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/^#/, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function createThumbnail(
  originalPath: string,
  thumbPath: string
): Promise<void> {
  await sharp(originalPath)
    .resize(config.thumbSize, config.thumbSize, {
      fit: "cover",
      position: "centre",
    })
    .webp({ quality: 80 })
    .toFile(thumbPath);
}

export function mimeFromExtension(ext: string): string {
  const map: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".avif": "image/avif",
  };
  return map[ext.toLowerCase()] ?? "application/octet-stream";
}

export function isUuidPrefixed(filename: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/.test(filename);
}
