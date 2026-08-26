import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/apiAuth";
import { updateOrderStatus, type OrderStatus } from "@/lib/data";

const VALID_STATUSES: OrderStatus[] = ["pending", "preparing", "served", "cancelled"];

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireStaffSession(request);
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { id } = await context.params;
  const body: unknown = await request.json().catch(() => null);
  const status = (body as { status?: unknown } | null)?.status;
  const cancelReason = (body as { cancelReason?: unknown } | null)?.cancelReason;

  if (typeof status !== "string" || !VALID_STATUSES.includes(status as OrderStatus)) {
    return NextResponse.json({ error: "ステータスが不正です" }, { status: 400 });
  }
  if (cancelReason !== undefined && typeof cancelReason !== "string") {
    return NextResponse.json({ error: "取消理由の形式が不正です" }, { status: 400 });
  }

  try {
    const order = await updateOrderStatus(id, status as OrderStatus, cancelReason);
    return NextResponse.json({ order });
  } catch {
    return NextResponse.json({ error: "注文の更新に失敗しました" }, { status: 400 });
  }
}
