import { NextResponse } from "next/server";
import { queryAssets, getTagsForAsset } from "@/lib/db";
import { config } from "@/lib/config";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? undefined;
  const tag = url.searchParams.get("tag") ?? undefined;
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const limit = Math.min(Number(url.searchParams.get("limit")) || config.pageSize, 200);
  const sort = (url.searchParams.get("sort") ?? "newest") as "newest" | "oldest" | "name";

  const hideNsfw = url.searchParams.get("hideNsfw") === "1";

  const { assets, nextCursor } = queryAssets({ q, tag, cursor, limit, sort, hideNsfw });

  const result = assets.map((a) => ({
    id: a.id,
    storedFilename: a.stored_filename,
    originalFilename: a.original_filename,
    displayName: a.display_name,
    width: a.width,
    height: a.height,
    sizeBytes: a.size_bytes,
    thumbUrl: `/thumb/${a.thumb_filename ?? a.stored_filename}`,
    rawUrl: `/raw/${a.stored_filename}`,
    tags: getTagsForAsset(a.id),
    createdAt: a.created_at,
    nsfw: a.nsfw === 1,
  }));

  return NextResponse.json({ assets: result, nextCursor });
}
