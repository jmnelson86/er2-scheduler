import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

const ALLOWED_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#14b8a6", "#06b6d4", "#3b82f6", "#6366f1",
  "#8b5cf6", "#ec4899", "#f43f5e", "#84cc16",
  "#10b981", "#a855f7", "#0ea5e9", "#64748b",
]

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({
    where:  { id: (session.user as any).id },
    select: { id: true, name: true, username: true, color: true, prefersTwelveHour: true, allowedShiftTypes: true },
  })
  if (!user) return Response.json({ error: "User not found" }, { status: 404 })

  return Response.json(user)
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { color, allowedShiftTypes } = body
  const data: Record<string, unknown> = {}

  if (color !== undefined) {
    if (!ALLOWED_COLORS.includes(color)) {
      return Response.json({ error: "Invalid color" }, { status: 400 })
    }
    data.color = color
  }

  if (allowedShiftTypes !== undefined) {
    data.allowedShiftTypes = String(allowedShiftTypes)
  }

  if (Object.keys(data).length > 0) {
    await prisma.user.update({
      where: { id: (session.user as any).id },
      data,
    })
  }

  return Response.json({ ok: true })
}
