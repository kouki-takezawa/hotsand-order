import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/apiAuth";
import { createStaffOrder } from "@/lib/data";

export async function POST(request: Request, context: { params: Promise<{ number: string }> }) {
  const session = await requireStaffSession(request);
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { number } = await context.params;
  const tableNumber = Number(number);
  if (!Number.isInteger(tableNumber)) {
    return NextResponse.json({ error: "卓番号が不正です" }, { status: 400 });
  }

  const body: unknown = await request.json().catch(() => null);
  const items = (body as { items?: unknown } | null)?.items;
  if (
    !Array.isArray(items) ||
    items.length === 0 ||
    !items.every(
      (i) =>
        i &&
        typeof i === "object" &&
        typeof (i as Record<string, unknown>).menuItemId === "string" &&
        typeof (i as Record<string, unknown>).quantity === "number"
    )
  ) {
    return NextResponse.json({ error: "リクエストの形式が正しくありません" }, { status: 400 });
  }

  try {
    const order = await createStaffOrder(
      tableNumber,
      items as { menuItemId: string; quantity: number }[]
    );
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "注文の作成に失敗しました";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
