import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // The database may be far from the app server (e.g. a hosted Postgres in
    // another region). Prisma's defaults (2 s to get a connection, 5 s per
    // transaction) are too tight for that, so allow more headroom.
    transactionOptions: { maxWait: 10_000, timeout: 30_000 },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

/** Open the connection pool at startup so the first visitor doesn't pay for it. */
db.$connect().catch(() => {});
