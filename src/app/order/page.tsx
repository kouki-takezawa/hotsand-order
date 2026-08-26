import { getMenu, getSettings } from "@/lib/data";
import { NumberOrderClient } from "@/components/order/NumberOrderClient";

// 運用方式の変更をすぐに反映するため静的プリレンダーを禁止する
export const dynamic = "force-dynamic";

export default async function NumberOrderPage() {
  const [settings, categories] = await Promise.all([getSettings(), getMenu()]);

  return (
    <NumberOrderClient
      restaurantName={settings.restaurantName}
      categories={categories}
      wifiSsid={settings.wifiSsid}
      wifiPassword={settings.wifiPassword}
    />
  );
}
