"use server";

import { headers } from "next/headers";
import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { registerStaffWithInvite } from "@/lib/data";
import { checkRateLimit } from "@/lib/rateLimit";

export async function signInWithCredentials(email: string, password: string) {
  try {
    await signIn("credentials", { email, password, redirect: false });
    return { error: null };
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "メールアドレスまたはパスワードが正しくありません" };
    }
    throw error;
  }
}

// 招待コードの総当たり・大量アカウント作成を抑止するための緩い上限。
// IPアドレス単位で数える（メール単位だと同じ攻撃者が別メールで回避できるため）。
const REGISTER_RATE_LIMIT_WINDOW_MS = 10 * 60_000;
const REGISTER_RATE_LIMIT_MAX_PER_IP = 10;

async function getClientIpFromHeaders(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : "unknown";
}

export async function registerStaffAccount(email: string, name: string, password: string, inviteCode: string) {
  if (password.length < 8) {
    return { error: "パスワードは8文字以上にしてください" };
  }
  if (!inviteCode.trim()) {
    return { error: "招待コードを入力してください" };
  }

  const ip = await getClientIpFromHeaders();
  if (!checkRateLimit(`staff-register:ip:${ip}`, REGISTER_RATE_LIMIT_MAX_PER_IP, REGISTER_RATE_LIMIT_WINDOW_MS)) {
    return { error: "しばらく時間をおいてから再度お試しください" };
  }

  const normalizedEmail = email.trim().toLowerCase();
  try {
    await registerStaffWithInvite(inviteCode, normalizedEmail, name, password);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "登録に失敗しました" };
  }
  return signInWithCredentials(normalizedEmail, password);
}
