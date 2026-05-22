import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { sendShiftOfferEmail } from "@/lib/email"

// GET /api/shift-offers
// Returns offers relevant to current user:
//   - Their own offers
//   - Open PICKUP offers from others (PENDING)
//   - TRADE offers targeting them
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const userId = (session.user as any).id

  const offers = await prisma.shiftOffer.findMany({
    where: {
      OR: [
        { offeringUserId: userId },
        { type: "PICKUP", status: "PENDING" },
        { type: "TRADE", targetUserId: userId },
      ],
    },
    include: {
      offeringUser: { select: { id: true, name: true } },
      targetUser:   { select: { id: true, name: true } },
      requestedByUser: { select: { id: true, name: true } },
      assignment: true,
      targetAssignment: true,
    },
    orderBy: { createdAt: "desc" },
  })

  return Response.json({ offers })
}

// POST /api/shift-offers
// Body: { type, assignmentId, targetUserId?, targetAssignmentId?, note? }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const userId = (session.user as any).id
  const body = await req.json()
  const { type, assignmentId, targetUserId, targetAssignmentId, note } = body

  if (!type || !assignmentId) {
    return Response.json({ error: "type and assignmentId are required" }, { status: 400 })
  }
  if (type !== "PICKUP" && type !== "TRADE") {
    return Response.json({ error: "type must be PICKUP or TRADE" }, { status: 400 })
  }
  if (type === "TRADE" && (!targetUserId || !targetAssignmentId)) {
    return Response.json({ error: "TRADE requires targetUserId and targetAssignmentId" }, { status: 400 })
  }

  // Verify the assignment belongs to this physician
  const assignment = await prisma.shiftAssignment.findUnique({
    where: { id: assignmentId },
  })
  if (!assignment) return Response.json({ error: "Assignment not found" }, { status: 404 })
  if (assignment.userId !== userId) {
    return Response.json({ error: "You can only offer your own shifts" }, { status: 403 })
  }
  if (assignment.isLocked) {
    return Response.json({ error: "Locked shifts cannot be offered" }, { status: 403 })
  }

  // Check no active offer already exists for this assignment
  const existingOffer = await prisma.shiftOffer.findFirst({
    where: {
      assignmentId,
      status: { in: ["PENDING", "ACCEPTED"] },
    },
  })
  if (existingOffer) {
    return Response.json({ error: "This shift already has an active offer" }, { status: 409 })
  }

  // For TRADE, verify target assignment exists and belongs to target user
  if (type === "TRADE") {
    const targetAssignment = await prisma.shiftAssignment.findUnique({
      where: { id: targetAssignmentId },
    })
    if (!targetAssignment) {
      return Response.json({ error: "Target assignment not found" }, { status: 404 })
    }
    if (targetAssignment.userId !== targetUserId) {
      return Response.json({ error: "Target assignment does not belong to target physician" }, { status: 400 })
    }
    // Check no active offer on the target assignment
    const existingTargetOffer = await prisma.shiftOffer.findFirst({
      where: {
        assignmentId: targetAssignmentId,
        status: { in: ["PENDING", "ACCEPTED"] },
      },
    })
    if (existingTargetOffer) {
      return Response.json({ error: "The target shift already has an active offer" }, { status: 409 })
    }
  }

  const offer = await prisma.shiftOffer.create({
    data: {
      type,
      offeringUserId: userId,
      assignmentId,
      targetUserId: targetUserId ?? null,
      targetAssignmentId: targetAssignmentId ?? null,
      note: note ?? null,
    },
    include: {
      offeringUser:     { select: { id: true, name: true } },
      targetUser:       { select: { id: true, name: true } },
      assignment:       true,
      targetAssignment: true,
    },
  })

  // Send email notification (fire and forget — don't block response)
  if (offer.type === "TRADE" && offer.targetUser) {
    const target = await prisma.user.findUnique({ where: { id: offer.targetUserId! }, select: { email: true } })
    if (target?.email) {
      sendShiftOfferEmail({
        toEmail: target.email,
        toName: offer.targetUser.name,
        offeringName: offer.offeringUser.name,
        date: offer.assignment.date,
        shiftType: offer.assignment.shiftType,
        offerType: "TRADE",
      }).catch(console.error)
    }
  } else if (offer.type === "PICKUP") {
    // Notify all physicians with emails about the open pickup
    const physicians = await prisma.user.findMany({
      where: { role: "PHYSICIAN", isActive: true, email: { not: null }, id: { not: offer.offeringUserId } },
      select: { email: true, name: true },
    })
    for (const p of physicians) {
      if (p.email) {
        sendShiftOfferEmail({
          toEmail: p.email,
          toName: p.name,
          offeringName: offer.offeringUser.name,
          date: offer.assignment.date,
          shiftType: offer.assignment.shiftType,
          offerType: "PICKUP",
        }).catch(console.error)
      }
    }
  }

  return Response.json({ offer }, { status: 201 })
}
