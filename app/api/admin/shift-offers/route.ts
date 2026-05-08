import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

// GET /api/admin/shift-offers
// Returns all non-CANCELLED offers with full details
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if ((session.user as any).role !== "ADMIN") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const offers = await prisma.shiftOffer.findMany({
    where: { status: { not: "CANCELLED" } },
    include: {
      offeringUser:    { select: { id: true, name: true } },
      targetUser:      { select: { id: true, name: true } },
      requestedByUser: { select: { id: true, name: true } },
      assignment: {
        include: { period: { select: { month: true, year: true } } },
      },
      targetAssignment: {
        select: { id: true, date: true, shiftType: true },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return Response.json({ offers })
}

// PATCH /api/admin/shift-offers
// Body: { id, action: "approve" | "deny" }
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if ((session.user as any).role !== "ADMIN") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const { id, action } = body

  if (!id || !action) {
    return Response.json({ error: "id and action are required" }, { status: 400 })
  }

  const offer = await prisma.shiftOffer.findUnique({
    where: { id },
    include: { assignment: true, targetAssignment: true },
  })

  if (!offer) return Response.json({ error: "Offer not found" }, { status: 404 })
  if (offer.status !== "ACCEPTED") {
    return Response.json({ error: "Only ACCEPTED offers can be approved or denied" }, { status: 409 })
  }

  if (action === "approve") {
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
    const updated = await prisma.shiftOffer.update({
      where: { id },
      data: { status: "DENIED" },
    })
    return Response.json({ offer: updated })
  }

  return Response.json({ error: "Unknown action" }, { status: 400 })
}
