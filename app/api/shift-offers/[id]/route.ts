import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

// PATCH /api/shift-offers/[id]
// Body: { action: "cancel" | "request" | "accept" | "reject" | "approve" | "deny" }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const userId = (session.user as any).id
  const role = (session.user as any).role

  const body = await req.json()
  const { action } = body

  if (!action) return Response.json({ error: "action is required" }, { status: 400 })

  const offer = await prisma.shiftOffer.findUnique({
    where: { id },
    include: {
      assignment: true,
      targetAssignment: true,
    },
  })

  if (!offer) return Response.json({ error: "Offer not found" }, { status: 404 })

  // Read approval setting
  const approvalSetting = await prisma.adminSetting.findUnique({
    where: { key: "shiftOfferApproval" },
  })
  const requiresApproval = approvalSetting ? approvalSetting.value !== "false" : true

  if (action === "cancel") {
    // Only the offering user can cancel their own offer
    if (offer.offeringUserId !== userId) {
      return Response.json({ error: "You can only cancel your own offers" }, { status: 403 })
    }
    if (offer.status !== "PENDING") {
      return Response.json({ error: "Only PENDING offers can be cancelled" }, { status: 409 })
    }
    const updated = await prisma.shiftOffer.update({
      where: { id },
      data: { status: "CANCELLED" },
    })
    return Response.json({ offer: updated })
  }

  if (action === "request") {
    // A physician requesting to pick up a PICKUP offer
    if (offer.type !== "PICKUP") {
      return Response.json({ error: "Can only request PICKUP offers" }, { status: 400 })
    }
    if (offer.status !== "PENDING") {
      return Response.json({ error: "Offer is no longer available" }, { status: 409 })
    }
    if (offer.offeringUserId === userId) {
      return Response.json({ error: "You cannot pick up your own shift" }, { status: 403 })
    }

    if (!requiresApproval) {
      // Immediately transfer the assignment
      await prisma.shiftAssignment.update({
        where: { id: offer.assignmentId },
        data: { userId },
      })
      const updated = await prisma.shiftOffer.update({
        where: { id },
        data: { status: "COMPLETED", requestedByUserId: userId },
      })
      return Response.json({ offer: updated })
    } else {
      // Set status to ACCEPTED, record who requested
      const updated = await prisma.shiftOffer.update({
        where: { id },
        data: { status: "ACCEPTED", requestedByUserId: userId },
      })
      return Response.json({ offer: updated })
    }
  }

  if (action === "accept") {
    // Trade target accepting the trade
    if (offer.type !== "TRADE") {
      return Response.json({ error: "Only TRADE offers can be accepted this way" }, { status: 400 })
    }
    if (offer.targetUserId !== userId) {
      return Response.json({ error: "Only the trade target can accept" }, { status: 403 })
    }
    if (offer.status !== "PENDING") {
      return Response.json({ error: "Offer is no longer pending" }, { status: 409 })
    }

    if (!requiresApproval) {
      // Swap the two assignments immediately
      const offeringAssignment = offer.assignment
      const targetAssignment = offer.targetAssignment
      if (!targetAssignment) {
        return Response.json({ error: "Target assignment missing" }, { status: 400 })
      }
      await prisma.$transaction([
        prisma.shiftAssignment.update({
          where: { id: offeringAssignment.id },
          data: { userId: targetAssignment.userId },
        }),
        prisma.shiftAssignment.update({
          where: { id: targetAssignment.id },
          data: { userId: offeringAssignment.userId },
        }),
      ])
      const updated = await prisma.shiftOffer.update({
        where: { id },
        data: { status: "COMPLETED" },
      })
      return Response.json({ offer: updated })
    } else {
      // Set to ACCEPTED, awaiting admin approval
      const updated = await prisma.shiftOffer.update({
        where: { id },
        data: { status: "ACCEPTED" },
      })
      return Response.json({ offer: updated })
    }
  }

  if (action === "reject") {
    // Trade target rejecting the trade
    if (offer.type !== "TRADE") {
      return Response.json({ error: "Only TRADE offers can be rejected" }, { status: 400 })
    }
    if (offer.targetUserId !== userId) {
      return Response.json({ error: "Only the trade target can reject" }, { status: 403 })
    }
    if (offer.status !== "PENDING") {
      return Response.json({ error: "Offer is no longer pending" }, { status: 409 })
    }
    const updated = await prisma.shiftOffer.update({
      where: { id },
      data: { status: "CANCELLED" },
    })
    return Response.json({ offer: updated })
  }

  if (action === "approve") {
    // Admin approving an ACCEPTED offer
    if (role !== "ADMIN") {
      return Response.json({ error: "Admin only" }, { status: 403 })
    }
    if (offer.status !== "ACCEPTED") {
      return Response.json({ error: "Only ACCEPTED offers can be approved" }, { status: 409 })
    }

    if (offer.type === "PICKUP") {
      if (!offer.requestedByUserId) {
        return Response.json({ error: "No requester on pickup offer" }, { status: 400 })
      }
      await prisma.shiftAssignment.update({
        where: { id: offer.assignmentId },
        data: { userId: offer.requestedByUserId },
      })
    } else if (offer.type === "TRADE") {
      const targetAssignment = offer.targetAssignment
      if (!targetAssignment) {
        return Response.json({ error: "Target assignment missing" }, { status: 400 })
      }
      await prisma.$transaction([
        prisma.shiftAssignment.update({
          where: { id: offer.assignment.id },
          data: { userId: targetAssignment.userId },
        }),
        prisma.shiftAssignment.update({
          where: { id: targetAssignment.id },
          data: { userId: offer.assignment.userId },
        }),
      ])
    }

    const updated = await prisma.shiftOffer.update({
      where: { id },
      data: { status: "COMPLETED" },
    })
    return Response.json({ offer: updated })
  }

  if (action === "deny") {
    // Admin denying an offer
    if (role !== "ADMIN") {
      return Response.json({ error: "Admin only" }, { status: 403 })
    }
    if (offer.status !== "ACCEPTED") {
      return Response.json({ error: "Only ACCEPTED offers can be denied" }, { status: 409 })
    }
    const updated = await prisma.shiftOffer.update({
      where: { id },
      data: { status: "DENIED" },
    })
    return Response.json({ offer: updated })
  }

  return Response.json({ error: "Unknown action" }, { status: 400 })
}
