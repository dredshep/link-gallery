import { NextResponse } from "next/server";
import { setNsfwForAssets } from "@/lib/db";

interface NsfwRequestBody {
  assetIds: string[];
  nsfw: boolean;
}

export async function POST(req: Request) {
  const body = (await req.json()) as NsfwRequestBody;

  if (!body.assetIds?.length || typeof body.nsfw !== "boolean") {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  setNsfwForAssets(body.assetIds, body.nsfw);

  return NextResponse.json({
    success: true,
    affected: body.assetIds.length,
    nsfw: body.nsfw,
  });
}
