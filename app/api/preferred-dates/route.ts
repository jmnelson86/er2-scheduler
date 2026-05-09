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

  const dates = await prisma.preferredDate.findMany({
    where:   { userId, periodId },
    orderBy: { date: "asc" },
    select:  { date: true, shiftType: true },
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

  const userId = session.user.id

  const saved = await prisma.$transaction(async (tx) => {
    await tx.preferredDate.deleteMany({ where: { userId, periodId } })

    if (!dates || dates.length === 0) return []

    const toCreate = (dates as { date: string; shiftType: string | null }[]).map((d) => ({
      userId,
      periodId,
      date:      d.date,
      shiftType: d.shiftType ?? null,
    }))

    await tx.preferredDate.createMany({ data: toCreate })

    return tx.preferredDate.findMany({
      where:   { userId, periodId },
      orderBy: { date: "asc" },
      select:  { date: true, shiftType: true },
    })
  })

  return Response.json({ dates: saved })
}
