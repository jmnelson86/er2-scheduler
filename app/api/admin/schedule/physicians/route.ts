import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN")
    return Response.json({ error: "Unauthorized" }, { status: 401 })

  const physicians = await prisma.user.findMany({
    where:   { role: "PHYSICIAN", isActive: true },
    select:  { id: true, name: true, isPRN: true, prefersTwelveHour: true },
    orderBy: [{ isPRN: "asc" }, { name: "asc" }],
  })

  return Response.json({ physicians })
}
