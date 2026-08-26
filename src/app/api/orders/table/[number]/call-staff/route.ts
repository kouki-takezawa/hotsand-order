import { NextResponse } from "next/server";
import { callStaff } from "@/lib/data";

export async function POST(request: Request, context: { params: Promise<{ number: string }> }) {
  const { number } = await context.params;
  const tableNumber = Number(number);
  if (!Number.isInteger(tableNumber)) {
    return NextResponse.json({ error: "卓番号が不正です" }, { status: 400 });
  }

  const body: unknown = await request.json().catch(() => null);
  const token = (body as { token?: unknown } | null)?.token;
  if (typeof token !== "string") {
    return NextResponse.json({ error: "リクエストの形式が正しくありません" }, { status: 400 });
  }

  try {
    await callStaff(tableNumber, token);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "呼び出しに失敗しました";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
