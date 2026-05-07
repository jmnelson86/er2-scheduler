import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const periods = await prisma.schedulePeriod.findMany({
    where:   { status: { not: "PUBLISHED" } },
    orderBy: [{ year: "asc" }, { month: "asc" }],
  })

  return Response.json({ periods })
}
