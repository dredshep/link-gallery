import { NextResponse } from "next/server";
import { getAllTagsWithCounts } from "@/lib/db";

export async function GET() {
  const tags = getAllTagsWithCounts();
  return NextResponse.json({ tags });
}
