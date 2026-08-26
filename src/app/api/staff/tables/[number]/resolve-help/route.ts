import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/apiAuth";
import { resolveHelp } from "@/lib/data";

export async function POST(request: Request, context: { params: Promise<{ number: string }> }) {
  const session = await requireStaffSession(request);
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { number } = await context.params;
  const tableNumber = Number(number);
  if (!Number.isInteger(tableNumber)) {
    return NextResponse.json({ error: "卓番号が不正です" }, { status: 400 });
  }

  try {
    await resolveHelp(tableNumber);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "対応済みへの更新に失敗しました";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
