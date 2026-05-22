import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getDaysInMonth } from "date-fns"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json()
  const userId: string = body.userId ?? (session.user as any).id
  const { periodId } = body
  if (userId !== (session.user as any).id && (session.user as any).role !== "ADMIN")
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (!periodId) return Response.json({ error: "periodId required" }, { status: 400 })

  const period = await prisma.schedulePeriod.findUnique({ where: { id: periodId } })
  if (!period) return Response.json({ error: "Period not found" }, { status: 404 })

  const prefs = await prisma.recurringPreference.findMany({ where: { userId } })
  if (prefs.length === 0) return Response.json({ added: 0, blocks: 0, available: 0 })

  const prefix = `${period.year}-${String(period.month).padStart(2, "0")}`
  const [existingBlocked, existingPreferred] = await Promise.all([
    prisma.blockedDate.findMany({ where: { userId, date: { startsWith: prefix } } }),
    prisma.preferredDate.findMany({ where: { userId, periodId } }),
  ])
  const blockedSet = new Set(existingBlocked.map((b) => b.date))
  const preferredSet = new Set(existingPreferred.map((p) => p.date))

  const days = getDaysInMonth(new Date(period.year, period.month - 1))
  const blocksToAdd: { userId: string; date: string; hardness: string; type: string; status: string }[] = []
  const availableToAdd: { userId: string; periodId: string; date: string; shiftType: null }[] = []

  for (let d = 1; d <= days; d++) {
    const dow = new Date(period.year, period.month - 1, d).getDay()
    const pref = prefs.find((p) => p.dow === dow)
    if (!pref) continue
    const dateStr = `${prefix}-${String(d).padStart(2, "0")}`
    if (pref.blockType === "OFF_REQUIRED" && !blockedSet.has(dateStr))
      blocksToAdd.push({ userId, date: dateStr, hardness: "REQUIRED", type: "PERSONAL", status: "CONFIRMED" })
    else if (pref.blockType === "OFF_PREFERRED" && !blockedSet.has(dateStr))
      blocksToAdd.push({ userId, date: dateStr, hardness: "PREFERRED", type: "PERSONAL", status: "CONFIRMED" })
    else if (pref.blockType === "AVAILABLE" && !preferredSet.has(dateStr))
      availableToAdd.push({ userId, periodId, date: dateStr, shiftType: null })
  }

  if (blocksToAdd.length > 0)
    await prisma.blockedDate.createMany({ data: blocksToAdd })
  if (availableToAdd.length > 0)
    await prisma.preferredDate.createMany({ data: availableToAdd })

  return Response.json({ added: blocksToAdd.length + availableToAdd.length, blocks: blocksToAdd.length, available: availableToAdd.length })
}
