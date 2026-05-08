import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

// GET /api/admin/settings
// Returns all AdminSettings as { settings: { key: value } }
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if ((session.user as any).role !== "ADMIN") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const rows = await prisma.adminSetting.findMany()
  const settings: Record<string, string> = {}
  for (const row of rows) {
    settings[row.key] = row.value
  }

  return Response.json({ settings })
}

// PATCH /api/admin/settings
// Body: { key, value }
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if ((session.user as any).role !== "ADMIN") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const { key, value } = body

  if (!key || value === undefined) {
    return Response.json({ error: "key and value are required" }, { status: 400 })
  }

  const setting = await prisma.adminSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  })

  return Response.json({ setting })
}
