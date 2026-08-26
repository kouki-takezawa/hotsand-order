import { getMenu, getSettings, getLocationById } from "@/lib/data";
import { NumberOrderClient } from "@/components/order/NumberOrderClient";

// 設置場所（loc）の変更をすぐに反映するため静的プリレンダーを禁止する
export const dynamic = "force-dynamic";

export default async function NumberOrderPage(props: PageProps<"/order">) {
  const { loc } = await props.searchParams;
  const locationId = typeof loc === "string" ? loc : undefined;

  const [settings, categories, location] = await Promise.all([
    getSettings(),
    getMenu(),
    locationId ? getLocationById(locationId) : Promise.resolve(null),
  ]);

  return (
    <NumberOrderClient
      restaurantName={settings.restaurantName}
      categories={categories}
      wifiSsid={settings.wifiSsid}
      wifiPassword={settings.wifiPassword}
      locationId={location?.id}
      locationName={location?.name}
    />
  );
}
