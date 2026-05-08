import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

// GET /api/shift-offers/physicians
// Returns all active physicians with their upcoming (future) assignments
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

  const physicians = await prisma.user.findMany({
    where: { role: "PHYSICIAN", isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      assignments: {
        where: { date: { gte: today } },
        orderBy: { date: "asc" },
        select: {
          id: true,
          date: true,
          shiftType: true,
          isLocked: true,
          period: { select: { month: true, year: true } },
        },
      },
    },
  })

  return Response.json({ physicians })
}
