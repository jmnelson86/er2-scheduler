/**
 * Lightweight startup migrations for er2-scheduler.
 *
 * Each migration is idempotent — safe to run on every cold start.
 * Errors from "column already exists" (SQLITE_ERROR / already exists)
 * are intentionally swallowed.
 */
import { prisma } from "./db"

async function tryRaw(sql: string) {
  try {
    await prisma.$executeRawUnsafe(sql)
  } catch {
    // Ignore — column/table already exists
  }
}

export async function runMigrations() {
  // v2: replace prefersTwelveHour boolean with shiftLengthPref enum string
  await tryRaw(`ALTER TABLE "User" ADD COLUMN "shiftLengthPref" TEXT NOT NULL DEFAULT 'PREFER_24H'`)
  // Back-fill from the old column if it still exists (safe if it doesn't)
  await tryRaw(`
    UPDATE "User"
    SET "shiftLengthPref" = CASE
      WHEN "prefersTwelveHour" = 1 THEN 'PREFER_12H'
      ELSE 'PREFER_24H'
    END
    WHERE "shiftLengthPref" = 'PREFER_24H'
  `)
}
