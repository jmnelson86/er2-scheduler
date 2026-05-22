import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

// GET /api/admin/physician-settings
// Returns all active physicians with their admin-managed settings.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN")
    return Response.json({ error: "Unauthorized" }, { status: 401 })

  const physicians = await prisma.user.findMany({
    where:   { role: "PHYSICIAN", isActive: true },
    orderBy: [{ isPRN: "asc" }, { name: "asc" }],
    select: {
      id:                true,
      name:              true,
      username:          true,
      isPRN:             true,
      prefersTwelveHour: true,
      adminTargetShifts: true,
      adminHardCap:      true,
      allowedShiftTypes: true,
    },
  })

  return Response.json({ physicians })
}

// PATCH /api/admin/physician-settings
// Body: { userId, adminTargetShifts?, adminHardCap?, prefersTwelveHour? }
// Updates one or more admin-managed fields on a physician's User record.
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN")
    return Response.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { userId, adminTargetShifts, adminHardCap, prefersTwelveHour, allowedShiftTypes } = body

  if (!userId) return Response.json({ error: "userId required" }, { status: 400 })

  // Build only the fields that were explicitly provided.
  const data: Record<string, unknown> = {}

  if (adminTargetShifts !== undefined) {
    data.adminTargetShifts = adminTargetShifts != null ? Number(adminTargetShifts) : null
  }

  if (adminHardCap !== undefined) {
    data.adminHardCap = Boolean(adminHardCap)
  }

  if (prefersTwelveHour !== undefined) {
    data.prefersTwelveHour = Boolean(prefersTwelveHour)
  }

  if (allowedShiftTypes !== undefined) {
    data.allowedShiftTypes = String(allowedShiftTypes)
  }

  if (Object.keys(data).length === 0) {
    return Response.json({ error: "No valid fields provided" }, { status: 400 })
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id:                true,
      name:              true,
      username:          true,
      isPRN:             true,
      prefersTwelveHour: true,
      adminTargetShifts: true,
      adminHardCap:      true,
      allowedShiftTypes: true,
    },
  })

  return Response.json({ user })
}
