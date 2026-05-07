import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { validateAssignments } from "@/lib/scheduler"

// GET /api/admin/schedule               → list all periods
// GET /api/admin/schedule?periodId=xxx  → assignments for period
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN")
    return Response.json({ error: "Unauthorized" }, { status: 401 })

  const periodId = req.nextUrl.searchParams.get("periodId")

  if (!periodId) {
    const periods = await prisma.schedulePeriod.findMany({
      orderBy: [{ year: "desc" }, { month: "desc" }],
    })
    return Response.json({ periods })
  }

  const period = await prisma.schedulePeriod.findUnique({ where: { id: periodId } })
  if (!period) return Response.json({ error: "Period not found" }, { status: 404 })

  const rawAssignments = await prisma.shiftAssignment.findMany({
    where:   { periodId },
    include: { user: { select: { id: true, name: true, isPRN: true, prefersTwelveHour: true } } },
    orderBy: { date: "asc" },
  })

  const assignments = rawAssignments.map((a) => ({
    ...a,
    conflictNote: a.conflictNote ?? "",
  }))

  return Response.json({ period, assignments })
}

// GET /api/admin/schedule/physicians — handled in sub-route
// POST /api/admin/schedule → create new period
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN")
    return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { month, year } = await req.json()
  if (!month || !year) return Response.json({ error: "month and year required" }, { status: 400 })

  const existing = await prisma.schedulePeriod.findUnique({ where: { month_year: { month, year } } })
  if (existing) return Response.json({ error: "Period already exists" }, { status: 409 })

  const period = await prisma.schedulePeriod.create({
    data: { month, year, status: "OPEN" },
  })

  return Response.json({ period })
}

// PATCH /api/admin/schedule → update period status OR reassign a single assignment
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN")
    return Response.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()

  // Reassign: { assignmentId, userId? }
  if (body.assignmentId !== undefined) {
    const { assignmentId, userId, lock } = body

    if (lock !== undefined) {
      const updated = await prisma.shiftAssignment.update({
        where: { id: assignmentId },
        data:  { isLocked: lock },
        include: { user: { select: { id: true, name: true, isPRN: true, prefersTwelveHour: true } } },
      })
      return Response.json({ assignment: { ...updated, conflictNote: updated.conflictNote ?? "" } })
    }

    // Reassign
    const assignment = await prisma.shiftAssignment.findUnique({
      where: { id: assignmentId },
      include: { period: true },
    })
    if (!assignment) return Response.json({ error: "Not found" }, { status: 404 })

    // Re-validate rest gaps after change
    const allForPeriod = await prisma.shiftAssignment.findMany({
      where: { periodId: assignment.periodId },
    })

    const simulated = allForPeriod.map((a) =>
      a.id === assignmentId ? { ...a, userId: userId ?? null } : a
    )
    const conflicts = validateAssignments(simulated.filter((a) => a.userId !== null) as any)

    const updated = await prisma.shiftAssignment.update({
      where: { id: assignmentId },
      data:  {
        userId:      userId ?? null,
        isLocked:    true,
        isConflict:  !!conflicts[assignmentId],
        conflictNote: conflicts[assignmentId] ?? null,
      },
      include: { user: { select: { id: true, name: true, isPRN: true, prefersTwelveHour: true } } },
    })

    return Response.json({ assignment: { ...updated, conflictNote: updated.conflictNote ?? "" } })
  }

  // Update period status
  const { periodId, status } = body
  if (!periodId || !status) return Response.json({ error: "periodId and status required" }, { status: 400 })

  const period = await prisma.schedulePeriod.update({
    where: { id: periodId },
    data:  { status },
  })
  return Response.json({ period })
}

// DELETE /api/admin/schedule?periodId=xxx → clear non-locked assignments
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN")
    return Response.json({ error: "Unauthorized" }, { status: 401 })

  const periodId = req.nextUrl.searchParams.get("periodId")
  if (!periodId) return Response.json({ error: "periodId required" }, { status: 400 })

  await prisma.shiftAssignment.deleteMany({
    where: { periodId, isLocked: false },
  })

  await prisma.schedulePeriod.update({
    where: { id: periodId },
    data:  { status: "DRAFT" },
  })

  const remaining = await prisma.shiftAssignment.findMany({
    where:   { periodId },
    include: { user: { select: { id: true, name: true, isPRN: true, prefersTwelveHour: true } } },
    orderBy: { date: "asc" },
  })

  return Response.json({
    assignments: remaining.map((a) => ({ ...a, conflictNote: a.conflictNote ?? "" })),
  })
}
