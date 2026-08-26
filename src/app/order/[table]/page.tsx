import { redirect } from "next/navigation";
import { getMenu, getTableByNumber, getSettings } from "@/lib/data";
import { OrderClient } from "@/components/order/OrderClient";

// 卓ごとのQR先。運用方式の変更をすぐに反映するため静的プリレンダーを禁止する
export const dynamic = "force-dynamic";

export default async function OrderPage({ params, searchParams }: PageProps<"/order/[table]">) {
  const { table: tableParam } = await params;
  const { t: tokenParam } = await searchParams;
  const tableNumber = Number(tableParam);

  const settings = await getSettings();
  if (settings.operationMode === "number") {
    redirect("/order");
  }

  if (!Number.isInteger(tableNumber)) {
    return <NotFoundMessage />;
  }

  const table = await getTableByNumber(tableNumber);
  if (!table) {
    return <NotFoundMessage />;
  }

  const token = typeof tokenParam === "string" ? tokenParam : "";
  if (token !== table.qrToken) {
    return <NotFoundMessage message="QRコードを読み取ってアクセスしてください。" />;
  }

  const categories = await getMenu();

  return (
    <OrderClient
      restaurantName={settings.restaurantName}
      tableNumber={tableNumber}
      tableToken={token}
      tableName={table.name ?? `卓${table.number}`}
      categories={categories}
      wifiSsid={settings.wifiSsid}
      wifiPassword={settings.wifiPassword}
    />
  );
}

function NotFoundMessage({ message }: { message?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background px-6 text-center">
      <p className="text-lg font-bold text-foreground">卓が見つかりません</p>
      <p className="text-sm text-muted">{message ?? "QRコードを確認するか、店舗スタッフにお声がけください。"}</p>
    </div>
  );
}
