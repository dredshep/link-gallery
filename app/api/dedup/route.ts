import { NextResponse } from "next/server";
import { unlink } from "fs/promises";
import { existsSync } from "fs";
import { getDb } from "@/lib/db";
import { config } from "@/lib/config";
import { safeJoin } from "@/lib/files";

export async function POST() {
  const db = getDb();

  const dupes = db.query(`
    SELECT a1.id, a1.stored_filename, a1.thumb_filename
    FROM assets a1
    WHERE a1.sha256 IN (
      SELECT sha256 FROM assets
      WHERE sha256 IS NOT NULL AND deleted_at IS NULL
      GROUP BY sha256
      HAVING COUNT(*) > 1
    )
    AND a1.deleted_at IS NULL
    AND a1.id NOT IN (
      SELECT MIN(id) FROM assets
      WHERE sha256 IS NOT NULL AND deleted_at IS NULL
      GROUP BY sha256
    )
  `).all() as Array<{ id: string; stored_filename: string; thumb_filename: string | null }>;

  let removed = 0;
  const errors: Array<{ id: string; error: string }> = [];

  for (const dupe of dupes) {
    try {
      const origPath = safeJoin(config.originalsDir, dupe.stored_filename);
      if (origPath && existsSync(origPath)) {
        await unlink(origPath);
      }

      if (dupe.thumb_filename) {
        const thumbPath = safeJoin(config.thumbsDir, dupe.thumb_filename);
        if (thumbPath && existsSync(thumbPath)) {
          await unlink(thumbPath);
        }
      }

      db.query("DELETE FROM asset_tags WHERE asset_id = ?").run(dupe.id);
      db.query("DELETE FROM assets WHERE id = ?").run(dupe.id);
      removed++;
    } catch (err) {
      errors.push({
        id: dupe.id,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({ removed, errors });
}
