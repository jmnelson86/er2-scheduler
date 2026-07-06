"use client"

import { useState } from "react"

// ─── Types ────────────────────────────────────────────────────────────────────

type Assignment = {
  id:           string
  date:         string
  shiftType:    string
  isLocked:     boolean
  isConflict:   boolean
  conflictNote: string | null
  periodId:     string
  period:       { id: string; month: number; year: number; status: string }
  offer:        { status: string } | null
}

type PhysicianAssignment = {
  id:        string
  date:      string
  shiftType: string
  isLocked:  boolean
}

type Physician = {
  id:          string
  name:        string
  assignments: PhysicianAssignment[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "", "January","February","March","April","May","June",
  "July","August","September","October","November","December",
]

const SHIFT_LABEL: Record<string, string> = {
  "24H":    "24-Hour  (9AM–9AM)",
  "DAY12":  "Day  (9AM–9PM)",
  "NIGHT12":"Night  (9PM–9AM)",
}

const SHIFT_SHORT: Record<string, string> = {
  "24H":    "24H",
  "DAY12":  "Day",
  "NIGHT12":"Night",
}

// Tailwind classes for each shift type
const SHIFT_CHIP: Record<string, string> = {
  "24H":    "bg-blue-200 text-blue-950 ring-blue-300",
  "DAY12":  "bg-amber-200 text-amber-950 ring-amber-300",
  "NIGHT12":"bg-indigo-200 text-indigo-950 ring-indigo-300",
}

const SHIFT_DOT: Record<string, string> = {
  "24H":    "bg-blue-500",
  "DAY12":  "bg-amber-500",
  "NIGHT12":"bg-indigo-500",
}

// ─── Offer Panel ──────────────────────────────────────────────────────────────

type OfferPanelProps = {
  assignment: Assignment
  onClose:    () => void
  onSuccess:  () => void
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

  const d = new Date(assignment.date + "T12:00:00")
  const dateLabel = d.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  })

  const loadPhysicians = async () => {
    if (physicians !== null) return
    setLoading(true)
    try {
      const res  = await fetch("/api/shift-offers/physicians")
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
      type:         offerType,
      assignmentId: assignment.id,
      note:         note.trim() || null,
    }

    if (offerType === "TRADE") {
      if (!selectedPhysicianId || !selectedTargetAssignmentId) {
        setError("Please select a physician and their shift for the trade.")
        setSubmitting(false)
        return
      }
      body.targetUserId         = selectedPhysicianId
      body.targetAssignmentId   = selectedTargetAssignmentId
    }

    try {
      const res  = await fetch("/api/shift-offers", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
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
    /* Modal overlay */
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-slate-900 text-lg">Offer Shift</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
        </div>

        {/* Shift summary */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 ring-1 ring-slate-100">
          <span className={`w-3 h-3 rounded-full shrink-0 ${SHIFT_DOT[assignment.shiftType] ?? "bg-slate-400"}`} />
          <div>
            <p className="text-sm font-semibold text-slate-800">{dateLabel}</p>
            <p className="text-xs text-slate-500">{SHIFT_LABEL[assignment.shiftType] ?? assignment.shiftType}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Offer type */}
          <div>
            <p className="label mb-2">Offer Type</p>
            <div className="flex gap-3">
              {(["PICKUP","TRADE"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleTypeChange(t)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border transition ${
                    offerType === t
                      ? "bg-[#0d2580] text-white border-[#0d2580]"
                      : "bg-white text-slate-700 border-slate-300 hover:border-blue-400"
                  }`}
                >
                  {t === "PICKUP" ? "Open Pickup" : "Propose Trade"}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              {offerType === "PICKUP"
                ? "Any available physician can request to pick up this shift."
                : "Propose swapping your shift with another physician's shift."}
            </p>
          </div>

          {/* Trade fields */}
          {offerType === "TRADE" && (
            <div className="space-y-3">
              <div>
                <label className="label">Select Physician to Trade With</label>
                {loading ? (
                  <p className="text-sm text-slate-400 animate-pulse">Loading physicians…</p>
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
                    <p className="text-sm text-slate-400">No upcoming shifts found.</p>
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
                            weekday: "short", month: "short", day: "numeric",
                          })}{" "}— {SHIFT_SHORT[a.shiftType] ?? a.shiftType}
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

          <div className="flex gap-3">
            <button type="button" className="btn-secondary flex-1 py-2.5" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1 py-2.5" disabled={submitting}>
              {submitting ? "Submitting…" : "Create Offer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Calendar Grid ────────────────────────────────────────────────────────────

type CalendarProps = {
  period:      { id: string; month: number; year: number; status: string }
  assignments: Assignment[]
  isPast:      boolean
  onOffer:     (a: Assignment) => void
  successIds:  Set<string>
}

function MonthCalendar({ period, assignments, isPast, onOffer, successIds }: CalendarProps) {
  const { month, year } = period

  // Build lookup: date → Assignment
  const byDate = new Map<string, Assignment>()
  for (const a of assignments) byDate.set(a.date, a)

  // Calendar math
  const firstDay  = new Date(year, month - 1, 1)
  const daysInMonth = new Date(year, month, 0).getDate()
  const startPad    = firstDay.getDay()   // 0 = Sunday
  const todayStr    = new Date().toISOString().slice(0, 10)

  const totalShifts = assignments.length
  const offeredCount = assignments.filter(
    (a) => a.offer && ["PENDING","ACCEPTED"].includes(a.offer.status)
  ).length

  return (
    <div className="card space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-semibold text-slate-800 text-base">
            {MONTH_NAMES[month]} {year}
            {isPast && <span className="ml-2 text-xs text-slate-400 font-normal">(past)</span>}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {totalShifts} shift{totalShifts !== 1 ? "s" : ""}
            {offeredCount > 0 && ` · ${offeredCount} offered`}
          </p>
        </div>
        <div className="flex gap-3 text-xs text-slate-500">
          {Object.entries(SHIFT_SHORT).map(([key, label]) => (
            <span key={key} className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${SHIFT_DOT[key]}`} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 text-center text-xs font-bold text-slate-600 border-b border-slate-200 pb-1">
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {/* Leading empty cells */}
        {Array.from({ length: startPad }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}

        {/* Day cells */}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const mm      = String(month).padStart(2, "0")
          const dd      = String(day).padStart(2, "0")
          const dateStr = `${year}-${mm}-${dd}`
          const assignment = byDate.get(dateStr)
          const isToday  = dateStr === todayStr
          const isFuture = dateStr >= todayStr
          const isWeekend = new Date(year, month - 1, day).getDay() % 6 === 0

          // Offer state
          const activeOffer = assignment?.offer &&
            ["PENDING","ACCEPTED"].includes(assignment.offer.status)
          const offerDone = assignment ? successIds.has(assignment.id) : false
          const canOffer  = !isPast && isFuture && !assignment?.isLocked &&
                            period.status === "PUBLISHED" && !activeOffer && !offerDone

          return (
            <div
              key={dateStr}
              className={`
                min-h-[84px] rounded-lg p-1.5 flex flex-col gap-1 transition
                ${isToday       ? "ring-2 ring-[#0d2580] bg-blue-50"  : ""}
                ${isWeekend && !isToday ? "bg-slate-50/70" : ""}
                ${!isWeekend && !isToday ? "bg-white" : ""}
              `}
            >
              {/* Day number */}
              <span className={`text-sm font-bold leading-none ${
                isToday    ? "text-[#0d2580]"  :
                isWeekend  ? "text-slate-500"  :
                             "text-slate-700"
              }`}>
                {day}
              </span>

              {/* Shift chip */}
              {assignment && (
                <div className="flex flex-col gap-1 flex-1">
                  <span
                    className={`
                      px-1.5 py-0.5 rounded text-xs font-bold ring-1 leading-tight
                      ${SHIFT_CHIP[assignment.shiftType] ?? "bg-slate-100 text-slate-700 ring-slate-200"}
                      ${assignment.isConflict ? "ring-amber-400 ring-2" : ""}
                    `}
                  >
                    {assignment.isConflict && <span className="mr-0.5">⚠</span>}
                    {SHIFT_SHORT[assignment.shiftType] ?? assignment.shiftType}
                    {assignment.isLocked && <span className="ml-0.5 opacity-50">🔒</span>}
                  </span>

                  {/* Offer affordance */}
                  {canOffer && (
                    <button
                      type="button"
                      onClick={() => onOffer(assignment)}
                      className="text-[9px] font-medium text-blue-600 hover:text-blue-800 text-left leading-tight mt-auto transition"
                    >
                      Offer →
                    </button>
                  )}

                  {(activeOffer || offerDone) && (
                    <span className="text-[9px] font-medium text-amber-600 leading-tight">
                      {offerDone ? "Offered ✓" : `${assignment.offer!.status.toLowerCase()}`}
                    </span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

type Props = {
  assignments: Assignment[]
}

export default function MyScheduleCalendar({ assignments }: Props) {
  const [offerTarget, setOfferTarget] = useState<Assignment | null>(null)
  const [successIds, setSuccessIds]   = useState<Set<string>>(new Set())

  const now      = new Date()
  const thisYear = now.getFullYear()
  const thisMon  = now.getMonth() + 1

  // Group by period
  const byPeriod: Record<string, Assignment[]> = {}
  for (const a of assignments) {
    if (!byPeriod[a.period.id]) byPeriod[a.period.id] = []
    byPeriod[a.period.id].push(a)
  }

  const periods = Object.values(byPeriod)
    .map((arr) => arr[0].period)
    .sort((a, b) => a.year !== b.year ? b.year - a.year : b.month - a.month)

  const handleSuccess = (assignmentId: string) => {
    setSuccessIds((prev) => new Set(prev).add(assignmentId))
    setOfferTarget(null)
  }

  if (periods.length === 0) {
    return (
      <div className="card text-center py-12 text-slate-400 text-sm">
        No shifts scheduled yet.
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6">
        {periods.map((period) => {
          const isPast =
            period.year < thisYear ||
            (period.year === thisYear && period.month < thisMon)

          return (
            <MonthCalendar
              key={period.id}
              period={period}
              assignments={byPeriod[period.id]}
              isPast={isPast}
              onOffer={setOfferTarget}
              successIds={successIds}
            />
          )
        })}
      </div>

      {offerTarget && (
        <OfferPanel
          assignment={offerTarget}
          onClose={() => setOfferTarget(null)}
          onSuccess={() => handleSuccess(offerTarget.id)}
        />
      )}
    </>
  )
}
