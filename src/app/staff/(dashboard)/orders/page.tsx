import { getKitchenOrders, orderTotal } from "@/lib/data";
import { OrdersBoard } from "@/components/staff/OrdersBoard";

// 注文状況をリアルタイムに反映するため、ビルド時の静的プリレンダーを禁止する
export const dynamic = "force-dynamic";

function serializeOrder(order: Parameters<typeof orderTotal>[0] & { location: { name: string } | null }) {
  return {
    id: order.id,
    status: order.status,
    note: order.note,
    dailyNumber: order.dailyNumber,
    locationName: order.location?.name ?? null,
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((item) => ({ id: item.id, name: item.name, price: item.price, quantity: item.quantity })),
    total: orderTotal(order),
  };
}

export default async function StaffOrdersPage() {
  const board = await getKitchenOrders();

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-foreground">注文管理</h1>
      <p className="mb-6 text-sm text-muted">受付中の注文をリアルタイムに確認・更新します</p>
      <OrdersBoard initialData={{ orders: board.orders.map(serializeOrder) }} />
    </div>
  );
}
