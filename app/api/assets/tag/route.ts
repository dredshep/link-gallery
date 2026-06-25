import { NextResponse } from "next/server";
import {
  getOrCreateTag,
  addTagsToAsset,
  removeTagsFromAsset,
  setTagsForAsset,
  reorderTagsForAsset,
} from "@/lib/db";
import { normalizeTag } from "@/lib/files";

interface TagRequestBody {
  assetIds: string[];
  tags: string[];
  mode: "add" | "remove" | "set" | "reorder";
}

export async function POST(req: Request) {
  const body = (await req.json()) as TagRequestBody;

  if (!body.assetIds?.length || !body.mode) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const normalizedTags = (body.tags ?? [])
    .map(normalizeTag)
    .filter((t) => t.length > 0);

  if (body.mode === "set") {
    const tagIds = normalizedTags.map(getOrCreateTag);
    for (const assetId of body.assetIds) {
      setTagsForAsset(assetId, tagIds);
    }
    return NextResponse.json({ success: true, affected: body.assetIds.length, tags: normalizedTags });
  }

  if (body.mode === "reorder") {
    for (const assetId of body.assetIds) {
      reorderTagsForAsset(assetId, normalizedTags);
    }
    return NextResponse.json({ success: true, affected: body.assetIds.length, tags: normalizedTags });
  }

  if (normalizedTags.length === 0) {
    return NextResponse.json({ error: "No valid tags provided" }, { status: 400 });
  }

  const tagIds = normalizedTags.map(getOrCreateTag);

  for (const assetId of body.assetIds) {
    switch (body.mode) {
      case "add":
        addTagsToAsset(assetId, tagIds);
        break;
      case "remove":
        removeTagsFromAsset(assetId, tagIds);
        break;
    }
  }

  return NextResponse.json({
    success: true,
    affected: body.assetIds.length,
    tags: normalizedTags,
  });
}
