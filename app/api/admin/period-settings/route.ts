import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN")
    return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { periodId, maxDayOff, fcfsEnabled } = await req.json()
  if (!periodId) return Response.json({ error: "periodId required" }, { status: 400 })

  const period = await prisma.schedulePeriod.findUnique({ where: { id: periodId } })
  if (!period) return Response.json({ error: "Period not found" }, { status: 404 })

  const updated = await prisma.schedulePeriod.update({
    where: { id: periodId },
    data:  { maxDayOff: maxDayOff ?? null, fcfsEnabled: !!fcfsEnabled },
  })

  if (fcfsEnabled && maxDayOff != null && maxDayOff > 0) {
    const prefix = `${period.year}-${String(period.month).padStart(2, "0")}`
    const allBlocked = await prisma.blockedDate.findMany({
      where:   { date: { startsWith: prefix } },
      orderBy: { createdAt: "asc" },
    })
    const byDate: Record<string, typeof allBlocked> = {}
    for (const b of allBlocked) {
      if (!byDate[b.date]) byDate[b.date] = []
      byDate[b.date].push(b)
    }
    for (const [, requests] of Object.entries(byDate)) {
      for (let i = 0; i < requests.length; i++) {
        const newStatus = i < maxDayOff ? "CONFIRMED" : "WAITLISTED"
        if (requests[i].status !== newStatus) {
          await prisma.blockedDate.update({
            where: { id: requests[i].id },
            data:  { status: newStatus },
          })
        }
      }
    }
  }

  if (!fcfsEnabled) {
    const prefix = `${period.year}-${String(period.month).padStart(2, "0")}`
    await prisma.blockedDate.updateMany({
      where: { date: { startsWith: prefix }, status: "WAITLISTED" },
      data:  { status: "CONFIRMED" },
    })
  }

  return Response.json({ period: updated })
}
