import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/apiAuth";
import { getTodaySessionsForTable } from "@/lib/data";

export async function GET(_request: Request, context: { params: Promise<{ number: string }> }) {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { number } = await context.params;
  const tableNumber = Number(number);
  if (!Number.isInteger(tableNumber)) {
    return NextResponse.json({ error: "卓番号が不正です" }, { status: 400 });
  }

  const sessions = await getTodaySessionsForTable(tableNumber);
  return NextResponse.json({ sessions });
}
