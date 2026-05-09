import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const periodId     = req.nextUrl.searchParams.get("periodId")
  const targetUserId = req.nextUrl.searchParams.get("userId")
  if (!periodId) return Response.json({ error: "periodId required" }, { status: 400 })

  const period = await prisma.schedulePeriod.findUnique({ where: { id: periodId } })
  if (!period) return Response.json({ error: "Period not found" }, { status: 404 })

  const userId = session.user.role === "ADMIN" && targetUserId
    ? targetUserId
    : session.user.id

  const prefix = `${period.year}-${String(period.month).padStart(2, "0")}`
  const dates  = await prisma.blockedDate.findMany({
    where:   { userId, date: { startsWith: prefix } },
    orderBy: { date: "asc" },
  })

  return Response.json({ dates })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { periodId, dates } = body
  if (!periodId) return Response.json({ error: "periodId required" }, { status: 400 })

  const period = await prisma.schedulePeriod.findUnique({ where: { id: periodId } })
  if (!period) return Response.json({ error: "Period not found" }, { status: 404 })
  if (period.status !== "OPEN")
    return Response.json({ error: "Period is not accepting changes" }, { status: 403 })

  const prefix = `${period.year}-${String(period.month).padStart(2, "0")}`

  await prisma.blockedDate.deleteMany({
    where: { userId: session.user.id, date: { startsWith: prefix } },
  })

  if (!dates || dates.length === 0) {
    return Response.json({ ok: true, waitlisted: [] })
  }

  const waitlistedDates: string[] = []

  const toInsert = await Promise.all(
    (dates as { date: string; type: string; hardness?: string; note?: string }[]).map(async (d) => {
      let status = "CONFIRMED"

      if (period.fcfsEnabled && period.maxDayOff != null) {
        const confirmedCount = await prisma.blockedDate.count({
          where: {
            date:   d.date,
            status: "CONFIRMED",
            userId: { not: session.user.id },
          },
        })
        if (confirmedCount >= period.maxDayOff) {
          status = "WAITLISTED"
          waitlistedDates.push(d.date)
        }
      }

      return {
        userId:   session.user.id,
        date:     d.date,
        type:     d.type,
        hardness: (d.hardness ?? "REQUIRED") as string,
        note:     d.note ?? null,
        status,
      }
    })
  )

  await prisma.blockedDate.createMany({ data: toInsert })
  return Response.json({ ok: true, waitlisted: waitlistedDates })
}
