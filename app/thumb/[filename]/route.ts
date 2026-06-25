import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { config } from "@/lib/config";
import { safeJoin } from "@/lib/files";

interface RouteContext {
  params: Promise<{ filename: string }>;
}

export async function GET(_req: Request, ctx: RouteContext) {
  const { filename } = await ctx.params;

  if (!filename || filename.includes("..") || filename.includes("/")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const filePath = safeJoin(config.thumbsDir, filename);
  if (!filePath || !existsSync(filePath)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const buffer = await readFile(filePath);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": buffer.length.toString(),
    },
  });
}
