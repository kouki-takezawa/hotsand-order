import { headers } from "next/headers";
import QRCode from "qrcode";
import { getBaseUrl } from "@/lib/url";
import { PrintButton } from "@/components/staff/PrintButton";

// 発行するQRのURLはホスト名に依存するため静的プリレンダーを禁止する
export const dynamic = "force-dynamic";

export default async function QrSettingsPage() {
  const headerList = await headers();
  const baseUrl = getBaseUrl(headerList);
  const url = `${baseUrl}/order`;
  const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 320 });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between print:hidden">
        <p className="text-sm text-muted">
          このQRコードを提携店舗のカウンターなどに設置してください。読み取ると注文番号が発行され、受け取りまたは配達で商品をお渡しします。
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
