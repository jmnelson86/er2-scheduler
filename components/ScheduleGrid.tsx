"use client"

import { useState } from "react"
import { getDaysInMonth, format, startOfMonth, getDay } from "date-fns"

interface Physician {
  id:    string
  name:  string
  isPRN: boolean
  prefersTwelveHour: boolean
  color: string
}

interface Assignment {
  id:           string
  date:         string
  shiftType:    string
  userId:       string | null
  isLocked:     boolean
  isConflict:   boolean
  conflictNote: string
  user: Physician | null
}

interface Props {
  year:         number
  month:        number
  assignments:  Assignment[]
  physicians:   Physician[]
  onReassign:   (assignmentId: string, userId: string | null) => Promise<void>
  onToggleLock: (assignmentId: string) => Promise<void>
  onSplit?:     (assignmentId: string) => Promise<void>
  onAddSlot?:   (date: string, shiftType: "DAY12" | "NIGHT12") => Promise<void>
}

const SHIFT_SHORT: Record<string, string> = {
  "24H":    "24H",
  DAY12:    "DAY",
  NIGHT12:  "NGT",
}

const DOW_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

const ORDER = { "24H": 0, DAY12: 1, NIGHT12: 2 }

function lastName(name: string) {
  // Drop "Dr. " prefix, return last word
  const stripped = name.replace(/^Dr\.\s*/i, "")
  const parts = stripped.trim().split(/\s+/)
  return parts[parts.length - 1]
}

export default function ScheduleGrid({
  year, month, assignments, physicians, onReassign, onToggleLock, onSplit, onAddSlot,
}: Props) {
  const [openCell, setOpenCell] = useState<string | null>(null)  // assignmentId
  const [saving,   setSaving]   = useState<string | null>(null)
  const [addingSlot, setAddingSlot] = useState<string | null>(null)  // "date::shiftType"

  // Build physician color map from each physician's chosen color
  const physColorMap: Record<string, string> = {}
  physicians.forEach((p) => {
    physColorMap[p.id] = p.color ?? "#6366f1"
  })

  const daysInMonth    = getDaysInMonth(new Date(year, month - 1))
  const firstDayOfWeek = getDay(startOfMonth(new Date(year, month - 1)))  // 0=Sun

  // Build map: date → assignments sorted by type
  const byDate: Record<string, Assignment[]> = {}
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    byDate[dateStr] = []
  }
  for (const a of assignments) {
    if (byDate[a.date]) byDate[a.date].push(a)
  }
  for (const dateStr of Object.keys(byDate)) {
    byDate[dateStr].sort(
      (a, b) =>
        (ORDER[a.shiftType as keyof typeof ORDER] ?? 0) -
        (ORDER[b.shiftType as keyof typeof ORDER] ?? 0)
    )
  }

  // Today string for highlight
  const todayStr = (() => {
    const t = new Date()
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`
  })()

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

  async function handleSplit(assignmentId: string) {
    if (!onSplit) return
    setSaving(assignmentId)
    setOpenCell(null)
    await onSplit(assignmentId)
    setSaving(null)
  }

  async function handleAddSlot(date: string, shiftType: "DAY12" | "NIGHT12") {
    if (!onAddSlot) return
    const key = `${date}::${shiftType}`
    setAddingSlot(key)
    await onAddSlot(date, shiftType)
    setAddingSlot(null)
  }

  // Physician shift counts (for summary table)
  const shiftCounts: Record<string, { "24H": number; DAY12: number; NIGHT12: number; total: number }> = {}
  for (const p of physicians) {
    shiftCounts[p.id] = { "24H": 0, DAY12: 0, NIGHT12: 0, total: 0 }
  }
  for (const a of assignments) {
    if (a.userId && shiftCounts[a.userId]) {
      shiftCounts[a.userId].total++
      if      (a.shiftType === "24H")    shiftCounts[a.userId]["24H"]++
      else if (a.shiftType === "DAY12")  shiftCounts[a.userId].DAY12++
      else if (a.shiftType === "NIGHT12") shiftCounts[a.userId].NIGHT12++
    }
  }

  // Build the flat list of cells: leading empty pads + day cells
  const cells: Array<{ type: "empty" } | { type: "day"; dateStr: string; dayNum: number; isWeekend: boolean }> = []
  for (let i = 0; i < firstDayOfWeek; i++) {
    cells.push({ type: "empty" })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr    = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    const dow        = (firstDayOfWeek + d - 1) % 7
    const isWeekend  = dow === 0 || dow === 6
    cells.push({ type: "day", dateStr, dayNum: d, isWeekend })
  }

  // Physicians who have at least one assignment this month
  const activephysIds = new Set(assignments.filter((a) => a.userId).map((a) => a.userId!))
  const legendPhysicians = physicians.filter((p) => activephysIds.has(p.id))

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Click a shift block to reassign. 🔒 = manually locked.
      </p>

      {/* Month header */}
      <h2 className="text-lg font-semibold text-slate-800">
        {MONTH_NAMES[month]} {year}
      </h2>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 border-l border-t border-slate-200">
        {/* Day-of-week headers */}
        {DOW_HEADERS.map((h) => (
          <div
            key={h}
            className="border-r border-b border-slate-200 px-1.5 py-1 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide bg-slate-50"
          >
            {h}
          </div>
        ))}

        {/* Day cells */}
        {cells.map((cell, idx) => {
          if (cell.type === "empty") {
            return (
              <div
                key={`empty-${idx}`}
                className="border-r border-b border-slate-200 bg-slate-50 min-h-[80px]"
              />
            )
          }

          const { dateStr, dayNum, isWeekend } = cell
          const dayAssignments = byDate[dateStr] ?? []
          const isToday = dateStr === todayStr

          return (
            <div
              key={dateStr}
              className={`border-r border-b border-slate-200 min-h-[80px] p-1 flex flex-col gap-0.5 ${
                isToday   ? "bg-blue-50" :
                isWeekend ? "bg-slate-50" :
                "bg-white"
              }`}
            >
              {/* Day number */}
              <span
                className={`text-xs font-bold mb-0.5 ${
                  isToday   ? "text-blue-700" :
                  isWeekend ? "text-slate-400" :
                  "text-slate-700"
                }`}
              >
                {isToday ? (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                    {dayNum}
                  </span>
                ) : (
                  dayNum
                )}
              </span>

              {/* Shift blocks */}
              {dayAssignments.map((a) => {

                const isOpen    = openCell === a.id
                const isSaving  = saving === a.id
                const doc       = a.user
                const physColor = doc ? (physColorMap[doc.id] ?? "#6366f1") : "#94a3b8"

                return (
                  <div key={a.id} className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenCell(isOpen ? null : a.id)}
                      className={`
                        w-full text-left text-xs rounded flex items-center gap-0.5 pl-0 pr-1 py-0.5
                        transition select-none overflow-hidden
                        ${a.isConflict
                          ? "bg-red-100 text-red-800 ring-1 ring-red-300"
                          : "bg-slate-100 text-slate-800"}
                        ${isOpen ? "ring-2 ring-blue-500 shadow" : "hover:brightness-95"}
                      `}
                    >
                      {/* Left color bar */}
                      <span
                        className="w-1 self-stretch rounded-l shrink-0"
                        style={{ backgroundColor: physColor, minWidth: "4px" }}
                      />
                      <span className="ml-0.5 font-mono text-[9px] text-slate-500 shrink-0">
                        {SHIFT_SHORT[a.shiftType] ?? a.shiftType}
                      </span>
                      <span className="ml-0.5 truncate text-[10px] font-medium flex items-center gap-0.5">
                        {isSaving && <span className="animate-spin text-[9px]">⟳</span>}
                        {a.isLocked && <span className="text-[9px]">🔒</span>}
                        {doc ? (
                          lastName(doc.name)
                        ) : (
                          <span className="text-red-600 font-semibold">⚠ Open</span>
                        )}
                      </span>
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

                        {/* Split 24H into 12h shifts */}
                        {a.shiftType === "24H" && onSplit && (
                          <button
                            type="button"
                            onClick={() => handleSplit(a.id)}
                            className="w-full text-left px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 border-b border-slate-100"
                          >
                            ↕ Split into Day 12h + Night 12h
                          </button>
                        )}

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
                                  <span
                                    className="w-3.5 h-3.5 rounded-full shrink-0"
                                    style={{ backgroundColor: physColorMap[p.id] ?? "#6366f1" }}
                                  />
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
              })}

              {/* Add 12h slot buttons — shown when a day is missing one or both 12h slots */}
              {onAddSlot && !dayAssignments.some((a) => a.shiftType === "24H") && (
                <>
                  {!dayAssignments.some((a) => a.shiftType === "DAY12") && (
                    <button
                      type="button"
                      onClick={() => handleAddSlot(dateStr, "DAY12")}
                      disabled={addingSlot === `${dateStr}::DAY12`}
                      className="w-full text-[9px] text-amber-600 border border-dashed border-amber-300 rounded px-1 py-0.5 hover:bg-amber-50 transition leading-tight"
                    >
                      {addingSlot === `${dateStr}::DAY12` ? "…" : "+ DAY"}
                    </button>
                  )}
                  {!dayAssignments.some((a) => a.shiftType === "NIGHT12") && (
                    <button
                      type="button"
                      onClick={() => handleAddSlot(dateStr, "NIGHT12")}
                      disabled={addingSlot === `${dateStr}::NIGHT12`}
                      className="w-full text-[9px] text-indigo-600 border border-dashed border-indigo-300 rounded px-1 py-0.5 hover:bg-indigo-50 transition leading-tight"
                    >
                      {addingSlot === `${dateStr}::NIGHT12` ? "…" : "+ NGT"}
                    </button>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Legends */}
      <div className="flex flex-wrap gap-6 text-xs mt-4">
        {/* Physician legend */}
        {legendPhysicians.length > 0 && (
          <div className="space-y-1">
            <p className="font-semibold text-slate-500 uppercase tracking-wide text-[10px]">Physicians</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {legendPhysicians.map((p) => (
                <span key={p.id} className="flex items-center gap-1.5">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: physColorMap[p.id] ?? "#6366f1" }}
                  />
                  <span className="text-slate-700">{p.name.replace("Dr. ", "")}</span>
                  {p.isPRN && <span className="text-slate-400">(PRN)</span>}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Shift type legend */}
        <div className="space-y-1">
          <p className="font-semibold text-slate-500 uppercase tracking-wide text-[10px]">Shift Types</p>
          <div className="flex flex-wrap gap-3">
            {[
              { key: "24H",    label: "24H  (9AM–9AM)" },
              { key: "DAY12",  label: "DAY  12h (9AM–9PM)" },
              { key: "NIGHT12",label: "NGT  12h (9PM–9AM)" },
            ].map((s) => (
              <span key={s.key} className="flex items-center gap-1 text-slate-600">
                <span className="font-mono text-[10px] bg-slate-100 rounded px-1 py-0.5">
                  {SHIFT_SHORT[s.key]}
                </span>
                {s.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Physician shift count summary */}
      {physicians.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Shift Totals
          </h3>
          <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-left">
                  <th className="px-3 py-2 font-semibold">Physician</th>
                  <th className="px-3 py-2 font-semibold text-center">24H</th>
                  <th className="px-3 py-2 font-semibold text-center">DAY</th>
                  <th className="px-3 py-2 font-semibold text-center">NGT</th>
                  <th className="px-3 py-2 font-semibold text-center">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...physicians]
                  .sort((a, b) => {
                    if (a.isPRN !== b.isPRN) return a.isPRN ? 1 : -1
                    return a.name.localeCompare(b.name)
                  })
                  .map((p) => {
                    const c = shiftCounts[p.id] ?? { "24H": 0, DAY12: 0, NIGHT12: 0, total: 0 }
                    return (
                      <tr key={p.id} className={`transition ${c.total === 0 ? "bg-red-50" : "bg-white hover:bg-slate-50"}`}>
                        <td className="px-3 py-2 flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: physColorMap[p.id] ?? "#6366f1" }}
                          />
                          <span className={`font-medium ${c.total === 0 ? "text-red-700" : "text-slate-800"}`}>
                            {p.name.replace(/^Dr\.\s*/i, "")}
                          </span>
                          {p.isPRN && <span className="text-slate-400">(PRN)</span>}
                        </td>
                        <td className="px-3 py-2 text-center text-slate-600">{c["24H"] || "—"}</td>
                        <td className="px-3 py-2 text-center text-slate-600">{c.DAY12 || "—"}</td>
                        <td className="px-3 py-2 text-center text-slate-600">{c.NIGHT12 || "—"}</td>
                        <td className={`px-3 py-2 text-center font-bold ${c.total === 0 ? "text-red-600" : "text-slate-900"}`}>
                          {c.total}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
