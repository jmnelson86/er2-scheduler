import { PrismaClient } from "@prisma/client"
import { PrismaLibSql } from "@prisma/adapter-libsql"
import path from "path"

function createPrisma() {
  const dbFile = process.env.DATABASE_URL ?? "file:./er2-scheduler.db"
  const authToken = process.env.DATABASE_AUTH_TOKEN

  // libsql needs an absolute file URL for local files
  const url = dbFile.startsWith("file:./")
    ? `file:${path.resolve(dbFile.slice(7))}`
    : dbFile

  const config: any = { url }
  if (authToken) config.authToken = authToken

  const adapter = new PrismaLibSql(config)
  return new PrismaClient({ adapter } as any)
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
export const prisma = globalForPrisma.prisma ?? createPrisma()
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
