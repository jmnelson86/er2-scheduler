import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const periodId = req.nextUrl.searchParams.get("periodId")
  if (!periodId) return Response.json({ error: "periodId required" }, { status: 400 })

  const preference = await prisma.physicianPreference.findUnique({
    where: { userId_periodId: { userId: session.user.id, periodId } },
  })

  return Response.json({ preference })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { periodId, targetShifts, notes, submit } = body

  if (!periodId) return Response.json({ error: "periodId required" }, { status: 400 })

  const period = await prisma.schedulePeriod.findUnique({ where: { id: periodId } })
  if (!period) return Response.json({ error: "Period not found" }, { status: 404 })
  if (period.status !== "OPEN")
    return Response.json({ error: "Period is not accepting submissions" }, { status: 403 })

  const preference = await prisma.physicianPreference.upsert({
    where:  { userId_periodId: { userId: session.user.id, periodId } },
    create: {
      userId:      session.user.id,
      periodId,
      targetShifts: targetShifts ?? 15,
      notes:        notes ?? null,
      submittedAt:  submit ? new Date() : null,
    },
    update: {
      targetShifts: targetShifts ?? 15,
      notes:        notes ?? null,
      ...(submit ? { submittedAt: new Date() } : {}),
    },
  })

  return Response.json({ preference })
}
