"use client"

import { useState } from "react"
import { getDaysInMonth, format } from "date-fns"

interface Physician {
  id:    string
  name:  string
  isPRN: boolean
  prefersTwelveHour: boolean
}

interface Assignment {
  id:          string
  date:        string
  shiftType:   string
  userId:      string | null
  isLocked:    boolean
  isConflict:  boolean
  conflictNote: string
  user: Physician | null
}

interface Props {
  year:       number
  month:      number
  assignments: Assignment[]
  physicians:  Physician[]
  onReassign: (assignmentId: string, userId: string | null) => Promise<void>
  onToggleLock: (assignmentId: string) => Promise<void>
}

const SHIFT_SHORT: Record<string, string> = {
  "24H":   "24H",
  DAY12:   "DAY",
  NIGHT12: "NGT",
}
const SHIFT_COLOR: Record<string, string> = {
  "24H":   "bg-blue-100 text-blue-900 ring-blue-200",
  DAY12:   "bg-amber-100 text-amber-900 ring-amber-200",
  NIGHT12: "bg-indigo-100 text-indigo-900 ring-indigo-200",
}

const PHYSICIAN_COLORS = [
  "bg-sky-500",      "bg-emerald-500", "bg-violet-500",  "bg-rose-500",
  "bg-amber-500",    "bg-teal-500",    "bg-pink-500",    "bg-indigo-500",
  "bg-lime-500",     "bg-cyan-500",    "bg-fuchsia-500", "bg-orange-500",
  "bg-green-600",    "bg-blue-600",
]

const MONTH_NAMES = [
  "","January","February","March","April","May","June",
  "July","August","September","October","November","December",
]

export default function ScheduleGrid({
  year, month, assignments, physicians, onReassign, onToggleLock,
}: Props) {
  const [openCell, setOpenCell]   = useState<string | null>(null)  // assignmentId
  const [saving,   setSaving]     = useState<string | null>(null)

  const physColorMap: Record<string, string> = {}
  physicians.forEach((p, i) => {
    physColorMap[p.id] = PHYSICIAN_COLORS[i % PHYSICIAN_COLORS.length]
  })

  const daysInMonth = getDaysInMonth(new Date(year, month - 1))

  // Build map: date → assignments (sorted: 24H first, then DAY12, then NIGHT12)
  const byDate: Record<string, Assignment[]> = {}
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    byDate[dateStr] = []
  }
  for (const a of assignments) {
    if (byDate[a.date]) byDate[a.date].push(a)
  }
  // Sort each day's assignments: 24H, DAY12, NIGHT12
  const ORDER = { "24H": 0, DAY12: 1, NIGHT12: 2 }
  for (const dateStr of Object.keys(byDate)) {
    byDate[dateStr].sort((a, b) => (ORDER[a.shiftType as keyof typeof ORDER] ?? 0) - (ORDER[b.shiftType as keyof typeof ORDER] ?? 0))
  }

  async function handleReassign(assignmentId: string, userId: string | null) {
    setSaving(assignmentId)
    await onReassign(assignmentId, userId)
    setSaving(null)
    setOpenCell(null)
  }

  async function handleLock(assignmentId: string) {
    setSaving(assignmentId)
    await onToggleLock(assignmentId)
    setSaving(null)
  }

  const days = Object.keys(byDate).sort()

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">
        Click a cell to reassign. 🔒 = manually locked.
      </p>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs mb-4">
        {[
          { key: "24H",    label: "24H (9AM–9AM)" },
          { key: "DAY12",  label: "DAY 12h (9AM–9PM)" },
          { key: "NIGHT12",label: "NGT 12h (9PM–9AM)" },
        ].map((s) => (
          <span key={s.key} className={`flex items-center gap-1 px-2 py-1 rounded-full ring-1 ${SHIFT_COLOR[s.key]}`}>
            {s.label}
          </span>
        ))}
      </div>

      {/* Grid */}
      <div className="space-y-1">
        {days.map((dateStr) => {
          const dayAssignments = byDate[dateStr]
          const d = new Date(dateStr + "T12:00:00")
          const dow = d.getDay()
          const isWeekend = dow === 0 || dow === 6
          const dayNum = d.getDate()
          const dayName = d.toLocaleDateString("en-US", { weekday: "short" })

          return (
            <div
              key={dateStr}
              className={`flex items-stretch gap-1 rounded-lg px-2 py-1.5 ${
                isWeekend ? "bg-slate-100" : "bg-white ring-1 ring-slate-100"
              }`}
            >
              {/* Date label */}
              <div className="w-16 shrink-0 flex flex-col justify-center">
                <span className={`text-xs font-semibold ${isWeekend ? "text-slate-500" : "text-slate-700"}`}>
                  {dayName} {dayNum}
                </span>
              </div>

              {/* Shift cells */}
              <div className="flex flex-1 flex-wrap gap-1.5">
                {dayAssignments.length === 0 ? (
                  <span className="text-xs text-slate-300 italic flex items-center">No coverage</span>
                ) : (
                  dayAssignments.map((a) => {
                    const isOpen = openCell === a.id
                    const isSaving = saving === a.id
                    const doc = a.user

                    return (
                      <div key={a.id} className="relative">
                        {/* Cell */}
                        <button
                          type="button"
                          onClick={() => setOpenCell(isOpen ? null : a.id)}
                          className={`
                            flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                            ring-1 transition select-none
                            ${a.isConflict
                              ? "bg-red-100 text-red-800 ring-red-300"
                              : SHIFT_COLOR[a.shiftType]}
                            ${isOpen ? "ring-2 ring-blue-500 shadow-md" : "hover:opacity-80"}
                          `}
                        >
                          {a.isLocked && <span className="text-[10px]">🔒</span>}
                          {isSaving && <span className="text-[10px] animate-spin">⟳</span>}
                          <span className="font-mono text-[10px] opacity-60">{SHIFT_SHORT[a.shiftType]}</span>
                          {doc ? (
                            <>
                              <span className={`w-3.5 h-3.5 rounded-full ${physColorMap[doc.id]} shrink-0`} />
                              <span>{doc.name.replace("Dr. ", "")}</span>
                              {doc.isPRN && <span className="text-[9px] opacity-60">PRN</span>}
                            </>
                          ) : (
                            <span className="text-red-600">⚠ Unassigned</span>
                          )}
                        </button>

                        {/* Dropdown */}
                        {isOpen && (
                          <div className="absolute top-full left-0 mt-1 z-50 bg-white rounded-xl shadow-xl ring-1 ring-slate-200 min-w-[220px] overflow-hidden">
                            <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
                              <p className="text-xs font-semibold text-slate-700">
                                {format(new Date(dateStr + "T12:00:00"), "EEE, MMM d")} – {a.shiftType}
                              </p>
                              {a.isConflict && (
                                <p className="text-xs text-red-600 mt-0.5">{a.conflictNote}</p>
                              )}
                            </div>

                            {/* Lock toggle */}
                            <button
                              type="button"
                              onClick={() => handleLock(a.id)}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 text-slate-600 border-b border-slate-100"
                            >
                              {a.isLocked ? "🔓 Unlock assignment" : "🔒 Lock assignment"}
                            </button>

                            {/* Unassign */}
                            <button
                              type="button"
                              onClick={() => handleReassign(a.id, null)}
                              className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 border-b border-slate-100"
                            >
                              ✕ Leave unassigned
                            </button>

                            {/* Physician groups */}
                            {[false, true].map((isPRN) => {
                              const group = physicians.filter((p) => p.isPRN === isPRN)
                              if (group.length === 0) return null
                              return (
                                <div key={String(isPRN)}>
                                  <p className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                                    {isPRN ? "PRN" : "Regular"}
                                  </p>
                                  {group.map((p) => (
                                    <button
                                      key={p.id}
                                      type="button"
                                      onClick={() => handleReassign(a.id, p.id)}
                                      className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-slate-50 transition ${
                                        a.userId === p.id ? "bg-blue-50 font-semibold" : ""
                                      }`}
                                    >
                                      <span className={`w-3.5 h-3.5 rounded-full ${physColorMap[p.id]} shrink-0`} />
                                      <span>{p.name.replace("Dr. ", "")}</span>
                                      <span className="ml-auto text-[10px] text-slate-400">
                                        {p.prefersTwelveHour ? "12h" : "24h"}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
