import { getMenu, getSettings } from "@/lib/data";
import { NumberOrderClient } from "@/components/order/NumberOrderClient";

// 運用方式の変更をすぐに反映するため静的プリレンダーを禁止する
export const dynamic = "force-dynamic";

export default async function NumberOrderPage() {
  // 卓方式の店舗でも、共通QR（卓が決まっていない客用）からの注文を受け付ける
  // ため、運用形態（operationMode）に関わらずこのページ自体は常に開放する。
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
