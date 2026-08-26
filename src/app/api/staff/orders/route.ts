import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/apiAuth";
import { getKitchenOrders, orderTotal } from "@/lib/data";

export async function GET() {
  const session = await requireStaffSession();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const board = await getKitchenOrders();
  return NextResponse.json({
    orders: board.orders.map((order) => ({
      ...order,
      locationName: order.location?.name ?? null,
      total: orderTotal(order),
    })),
  });
}
