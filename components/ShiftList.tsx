"use client"

import { useState } from "react"

type Assignment = {
  id: string
  date: string
  shiftType: string
  isLocked: boolean
  periodId: string
  period: { id: string; month: number; year: number; status: string }
}

type PhysicianAssignment = {
  id: string
  date: string
  shiftType: string
  isLocked: boolean
}

type Physician = {
  id: string
  name: string
  assignments: PhysicianAssignment[]
}

const SHIFT_LABEL: Record<string, string> = {
  "24H":   "24-hour  9AM–9AM",
  DAY12:   "Day  9AM–9PM",
  NIGHT12: "Night  9PM–9AM",
}
const SHIFT_COLOR: Record<string, string> = {
  "24H":   "bg-blue-100 text-blue-800",
  DAY12:   "bg-amber-100 text-amber-800",
  NIGHT12: "bg-indigo-100 text-indigo-800",
}
const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00")
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
}

type OfferPanelProps = {
  assignment: Assignment
  onClose: () => void
  onSuccess: () => void
}

function OfferPanel({ assignment, onClose, onSuccess }: OfferPanelProps) {
  const [offerType, setOfferType] = useState<"PICKUP" | "TRADE">("PICKUP")
  const [note, setNote] = useState("")
  const [physicians, setPhysicians] = useState<Physician[] | null>(null)
  const [selectedPhysicianId, setSelectedPhysicianId] = useState("")
  const [selectedTargetAssignmentId, setSelectedTargetAssignmentId] = useState("")
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadPhysicians = async () => {
    if (physicians !== null) return
    setLoading(true)
    try {
      const res = await fetch("/api/shift-offers/physicians")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load physicians")
      setPhysicians(data.physicians)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleTypeChange = (type: "PICKUP" | "TRADE") => {
    setOfferType(type)
    setSelectedPhysicianId("")
    setSelectedTargetAssignmentId("")
    if (type === "TRADE") loadPhysicians()
  }

  const selectedPhysician = physicians?.find((p) => p.id === selectedPhysicianId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const body: Record<string, any> = {
      type: offerType,
      assignmentId: assignment.id,
      note: note.trim() || null,
    }

    if (offerType === "TRADE") {
      if (!selectedPhysicianId || !selectedTargetAssignmentId) {
        setError("Please select a physician and their shift for the trade.")
        setSubmitting(false)
        return
      }
      body.targetUserId = selectedPhysicianId
      body.targetAssignmentId = selectedTargetAssignmentId
    }

    try {
      const res = await fetch("/api/shift-offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to create offer")
      onSuccess()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-3 p-4 rounded-xl ring-1 ring-slate-200 bg-slate-50 space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-slate-700 text-sm">Offer Shift: {formatDate(assignment.date)}</p>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none">&times;</button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Type radio */}
        <div>
          <p className="label mb-2">Offer Type</p>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="radio"
                value="PICKUP"
                checked={offerType === "PICKUP"}
                onChange={() => handleTypeChange("PICKUP")}
                className="accent-[#0d2580]"
              />
              <span>Offer for Pickup</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="radio"
                value="TRADE"
                checked={offerType === "TRADE"}
                onChange={() => handleTypeChange("TRADE")}
                className="accent-[#0d2580]"
              />
              <span>Offer for Trade</span>
            </label>
          </div>
        </div>

        {/* Trade UI */}
        {offerType === "TRADE" && (
          <div className="space-y-3">
            <div>
              <label className="label">Select Physician to Trade With</label>
              {loading ? (
                <p className="text-sm text-slate-400">Loading physicians…</p>
              ) : (
                <select
                  className="input"
                  value={selectedPhysicianId}
                  onChange={(e) => {
                    setSelectedPhysicianId(e.target.value)
                    setSelectedTargetAssignmentId("")
                  }}
                >
                  <option value="">— Choose a physician —</option>
                  {physicians?.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}
            </div>

            {selectedPhysician && (
              <div>
                <label className="label">Select Their Shift You Want</label>
                {selectedPhysician.assignments.length === 0 ? (
                  <p className="text-sm text-slate-400">This physician has no upcoming shifts.</p>
                ) : (
                  <select
                    className="input"
                    value={selectedTargetAssignmentId}
                    onChange={(e) => setSelectedTargetAssignmentId(e.target.value)}
                  >
                    <option value="">— Choose a shift —</option>
                    {selectedPhysician.assignments.map((a) => (
                      <option key={a.id} value={a.id} disabled={a.isLocked}>
                        {new Date(a.date + "T12:00:00").toLocaleDateString("en-US", {
                          weekday: "short", month: "short", day: "numeric"
                        })} — {a.shiftType}
                        {a.isLocked ? " (locked)" : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>
        )}

        {/* Note */}
        <div>
          <label className="label">Note (optional)</label>
          <textarea
            className="input resize-none"
            rows={2}
            placeholder="Reason, details…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button type="submit" className="btn-primary text-sm py-2" disabled={submitting}>
            {submitting ? "Submitting…" : "Submit Offer"}
          </button>
          <button type="button" className="btn-secondary text-sm py-2" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

type Props = {
  assignments: Assignment[]
}

export default function ShiftList({ assignments }: Props) {
  const [openPanel, setOpenPanel] = useState<string | null>(null)
  const [successIds, setSuccessIds] = useState<Set<string>>(new Set())

  const now = new Date()
  const thisYear = now.getFullYear()
  const thisMon = now.getMonth() + 1

  // Group by period
  const byPeriod: Record<string, Assignment[]> = {}
  for (const a of assignments) {
    const key = a.period.id
    if (!byPeriod[key]) byPeriod[key] = []
    byPeriod[key].push(a)
  }

  const periods = Object.values(byPeriod)
    .map((arr) => arr[0].period)
    .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month)

  const handleSuccess = (assignmentId: string) => {
    setSuccessIds((prev) => new Set(prev).add(assignmentId))
    setOpenPanel(null)
  }

  if (periods.length === 0) {
    return (
      <div className="card text-center py-10 text-slate-400">
        No shifts scheduled yet.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {periods.map((period) => {
        const shifts = byPeriod[period.id]
        const isPast = period.year < thisYear || (period.year === thisYear && period.month < thisMon)
        return (
          <div key={period.id} className="card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">
                {MONTH_NAMES[period.month]} {period.year}
                {isPast && <span className="ml-2 text-xs text-slate-400">(past)</span>}
              </h2>
              <span className="text-sm text-slate-500">{shifts.length} shift{shifts.length !== 1 ? "s" : ""}</span>
            </div>

            <div className="space-y-1.5">
              {shifts.map((a) => {
                const d = new Date(a.date + "T12:00:00")
                const isToday = d.toDateString() === new Date().toDateString()
                const isFuture = !isPast || d >= new Date(new Date().setHours(0, 0, 0, 0))
                const offerSuccess = successIds.has(a.id)

                return (
                  <div key={a.id}>
                    <div
                      className={`flex items-center justify-between px-3 py-2.5 rounded-lg ${
                        isToday ? "bg-blue-50 ring-2 ring-blue-300" : "bg-slate-50"
                      }`}
                    >
                      <div>
                        <p className="font-medium text-slate-700 text-sm">
                          {isToday && <span className="text-blue-600 mr-1">●</span>}
                          {d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">{SHIFT_LABEL[a.shiftType]}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${SHIFT_COLOR[a.shiftType]}`}>
                          {a.shiftType}
                        </span>
                        {isFuture && !isPast && !a.isLocked && period.status === "PUBLISHED" && (
                          offerSuccess ? (
                            <span className="text-xs text-green-600 font-medium">Offered ✓</span>
                          ) : openPanel === a.id ? null : (
                            <button
                              className="text-xs btn-secondary py-1 px-2"
                              onClick={() => setOpenPanel(a.id)}
                            >
                              Offer Shift
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    {openPanel === a.id && (
                      <OfferPanel
                        assignment={a}
                        onClose={() => setOpenPanel(null)}
                        onSuccess={() => handleSuccess(a.id)}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
