import { PrismaClient } from "@prisma/client"
import { PrismaLibSql } from "@prisma/adapter-libsql"
import path from "path"

function createPrisma() {
  const dbFile = process.env.DATABASE_URL ?? "file:./er2-scheduler.db"
  // libsql needs an absolute file URL
  const absUrl = dbFile.startsWith("file:./")
    ? `file:${path.resolve(dbFile.slice(7))}`
    : dbFile

  const adapter = new PrismaLibSql({ url: absUrl } as any)
  return new PrismaClient({ adapter } as any)
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
export const prisma = globalForPrisma.prisma ?? createPrisma()
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
