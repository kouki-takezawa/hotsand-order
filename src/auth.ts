import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import authConfig from "@/auth.config";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

// メールアドレス単位（特定アカウントへの集中攻撃）と、IPアドレス単位
// （複数アカウントへの総当たり）の両方を抑止する。bcrypt.compare（意図的に
// 重い処理）より前にチェックすることで、攻撃によるCPU消費も抑えられる。
const LOGIN_RATE_LIMIT_WINDOW_MS = 5 * 60_000;
const LOGIN_RATE_LIMIT_MAX_PER_EMAIL = 5;
const LOGIN_RATE_LIMIT_MAX_PER_IP = 20;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "メールアドレス", type: "email" },
        password: { label: "パスワード", type: "password" },
      },
      async authorize(credentials, request) {
        const email = typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;

        const ip = getClientIp(request);
        const emailOk = checkRateLimit(`staff-login:email:${email}`, LOGIN_RATE_LIMIT_MAX_PER_EMAIL, LOGIN_RATE_LIMIT_WINDOW_MS);
        const ipOk = checkRateLimit(`staff-login:ip:${ip}`, LOGIN_RATE_LIMIT_MAX_PER_IP, LOGIN_RATE_LIMIT_WINDOW_MS);
        // ログイン試行が集中しすぎている場合は、通常の認証失敗と同じ
        // 「メールアドレスまたはパスワードが正しくありません」を返す
        // （制限にかかっていること自体を攻撃者に教えない）。
        if (!emailOk || !ipOk) return null;

        const staff = await prisma.staffUser.findUnique({ where: { email } });
        if (!staff) return null;

        const isValid = await bcrypt.compare(password, staff.passwordHash);
        if (!isValid) return null;

        return { id: staff.id, email: staff.email, name: staff.name };
      },
    }),
  ],
});
