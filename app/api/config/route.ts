import { NextResponse } from "next/server";
import { config } from "@/lib/config";

export async function GET() {
  return NextResponse.json({
    publicImageBaseUrl: config.publicImageBaseUrl,
    tailscaleImageBaseUrl: config.tailscaleImageBaseUrl,
    defaultCopyMode: config.defaultCopyMode,
  });
}
