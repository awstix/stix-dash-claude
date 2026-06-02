import { NextResponse } from "next/server";
import { getDefaultWorkTime } from "@/lib/work-time";

export async function GET() {
  const settings = await getDefaultWorkTime();

  return NextResponse.json(settings);
}