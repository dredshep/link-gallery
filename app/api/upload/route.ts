import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import path from "path";
import { writeFile } from "fs/promises";
import sharp from "sharp";
import { config } from "@/lib/config";
import { insertAsset, getAssetBySha256, getTagsForAsset } from "@/lib/db";
import {
  isAllowedImageMime,
  isAllowedImageExtension,
  sanitizeFilename,
  hashBuffer,
  ensureDir,
  createThumbnail,
} from "@/lib/files";

export async function POST(req: Request) {
  await ensureDir(config.originalsDir);
  await ensureDir(config.thumbsDir);

  const formData = await req.formData();
  const files = formData.getAll("files") as File[];

  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  const results: Array<{
    id: string;
    storedFilename: string;
    displayName: string;
    thumbUrl: string;
    rawUrl: string;
    tags: string[];
    duplicate: boolean;
  }> = [];
  const errors: Array<{ filename: string; error: string }> = [];

  for (const file of files) {
    try {
      const ext = path.extname(file.name).toLowerCase();
      if (!isAllowedImageMime(file.type) && !isAllowedImageExtension(ext)) {
        errors.push({ filename: file.name, error: "Unsupported file type" });
        continue;
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const sha256 = await hashBuffer(buffer);

      const existing = getAssetBySha256(sha256);
      if (existing) {
        results.push({
          id: existing.id,
          storedFilename: existing.stored_filename,
          displayName: existing.display_name,
          thumbUrl: `/thumb/${existing.thumb_filename ?? existing.stored_filename}`,
          rawUrl: `/raw/${existing.stored_filename}`,
          tags: getTagsForAsset(existing.id),
          duplicate: true,
        });
        continue;
      }

      const id = randomUUID();
      const sanitized = sanitizeFilename(file.name);
      const storedFilename = `${id}-${sanitized}`;
      const displayName = path.basename(sanitized, ext);
      const thumbFilename = `${id}-thumb.webp`;

      const originalPath = path.join(config.originalsDir, storedFilename);
      await writeFile(originalPath, buffer);

      const thumbPath = path.join(config.thumbsDir, thumbFilename);
      await createThumbnail(originalPath, thumbPath);

      let width: number | null = null;
      let height: number | null = null;
      try {
        const meta = await sharp(buffer).metadata();
        width = meta.width ?? null;
        height = meta.height ?? null;
      } catch {
        // metadata extraction failed, proceed without dimensions
      }

      const now = new Date().toISOString();
      const mime = file.type || `image/${ext.replace(".", "")}`;

      insertAsset({
        id,
        stored_filename: storedFilename,
        original_filename: file.name,
        display_name: displayName,
        ext,
        mime,
        size_bytes: buffer.length,
        width,
        height,
        sha256,
        thumb_filename: thumbFilename,
        nsfw: 0,
        created_at: now,
        updated_at: now,
      });

      results.push({
        id,
        storedFilename,
        displayName,
        thumbUrl: `/thumb/${thumbFilename}`,
        rawUrl: `/raw/${storedFilename}`,
        tags: [],
        duplicate: false,
      });
    } catch (err) {
      errors.push({
        filename: file.name,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({ uploaded: results, errors });
}
