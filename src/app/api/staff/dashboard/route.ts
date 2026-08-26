import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/apiAuth";
import { getDashboardSummary } from "@/lib/data";

export async function GET() {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const summary = await getDashboardSummary();
  return NextResponse.json(summary);
}
