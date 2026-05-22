import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const userId = req.nextUrl.searchParams.get("userId") ?? (session.user as any).id
  if (userId !== (session.user as any).id && (session.user as any).role !== "ADMIN")
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  const prefs = await prisma.recurringPreference.findMany({ where: { userId }, orderBy: { dow: "asc" } })
  return Response.json({ prefs })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json()
  const userId: string = body.userId ?? (session.user as any).id
  if (userId !== (session.user as any).id && (session.user as any).role !== "ADMIN")
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  const incoming: { dow: number; blockType: string }[] = body.prefs ?? []
  await prisma.recurringPreference.deleteMany({ where: { userId } })
  if (incoming.length > 0) {
    await prisma.recurringPreference.createMany({
      data: incoming.map((p) => ({ userId, dow: p.dow, blockType: p.blockType })),
    })
  }
  const saved = await prisma.recurringPreference.findMany({ where: { userId }, orderBy: { dow: "asc" } })
  return Response.json({ prefs: saved })
}
