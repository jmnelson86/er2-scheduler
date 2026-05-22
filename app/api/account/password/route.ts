import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { currentPassword, newPassword } = await req.json()

  if (!currentPassword || !newPassword)
    return Response.json({ error: "currentPassword and newPassword required" }, { status: 400 })

  if (newPassword.length < 6)
    return Response.json({ error: "New password must be at least 6 characters" }, { status: 400 })

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user) return Response.json({ error: "User not found" }, { status: 404 })

  const valid = await bcrypt.compare(currentPassword, user.password)
  if (!valid) return Response.json({ error: "Current password is incorrect" }, { status: 400 })

  const hashed = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({ where: { id: user.id }, data: { password: hashed } })

  return Response.json({ ok: true })
}
