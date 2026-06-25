import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import path from "path";
import { readdir, stat, rename } from "fs/promises";
import sharp from "sharp";
import { config } from "@/lib/config";
import { getDb, insertAsset, getAssetBySha256 } from "@/lib/db";
import {
  isAllowedImageExtension,
  sanitizeFilename,
  hashFile,
  ensureDir,
  createThumbnail,
  mimeFromExtension,
  isUuidPrefixed,
} from "@/lib/files";

export async function POST() {
  await ensureDir(config.originalsDir);
  await ensureDir(config.thumbsDir);

  const db = getDb();
  let imported = 0;
  let skipped = 0;
  const errors: Array<{ filename: string; error: string }> = [];

  let entries: string[];
  try {
    entries = await readdir(config.originalsDir);
  } catch {
    return NextResponse.json({ imported: 0, skipped: 0, errors: [{ filename: "", error: "Cannot read originals directory" }] });
  }

  for (const filename of entries) {
    try {
      const ext = path.extname(filename).toLowerCase();
      if (!isAllowedImageExtension(ext)) {
        skipped++;
        continue;
      }

      const existing = db.query("SELECT id FROM assets WHERE stored_filename = ?").get(filename);
      if (existing) {
        skipped++;
        continue;
      }

      const filePath = path.join(config.originalsDir, filename);
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) {
        skipped++;
        continue;
      }

      const sha256 = await hashFile(filePath);
      const existingByHash = getAssetBySha256(sha256);
      if (existingByHash) {
        skipped++;
        continue;
      }

      let storedFilename: string;
      let displayName: string;
      const id = randomUUID();

      if (isUuidPrefixed(filename)) {
        storedFilename = filename;
        const withoutUuid = filename.replace(/^[0-9a-f-]{37}/, "");
        displayName = path.basename(withoutUuid, ext);
      } else {
        const sanitized = sanitizeFilename(filename);
        storedFilename = `${id}-${sanitized}`;
        displayName = path.basename(sanitized, ext);
        await rename(filePath, path.join(config.originalsDir, storedFilename));
      }

      const thumbFilename = `${id}-thumb.webp`;
      const originalPath = path.join(config.originalsDir, storedFilename);
      const thumbPath = path.join(config.thumbsDir, thumbFilename);
      await createThumbnail(originalPath, thumbPath);

      let width: number | null = null;
      let height: number | null = null;
      try {
        const meta = await sharp(originalPath).metadata();
        width = meta.width ?? null;
        height = meta.height ?? null;
      } catch {
        // metadata extraction failed
      }

      const now = new Date().toISOString();
      const mime = mimeFromExtension(ext);

      insertAsset({
        id,
        stored_filename: storedFilename,
        original_filename: filename,
        display_name: displayName,
        ext,
        mime,
        size_bytes: fileStat.size,
        width,
        height,
        sha256,
        thumb_filename: thumbFilename,
        nsfw: 0,
        created_at: now,
        updated_at: now,
      });

      imported++;
    } catch (err) {
      errors.push({
        filename,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({ imported, skipped, errors });
}
