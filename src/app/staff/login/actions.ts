"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { createStaffAccount, consumeStaffInvite } from "@/lib/data";
import { isUniqueConstraintError } from "@/lib/prisma";

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

export async function registerStaffAccount(email: string, name: string, password: string, inviteCode: string) {
  if (password.length < 8) {
    return { error: "パスワードは8文字以上にしてください" };
  }
  if (!inviteCode.trim()) {
    return { error: "招待コードを入力してください" };
  }
  const normalizedEmail = email.trim().toLowerCase();
  try {
    await consumeStaffInvite(inviteCode, normalizedEmail);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "招待コードの確認に失敗しました" };
  }
  try {
    await createStaffAccount(normalizedEmail, name, password);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { error: "このメールアドレスは既に登録されています" };
    }
    throw error;
  }
  return signInWithCredentials(normalizedEmail, password);
}
