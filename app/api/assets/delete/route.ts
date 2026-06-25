import { NextResponse } from "next/server";
import { unlink } from "fs/promises";
import { existsSync } from "fs";
import { getDb } from "@/lib/db";
import { config } from "@/lib/config";
import { safeJoin } from "@/lib/files";

interface DeleteRequestBody {
  assetIds: string[];
}

export async function POST(req: Request) {
  const body = (await req.json()) as DeleteRequestBody;

  if (!body.assetIds?.length) {
    return NextResponse.json({ error: "No asset IDs provided" }, { status: 400 });
  }

  const db = getDb();
  let deleted = 0;
  const errors: Array<{ id: string; error: string }> = [];

  for (const id of body.assetIds) {
    try {
      const asset = db.query("SELECT * FROM assets WHERE id = ? AND deleted_at IS NULL").get(id) as {
        stored_filename: string;
        thumb_filename: string | null;
      } | null;

      if (!asset) {
        errors.push({ id, error: "Not found" });
        continue;
      }

      const origPath = safeJoin(config.originalsDir, asset.stored_filename);
      if (origPath && existsSync(origPath)) {
        await unlink(origPath);
      }

      if (asset.thumb_filename) {
        const thumbPath = safeJoin(config.thumbsDir, asset.thumb_filename);
        if (thumbPath && existsSync(thumbPath)) {
          await unlink(thumbPath);
        }
      }

      db.query("DELETE FROM asset_tags WHERE asset_id = ?").run(id);
      db.query("DELETE FROM assets WHERE id = ?").run(id);
      deleted++;
    } catch (err) {
      errors.push({
        id,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({ deleted, errors });
}
