import { headers } from "next/headers";
import QRCode from "qrcode";
import { getTables, getSettings } from "@/lib/data";
import { getBaseUrl } from "@/lib/url";
import { PrintButton } from "@/components/staff/PrintButton";

// 発行するQRのURLはホスト名に依存するため静的プリレンダーを禁止する
export const dynamic = "force-dynamic";

export default async function QrSettingsPage() {
  const [tables, settings, headerList] = await Promise.all([getTables(), getSettings(), headers()]);
  const baseUrl = getBaseUrl(headerList);

  if (settings.operationMode === "number") {
    const url = `${baseUrl}/order`;
    const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 320 });
    return (
      <div>
        <div className="mb-6 flex items-center justify-between print:hidden">
          <p className="text-sm text-muted">
            フリー席・注文番号方式です。レジ・カウンターに1枚設置してください。読み取ると注文番号が発行されます。
          </p>
          <PrintButton className="shrink-0 rounded-full bg-accent px-5 py-2 text-sm font-bold text-accent-foreground" />
        </div>
        <div className="flex max-w-xs flex-col items-center rounded-2xl border border-border bg-surface p-6 print:border-0 print:p-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="注文用QRコード" className="h-56 w-56" />
          <p className="mt-3 break-all text-center text-xs text-muted">{url}</p>
        </div>
      </div>
    );
  }

  const freeOrderUrl = `${baseUrl}/order`;
  const [tablesWithQr, freeQrDataUrl] = await Promise.all([
    Promise.all(
      tables.map(async (table) => {
        const url = `${baseUrl}/order/${table.number}?t=${table.qrToken}`;
        const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 240 });
        return { ...table, url, qrDataUrl };
      })
    ),
    QRCode.toDataURL(freeOrderUrl, { margin: 1, width: 240 }),
  ]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4 print:hidden">
        <p className="text-sm text-muted">各テーブルに設置するQRコードです。印刷して店内に張り出してください。テーブルの追加・削除は「テーブル」タブから行えます。</p>
        <PrintButton className="shrink-0 rounded-full bg-accent px-5 py-2 text-sm font-bold text-accent-foreground" />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-2 print:gap-8">
        {tablesWithQr.map((table) => (
          <div
            key={table.id}
            className="flex flex-col items-center rounded-2xl border border-border bg-surface p-4 print:break-inside-avoid print:border-2 print:border-black print:p-6"
          >
            <p className="mb-2 text-sm font-bold text-foreground print:text-2xl">{table.name ?? `卓${table.number}`}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={table.qrDataUrl} alt={`卓${table.number}のQRコード`} className="h-32 w-32 print:h-56 print:w-56" />
            <p className="mt-2 break-all text-center text-[10px] text-muted print:hidden">{table.url}</p>
          </div>
        ))}
        {tablesWithQr.length === 0 && <p className="text-sm text-muted">テーブルが登録されていません</p>}
      </div>

      <div className="mt-8 border-t border-border pt-6 print:break-before-page">
        <p className="mb-1 text-sm font-bold text-foreground">共通QR（卓が決まっていない客用）</p>
        <p className="mb-4 text-xs text-muted print:hidden">
          カウンター席・順番待ちなど特定の卓に紐付かない注文を受け付けます。レジなど共通の場所に掲示してください。
        </p>
        <div className="flex max-w-xs flex-col items-center rounded-2xl border border-border bg-surface p-4 print:border-2 print:border-black print:p-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={freeQrDataUrl} alt="共通QRコード" className="h-32 w-32 print:h-56 print:w-56" />
          <p className="mt-2 break-all text-center text-[10px] text-muted print:hidden">{freeOrderUrl}</p>
        </div>
      </div>
    </div>
  );
}
