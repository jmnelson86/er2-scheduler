import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

// GET /api/admin/physician-preferences?periodId=...
// Returns all PhysicianPreference rows for a period (admin view).
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN")
    return Response.json({ error: "Unauthorized" }, { status: 401 })

  const periodId = req.nextUrl.searchParams.get("periodId")
  if (!periodId) return Response.json({ error: "periodId required" }, { status: 400 })

  const preferences = await prisma.physicianPreference.findMany({
    where:   { periodId },
    select: {
      userId:      true,
      targetShifts: true,
      minShifts:   true,
      maxShifts:   true,
      submittedAt: true,
    },
  })

  return Response.json({ preferences })
}
