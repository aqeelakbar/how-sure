import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/db";
import { getPublicAnalysisStats } from "@/lib/serverPersistence";

export const revalidate = 60;

export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { claimsExamined: 0, sourcesInspected: 0 },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  }

  try {
    const stats = await getPublicAnalysisStats();

    return NextResponse.json(stats, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error("Failed to load public analysis stats:", error);

    return NextResponse.json(
      { claimsExamined: 0, sourcesInspected: 0 },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
        },
      }
    );
  }
}
