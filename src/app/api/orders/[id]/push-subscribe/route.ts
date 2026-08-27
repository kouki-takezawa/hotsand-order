import { NextResponse } from "next/server";
import { subscribeOrderPush } from "@/lib/data";

interface SubscribeBody {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

function isValidBody(body: unknown): body is SubscribeBody {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  if (typeof b.endpoint !== "string") return false;
  const keys = b.keys as Record<string, unknown> | undefined;
  return !!keys && typeof keys.p256dh === "string" && typeof keys.auth === "string";
}

// 注文番号方式の客側が、その注文だけに向けたWeb Push通知を登録するための
// 公開エンドポイント。idはcuid（推測不可能）なので認証なしで参照可能としている。
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body: unknown = await request.json().catch(() => null);
  if (!isValidBody(body)) {
    return NextResponse.json({ error: "リクエストの形式が正しくありません" }, { status: 400 });
  }

  try {
    await subscribeOrderPush(id, body);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "通知の登録に失敗しました" }, { status: 400 });
  }
}
