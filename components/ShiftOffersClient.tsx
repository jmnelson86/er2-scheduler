"use client"

import { useEffect, useState, useCallback } from "react"

type ShiftAssignmentMin = {
  id: string
  date: string
  shiftType: string
  period?: { month: number; year: number }
}

type ShiftOffer = {
  id: string
  type: "PICKUP" | "TRADE"
  status: string
  offeringUserId: string
  offeringUser: { id: string; name: string }
  targetUser: { id: string; name: string } | null
  requestedByUser: { id: string; name: string } | null
  assignment: ShiftAssignmentMin & { period?: { month: number; year: number } }
  targetAssignment: ShiftAssignmentMin | null
  note: string | null
}

const MONTH_NAMES = [
  "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

const SHIFT_COLOR: Record<string, string> = {
  "24H":   "bg-blue-100 text-blue-800",
  DAY12:   "bg-amber-100 text-amber-800",
  NIGHT12: "bg-indigo-100 text-indigo-800",
}

const STATUS_COLOR: Record<string, string> = {
  PENDING:   "bg-yellow-100 text-yellow-800",
  ACCEPTED:  "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-slate-100 text-slate-500",
  DENIED:    "bg-red-100 text-red-800",
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00")
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
}

export default function ShiftOffersClient({ userId }: { userId: string }) {
  const [offers, setOffers] = useState<ShiftOffer[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchOffers = useCallback(async () => {
    try {
      const res = await fetch("/api/shift-offers")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to fetch")
      setOffers(data.offers)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchOffers() }, [fetchOffers])

  const doAction = async (offerId: string, action: string) => {
    setActionLoading(offerId + action)
    try {
      const res = await fetch(`/api/shift-offers/${offerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Action failed")
      await fetchOffers()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) return <div className="card text-center py-10 text-slate-400">Loading offers…</div>
  if (error) return <div className="card text-center py-10 text-red-500">{error}</div>

  // Split into categories
  const openPickups = offers.filter(
    (o) => o.type === "PICKUP" && o.status === "PENDING" && o.offeringUserId !== userId
  )
  const myOffers = offers.filter((o) => o.offeringUserId === userId && o.status !== "CANCELLED")
  const incomingTrades = offers.filter(
    (o) => o.type === "TRADE" && o.targetUser?.id === userId && o.status === "PENDING"
  )

  return (
    <div className="space-y-8">
      {/* Open Pickup Offers */}
      <section>
        <h2 className="font-semibold text-slate-800 mb-3">Open Pickup Offers</h2>
        {openPickups.length === 0 ? (
          <div className="card text-center py-8 text-slate-400 text-sm">
            No open pickup offers right now.
          </div>
        ) : (
          <div className="space-y-2">
            {openPickups.map((offer) => {
              const alreadyRequested = offer.requestedByUser?.id === userId
              return (
                <div key={offer.id} className="card flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="font-medium text-slate-700 text-sm">
                      {formatDate(offer.assignment.date)}
                      {" · "}
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${SHIFT_COLOR[offer.assignment.shiftType]}`}>
                        {offer.assignment.shiftType}
                      </span>
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Offered by {offer.offeringUser.name}
                      {offer.note && <span className="ml-1 italic">— "{offer.note}"</span>}
                    </p>
                  </div>
                  {alreadyRequested ? (
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                      Requested
                    </span>
                  ) : (
                    <button
                      className="btn-primary text-xs py-1.5 px-3"
                      disabled={actionLoading === offer.id + "request"}
                      onClick={() => doAction(offer.id, "request")}
                    >
                      {actionLoading === offer.id + "request" ? "…" : "Request Pickup"}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* My Offers */}
      <section>
        <h2 className="font-semibold text-slate-800 mb-3">My Offers &amp; Incoming Trades</h2>

        {myOffers.length === 0 && incomingTrades.length === 0 ? (
          <div className="card text-center py-8 text-slate-400 text-sm">
            No active offers or incoming trades.
          </div>
        ) : (
          <div className="space-y-2">
            {/* My own offers */}
            {myOffers.map((offer) => (
              <div key={offer.id} className="card flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-slate-700 text-sm">
                      {formatDate(offer.assignment.date)}
                      {" · "}
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${SHIFT_COLOR[offer.assignment.shiftType]}`}>
                        {offer.assignment.shiftType}
                      </span>
                    </p>
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                      {offer.type}
                    </span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[offer.status]}`}>
                      {offer.status}
                    </span>
                  </div>
                  {offer.type === "TRADE" && offer.targetUser && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      Trade with {offer.targetUser.name}
                      {offer.targetAssignment && (
                        <> for their {formatDate(offer.targetAssignment.date)} {offer.targetAssignment.shiftType}</>
                      )}
                    </p>
                  )}
                  {offer.status === "ACCEPTED" && offer.type === "PICKUP" && offer.requestedByUser && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      Requested by {offer.requestedByUser.name} — awaiting admin approval
                    </p>
                  )}
                  {offer.note && (
                    <p className="text-xs text-slate-400 mt-0.5 italic">"{offer.note}"</p>
                  )}
                </div>
                {offer.status === "PENDING" && (
                  <button
                    className="btn-danger text-xs py-1.5 px-3"
                    disabled={actionLoading === offer.id + "cancel"}
                    onClick={() => doAction(offer.id, "cancel")}
                  >
                    {actionLoading === offer.id + "cancel" ? "…" : "Cancel"}
                  </button>
                )}
              </div>
            ))}

            {/* Incoming trade offers */}
            {incomingTrades.map((offer) => (
              <div key={offer.id} className="card border-l-4 flex items-center justify-between flex-wrap gap-3"
                style={{ borderLeftColor: "#0d2580" }}>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Incoming Trade Request</p>
                  <p className="font-medium text-slate-700 text-sm">
                    {offer.offeringUser.name} offers their{" "}
                    <span className="font-semibold">{formatDate(offer.assignment.date)}</span>{" "}
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${SHIFT_COLOR[offer.assignment.shiftType]}`}>
                      {offer.assignment.shiftType}
                    </span>
                  </p>
                  {offer.targetAssignment && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      In exchange for your{" "}
                      <span className="font-semibold">{formatDate(offer.targetAssignment.date)}</span>{" "}
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${SHIFT_COLOR[offer.targetAssignment.shiftType]}`}>
                        {offer.targetAssignment.shiftType}
                      </span>
                    </p>
                  )}
                  {offer.note && (
                    <p className="text-xs text-slate-400 mt-0.5 italic">"{offer.note}"</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    className="btn-primary text-xs py-1.5 px-3"
                    disabled={!!actionLoading}
                    onClick={() => doAction(offer.id, "accept")}
                  >
                    {actionLoading === offer.id + "accept" ? "…" : "Accept"}
                  </button>
                  <button
                    className="btn-danger text-xs py-1.5 px-3"
                    disabled={!!actionLoading}
                    onClick={() => doAction(offer.id, "reject")}
                  >
                    {actionLoading === offer.id + "reject" ? "…" : "Reject"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
