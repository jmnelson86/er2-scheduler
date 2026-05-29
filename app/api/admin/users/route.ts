import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"

function adminOnly() {
  return Response.json({ error: "Unauthorized" }, { status: 401 })
}

// GET /api/admin/users
// Returns ALL users (active and inactive, all roles)
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN") return adminOnly()

  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { isPRN: "asc" }, { name: "asc" }],
    select: {
      id:               true,
      name:             true,
      username:         true,
      email:            true,
      role:             true,
      isPRN:            true,
      isActive:         true,
      shiftLengthPref:  true,
      allowedShiftTypes: true,
      adminTargetShifts: true,
      adminHardCap:     true,
      color:            true,
      createdAt:        true,
    },
  })

  return Response.json({ users })
}

// POST /api/admin/users
// Create a new user (physician or admin)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN") return adminOnly()

  const body = await req.json()
  const { name, username, password, role = "PHYSICIAN", isPRN = false, email } = body

  if (!name?.trim())     return Response.json({ error: "Name is required" },     { status: 400 })
  if (!username?.trim()) return Response.json({ error: "Username is required" }, { status: 400 })
  if (!password || String(password).length < 6)
    return Response.json({ error: "Password must be at least 6 characters" }, { status: 400 })
  if (!["ADMIN", "PHYSICIAN"].includes(role))
    return Response.json({ error: "Invalid role" }, { status: 400 })

  // Check username uniqueness
  const existing = await prisma.user.findUnique({ where: { username: username.trim().toLowerCase() } })
  if (existing) return Response.json({ error: "Username already taken" }, { status: 409 })

  const hashed = await bcrypt.hash(String(password), 10)

  const user = await prisma.user.create({
    data: {
      name:     name.trim(),
      username: username.trim().toLowerCase(),
      password: hashed,
      role,
      isPRN:    Boolean(isPRN),
      email:    email ? String(email).toLowerCase().trim() : null,
      isActive: true,
    },
    select: {
      id: true, name: true, username: true, email: true,
      role: true, isPRN: true, isActive: true,
      shiftLengthPref: true, allowedShiftTypes: true,
      adminTargetShifts: true, adminHardCap: true,
      color: true, createdAt: true,
    },
  })

  return Response.json({ user }, { status: 201 })
}

// PATCH /api/admin/users
// Edit an existing user's profile fields or toggle isActive
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN") return adminOnly()

  const body = await req.json()
  const { userId, name, username, email, role, isPRN, isActive, newPassword } = body

  if (!userId) return Response.json({ error: "userId required" }, { status: 400 })

  const data: Record<string, unknown> = {}

  if (name !== undefined) {
    if (!String(name).trim()) return Response.json({ error: "Name cannot be empty" }, { status: 400 })
    data.name = String(name).trim()
  }

  if (username !== undefined) {
    const trimmed = String(username).trim().toLowerCase()
    if (!trimmed) return Response.json({ error: "Username cannot be empty" }, { status: 400 })
    // Check uniqueness (ignore self)
    const conflict = await prisma.user.findFirst({
      where: { username: trimmed, NOT: { id: userId } },
    })
    if (conflict) return Response.json({ error: "Username already taken" }, { status: 409 })
    data.username = trimmed
  }

  if (email !== undefined) {
    data.email = email ? String(email).toLowerCase().trim() : null
  }

  if (role !== undefined) {
    if (!["ADMIN", "PHYSICIAN"].includes(role))
      return Response.json({ error: "Invalid role" }, { status: 400 })
    data.role = role
  }

  if (isPRN !== undefined) {
    data.isPRN = Boolean(isPRN)
  }

  if (isActive !== undefined) {
    data.isActive = Boolean(isActive)
  }

  if (newPassword !== undefined) {
    if (String(newPassword).length < 6)
      return Response.json({ error: "Password must be at least 6 characters" }, { status: 400 })
    data.password = await bcrypt.hash(String(newPassword), 10)
  }

  if (Object.keys(data).length === 0)
    return Response.json({ error: "No valid fields provided" }, { status: 400 })

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true, name: true, username: true, email: true,
      role: true, isPRN: true, isActive: true,
      shiftLengthPref: true, allowedShiftTypes: true,
      adminTargetShifts: true, adminHardCap: true,
      color: true, createdAt: true,
    },
  })

  return Response.json({ user })
}
