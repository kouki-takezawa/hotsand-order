import { getMenu, getSettings, getLocationById } from "@/lib/data";
import { NumberOrderClient } from "@/components/order/NumberOrderClient";

// 設置場所（loc）や受付停止設定の変更をすぐに反映するため静的プリレンダーを禁止する
export const dynamic = "force-dynamic";

export default async function NumberOrderPage(props: PageProps<"/order">) {
  const { loc } = await props.searchParams;
  const locationId = typeof loc === "string" ? loc : undefined;

  const [settings, location] = await Promise.all([
    getSettings(),
    locationId ? getLocationById(locationId) : Promise.resolve(null),
  ]);

  const paused = settings.orderingPaused || location?.isPaused === true;

  if (paused) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background px-6 text-center">
        <p className="text-xs text-muted">{settings.restaurantName}</p>
        {location?.name && <p className="text-xs text-muted">{location.name}</p>}
        <p className="mt-4 text-lg font-bold text-foreground">ただいま注文受付を停止しています</p>
        <p className="mt-2 max-w-xs text-sm text-muted">しばらく経ってから再度お試しいただくか、店舗スタッフにお声がけください。</p>
      </div>
    );
  }

  const categories = await getMenu();

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
