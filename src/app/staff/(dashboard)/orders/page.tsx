import { getKitchenOrders, getMenu, getSettings, orderTotal } from "@/lib/data";
import { OrdersBoard } from "@/components/staff/OrdersBoard";

// 注文状況をリアルタイムに反映するため、ビルド時の静的プリレンダーを禁止する
export const dynamic = "force-dynamic";

function serializeOrder(order: Parameters<typeof orderTotal>[0]) {
  return {
    id: order.id,
    status: order.status,
    note: order.note,
    dailyNumber: order.dailyNumber,
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((item) => ({ id: item.id, name: item.name, price: item.price, quantity: item.quantity })),
    total: orderTotal(order),
  };
}

export default async function StaffOrdersPage() {
  // 卓方式のときだけ後段でメニューを使うが、モードが分かるまで待ってから
  // メニューを取得すると直列（2往復）になってしまうため、先にsettingsだけ
  // 取得してモードを確定させ、注文とメニューの取得を並列で走らせる。
  const settings = await getSettings();
  const [board, categories] = await Promise.all([
    getKitchenOrders(),
    settings.operationMode === "table" ? getMenu() : Promise.resolve([]),
  ]);

  const initialData =
    board.mode === "number"
      ? { mode: "number" as const, orders: board.orders.map(serializeOrder) }
      : {
          mode: "table" as const,
          tables: board.groups.map((g) => ({
            table: {
              id: g.table.id,
              number: g.table.number,
              name: g.table.name,
              helpRequestedAt: g.table.helpRequestedAt ? g.table.helpRequestedAt.toISOString() : null,
            },
            orders: g.orders.map(serializeOrder),
          })),
          freeOrders: board.freeOrders.map(serializeOrder),
        };

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-foreground">注文管理</h1>
      <p className="mb-6 text-sm text-muted">
        {board.mode === "number" ? "受付中の注文をリアルタイムに確認・更新します" : "卓ごとの進行中の注文をリアルタイムに確認・更新します"}
      </p>
      <OrdersBoard
        initialData={initialData}
        menuCategories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          menuItems: c.menuItems.map((i) => ({ id: i.id, name: i.name, price: i.price })),
        }))}
      />
    </div>
  );
}
