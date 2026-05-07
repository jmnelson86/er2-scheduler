import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

// GET /api/admin/availability?periodId=xxx
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN")
    return Response.json({ error: "Unauthorized" }, { status: 401 })

  const periodId = req.nextUrl.searchParams.get("periodId")
  if (!periodId) return Response.json({ error: "periodId required" }, { status: 400 })

  const period = await prisma.schedulePeriod.findUnique({ where: { id: periodId } })
  if (!period) return Response.json({ error: "Not found" }, { status: 404 })

  const prefix = `${period.year}-${String(period.month).padStart(2, "0")}`

  const dates = await prisma.blockedDate.findMany({
    where:   { date: { startsWith: prefix } },
    include: { user: { select: { id: true, name: true, isPRN: true } } },
    orderBy: { createdAt: "asc" },
  })

  const dayMap: Record<string, any[]> = {}
  for (const d of dates) {
    if (!dayMap[d.date]) dayMap[d.date] = []
    dayMap[d.date].push({
      userId:    d.userId,
      name:      d.user.name,
      isPRN:     d.user.isPRN,
      type:      d.type,
      status:    d.status,
      createdAt: d.createdAt,
    })
  }

  return Response.json({
    dayMap,
    maxDayOff:   period.maxDayOff,
    fcfsEnabled: period.fcfsEnabled,
    month:       period.month,
    year:        period.year,
  })
}

// PATCH /api/admin/availability — promote/demote individual blocked date
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN")
    return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { userId, date, status } = await req.json()

  await prisma.blockedDate.updateMany({
    where: { userId, date },
    data:  { status },
  })

  return Response.json({ ok: true })
}
