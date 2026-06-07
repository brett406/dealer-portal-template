import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStorageDurability } from "@/lib/uploads";

export async function GET() {
  try {
    // Check database connectivity
    await prisma.$queryRawUnsafe("SELECT 1");

    // Surface upload-storage durability so a misconfigured deploy (ephemeral
    // uploads) is observable in monitoring instead of silently losing files.
    const storage = getStorageDurability();

    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? "1.0.0",
      uploads: {
        durable: storage.durable,
        via: storage.hasVolume ? "volume" : storage.hasR2 ? "r2" : "ephemeral",
      },
    });
  } catch {
    return NextResponse.json(
      { status: "unhealthy", timestamp: new Date().toISOString() },
      { status: 503 },
    );
  }
}
