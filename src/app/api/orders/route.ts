import { NextResponse } from "next/server";
import { createOrder } from "@/lib/data";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

interface CreateOrderBody {
  tableNumber?: number;
  tableToken?: string;
  items: { menuItemId: string; quantity: number }[];
  note?: string;
  idempotencyKey?: string;
}

function isValidBody(body: unknown): body is CreateOrderBody {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  if (b.tableNumber !== undefined && typeof b.tableNumber !== "number") return false;
  if (b.tableToken !== undefined && typeof b.tableToken !== "string") return false;
  if (b.idempotencyKey !== undefined && typeof b.idempotencyKey !== "string") return false;
  if (!Array.isArray(b.items) || b.items.length === 0) return false;
  return b.items.every(
    (i) =>
      i &&
      typeof i === "object" &&
      typeof (i as Record<string, unknown>).menuItemId === "string" &&
      typeof (i as Record<string, unknown>).quantity === "number"
  );
}

// 短時間の大量送信（いたずら・自動化ツール）を防ぐための緩い上限。
// 卓番号（または注文番号方式では固定キー）+ IPアドレスの組み合わせで数える。
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!isValidBody(body)) {
    return NextResponse.json({ error: "リクエストの形式が正しくありません" }, { status: 400 });
  }

  const rateLimitKey = `${body.tableNumber ?? "number-mode"}:${getClientIp(request)}`;
  if (!checkRateLimit(rateLimitKey, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
    return NextResponse.json({ error: "短時間に注文が集中しています。少し時間をおいてお試しください" }, { status: 429 });
  }

  try {
    const order = await createOrder({
      tableNumber: body.tableNumber,
      tableToken: body.tableToken,
      items: body.items,
      note: body.note?.slice(0, 500),
      idempotencyKey: body.idempotencyKey,
    });
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "注文の作成に失敗しました";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
