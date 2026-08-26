import { NextResponse } from "next/server";
import { rateOrder } from "@/lib/data";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body: unknown = await request.json().catch(() => null);
  const rating = (body as { rating?: unknown } | null)?.rating;

  if (typeof rating !== "number") {
    return NextResponse.json({ error: "評価の形式が不正です" }, { status: 400 });
  }

  try {
    const order = await rateOrder(id, rating);
    return NextResponse.json({ order });
  } catch (error) {
    const message = error instanceof Error ? error.message : "評価の送信に失敗しました";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
