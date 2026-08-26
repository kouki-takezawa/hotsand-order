import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { resolvePooledDatabaseUrl } from "./env";

// Prisma ORM 7はランタイムで明示的なドライバアダプタを要求する（schema.prisma
// のdatasourceブロックはもう接続文字列を持たない）。ここではプール接続文字列を
// 使う。CLI（`prisma db push`）は prisma.config.ts 側で直接接続文字列を別途使う。

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const { url: connectionString } = resolvePooledDatabaseUrl();
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
