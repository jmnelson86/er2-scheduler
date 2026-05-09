import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { runScheduler, validateAssignments } from "@/lib/scheduler"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN")
    return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { periodId } = await req.json()
  if (!periodId) return Response.json({ error: "periodId required" }, { status: 400 })

  const period = await prisma.schedulePeriod.findUnique({ where: { id: periodId } })
  if (!period) return Response.json({ error: "Period not found" }, { status: 404 })

  // Load physicians with their preferences, blocked dates, and preferred dates
  const physicians = await prisma.user.findMany({
    where:   { role: "PHYSICIAN", isActive: true },
    include: {
      preferences:    { where: { periodId } },
      blockedDates:   {
        where: {
          date: { startsWith: `${period.year}-${String(period.month).padStart(2, "0")}` },
          status: "CONFIRMED",
        },
      },
      preferredDates: { where: { periodId } },
    },
    orderBy: [{ isPRN: "asc" }, { name: "asc" }],
  })

  // Fetch locked assignments to preserve them
  const lockedAssignments = await prisma.shiftAssignment.findMany({
    where: { periodId, isLocked: true },
  })

  // Delete non-locked assignments
  await prisma.shiftAssignment.deleteMany({
    where: { periodId, isLocked: false },
  })

  // Build physician data for scheduler
  const physicianData = physicians.map((p) => ({
    id:               p.id,
    name:             p.name,
    isPRN:            p.isPRN,
    prefersTwelveHour: p.prefersTwelveHour,
    blockedDates:     p.blockedDates.map((b) => b.date),
    preferredDates:   p.preferredDates.map((d) => d.date),
    targetShifts:     p.preferences[0]?.targetShifts ?? (p.isPRN ? 8 : 15),
  }))

  // Run scheduler (skipping dates already covered by locked assignments)
  const lockedDatesSet = new Set(lockedAssignments.map((a) => `${a.date}::${a.shiftType}`))

  const results = runScheduler(period.year, period.month, physicianData)

  // Filter out slots that are already locked
  const toInsert = results.filter(
    (r) => !lockedDatesSet.has(`${r.date}::${r.shiftType}`)
  )

  // Validate rest gaps including locked assignments
  const allForValidation = [
    ...lockedAssignments.map((a) => ({
      id: a.id, userId: a.userId, date: a.date, shiftType: a.shiftType,
    })),
    ...toInsert.map((r, i) => ({
      id: `new-${i}`, userId: r.userId, date: r.date, shiftType: r.shiftType,
    })),
  ]
  const conflicts = validateAssignments(allForValidation as any)

  // Create assignments
  await prisma.shiftAssignment.createMany({
    data: toInsert.map((r, i) => ({
      periodId,
      userId:      r.userId,
      date:        r.date,
      shiftType:   r.shiftType,
      isLocked:    false,
      isConflict:  r.isConflict || !!conflicts[`new-${i}`],
      conflictNote: r.isConflict ? r.conflictNote : (conflicts[`new-${i}`] ?? null),
    })),
  })

  // Update period status
  await prisma.schedulePeriod.update({
    where: { id: periodId },
    data:  { status: "GENERATING" },
  })

  // Fetch all assignments to return
  const allAssignments = await prisma.shiftAssignment.findMany({
    where:   { periodId },
    include: { user: { select: { id: true, name: true, isPRN: true, prefersTwelveHour: true } } },
    orderBy: { date: "asc" },
  })

  return Response.json({
    assignments: allAssignments.map((a) => ({
      ...a, conflictNote: a.conflictNote ?? "",
    })),
  })
}
