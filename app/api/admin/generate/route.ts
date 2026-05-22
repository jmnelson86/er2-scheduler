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
      preferredDates: { where: { periodId } },
    },
    orderBy: [{ isPRN: "asc" }, { name: "asc" }],
  })

  // Load all blocked dates for the period and split by hardness
  const blockedDates = await prisma.blockedDate.findMany({
    where: {
      date:   { startsWith: `${period.year}-${String(period.month).padStart(2, "0")}` },
      status: "CONFIRMED",
    },
  })

  const hardBlocked: Record<string, string[]> = {}
  const softBlocked: Record<string, string[]> = {}
  for (const b of blockedDates) {
    if (b.hardness === "PREFERRED") {
      ;(softBlocked[b.userId] ??= []).push(b.date)
    } else {
      ;(hardBlocked[b.userId] ??= []).push(b.date)
    }
  }

  // Fetch locked assignments to preserve them
  const lockedAssignments = await prisma.shiftAssignment.findMany({
    where: { periodId, isLocked: true },
  })

  // Delete non-locked assignments
  await prisma.shiftAssignment.deleteMany({
    where: { periodId, isLocked: false },
  })

  // Build physician data for scheduler
  const physicianData = physicians.map((p) => {
    const pref   = p.preferences[0]
    const target = pref?.targetShifts ?? (p.isPRN ? 8 : 15)
    return {
      id:               p.id,
      name:             p.name,
      isPRN:            p.isPRN,
      prefersTwelveHour: p.prefersTwelveHour,
      hardBlockedDates: hardBlocked[p.id] ?? [],
      softBlockedDates: softBlocked[p.id] ?? [],
      preferredDates:   p.preferredDates.map((d) => d.date),
      targetShifts:     target,
      minShifts:        pref?.minShifts ?? Math.max(1, target - 3),
      maxShifts:        pref?.maxShifts ?? target + 3,
      adminTargetShifts: (p as any).adminTargetShifts ?? undefined,
      adminHardCap:     (p as any).adminHardCap ?? false,
      allowedShiftTypes: (p as any).allowedShiftTypes ?? "ALL",
    }
  })

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

  // Update period status to DRAFT (schedule generated, ready for review)
  await prisma.schedulePeriod.update({
    where: { id: periodId },
    data:  { status: "DRAFT" },
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
