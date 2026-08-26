import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/apiAuth";
import { setTableStaffNote } from "@/lib/data";

export async function PATCH(request: Request, context: { params: Promise<{ number: string }> }) {
  const session = await requireStaffSession(request);
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { number } = await context.params;
  const tableNumber = Number(number);
  if (!Number.isInteger(tableNumber)) {
    return NextResponse.json({ error: "卓番号が不正です" }, { status: 400 });
  }

  const body: unknown = await request.json().catch(() => null);
  const note = (body as { note?: unknown } | null)?.note;
  if (typeof note !== "string") {
    return NextResponse.json({ error: "メモの形式が不正です" }, { status: 400 });
  }

  try {
    await setTableStaffNote(tableNumber, note.slice(0, 500));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "メモの保存に失敗しました";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
