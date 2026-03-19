import { NextResponse } from "next/server";
import { isSetupComplete } from "@/lib/setup";

export const dynamic = "force-dynamic";

export async function GET() {
  const complete = await isSetupComplete();
  return NextResponse.json({ complete });
}
