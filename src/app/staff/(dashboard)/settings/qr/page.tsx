import { headers } from "next/headers";
import QRCode from "qrcode";
import { listLocations } from "@/lib/data";
import { getBaseUrl } from "@/lib/url";
import { PrintButton } from "@/components/staff/PrintButton";

// 発行するQRのURLはホスト名に依存するため静的プリレンダーを禁止する
export const dynamic = "force-dynamic";

export default async function QrSettingsPage() {
  const [locations, headerList] = await Promise.all([listLocations(), headers()]);
  const baseUrl = getBaseUrl(headerList);

  const commonUrl = `${baseUrl}/order`;
  const [locationsWithQr, commonQrDataUrl] = await Promise.all([
    Promise.all(
      locations.map(async (location) => {
        const url = `${baseUrl}/order?loc=${location.id}`;
        const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 240 });
        return { ...location, url, qrDataUrl };
      })
    ),
    QRCode.toDataURL(commonUrl, { margin: 1, width: 240 }),
  ]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4 print:hidden">
        <p className="text-sm text-muted">
          各設置場所（提携店舗）専用のQRコードです。印刷してその店舗に掲示してください。読み取ると注文番号が発行され、そのQRからの注文には設置場所が記録されます。設置場所の追加・削除・一時停止は「設置場所」タブから行えます。まとめてPDFで保存したい場合は「印刷する」から印刷ダイアログを開き、出力先で「PDFに保存」を選んでください。
        </p>
        <PrintButton className="shrink-0 rounded-full bg-accent px-5 py-2 text-sm font-bold text-accent-foreground" />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-2 print:gap-8">
        {locationsWithQr.map((location) => (
          <div
            key={location.id}
            className="flex flex-col items-center rounded-2xl border border-border bg-surface p-4 print:break-inside-avoid print:border-2 print:border-black print:p-6"
          >
            <p className="mb-2 text-sm font-bold text-foreground print:text-2xl">{location.name}</p>
            {location.isPaused && (
              <p className="mb-2 rounded-full border border-warning px-2 py-0.5 text-[11px] font-medium text-warning print:hidden">
                一時停止中
              </p>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={location.qrDataUrl} alt={`${location.name}のQRコード`} className="h-32 w-32 print:h-56 print:w-56" />
            <p className="mt-2 break-all text-center text-[10px] text-muted print:hidden">{location.url}</p>
          </div>
        ))}
        {locationsWithQr.length === 0 && <p className="text-sm text-muted">設置場所が登録されていません</p>}
      </div>

      <div className="mt-8 border-t border-border pt-6 print:break-before-page">
        <p className="mb-1 text-sm font-bold text-foreground">共通QR（設置場所を紐付けない場合）</p>
        <p className="mb-4 text-xs text-muted print:hidden">
          特定の設置場所に紐付けない、テスト用・臨時の注文受付に使えます。このQRからの注文は「設置場所なし」として記録されます。
        </p>
        <div className="flex max-w-xs flex-col items-center rounded-2xl border border-border bg-surface p-4 print:border-2 print:border-black print:p-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={commonQrDataUrl} alt="共通QRコード" className="h-32 w-32 print:h-56 print:w-56" />
          <p className="mt-2 break-all text-center text-[10px] text-muted print:hidden">{commonUrl}</p>
        </div>
      </div>
    </div>
  );
}
