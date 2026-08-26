import { NextResponse } from "next/server";
import { getOrderById, orderTotal } from "@/lib/data";

// 注文番号方式の客側が、自分の注文の状況を確認するための公開エンドポイント。
// idはcuid（推測不可能）なので、認証なしで参照可能としている。
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const order = await getOrderById(id);
  if (!order) {
    return NextResponse.json({ error: "注文が見つかりません" }, { status: 404 });
  }
  return NextResponse.json({ order: { ...order, total: orderTotal(order) } });
}
