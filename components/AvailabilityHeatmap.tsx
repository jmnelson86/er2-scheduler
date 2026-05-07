"use client"

import { useState } from "react"
import { format, getDaysInMonth } from "date-fns"

interface DayEntry {
  userId:    string
  name:      string
  isPRN:     boolean
  type:      string
  status:    string   // "CONFIRMED" | "WAITLISTED"
  createdAt: string
}

interface Props {
  year:        number
  month:       number
  dayMap:      Record<string, DayEntry[]>
  maxDayOff:   number | null
  fcfsEnabled: boolean
  totalPhysicians: number
  onStatusChange?: (userId: string, date: string, newStatus: "CONFIRMED" | "WAITLISTED") => Promise<void>
}

const TYPE_LABEL: Record<string, string> = {
  VACATION: "Vacation",
  PERSONAL: "Unavailable",
  OTHER:    "Other",
}
const TYPE_DOT: Record<string, string> = {
  VACATION: "bg-orange-400",
  PERSONAL: "bg-red-400",
  OTHER:    "bg-purple-400",
}
const DAY_NAMES   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]
const MONTH_NAMES = ["","January","February","March","April","May","June","July","August","September","October","November","December"]

function heatColor(confirmed: number, waitlisted: number, total: number, max: number | null) {
  const count = confirmed + waitlisted
  if (count === 0) return { bg: "bg-white", text: "text-slate-400", ring: "ring-slate-100", label: "" }

  const ratio = confirmed / Math.max(total, 1)
  const overLimit = max !== null && confirmed >= max

  if (overLimit) return { bg: "bg-red-100",    text: "text-red-800",    ring: "ring-red-300",    label: "At limit" }
  if (ratio >= 0.5) return { bg: "bg-orange-100", text: "text-orange-800", ring: "ring-orange-300", label: "High" }
  if (ratio >= 0.3) return { bg: "bg-amber-100",  text: "text-amber-800",  ring: "ring-amber-300",  label: "Moderate" }
  if (ratio >= 0.1) return { bg: "bg-yellow-50",  text: "text-yellow-800", ring: "ring-yellow-200", label: "Low" }
  return { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-100", label: "" }
}

export default function AvailabilityHeatmap({
  year, month, dayMap, maxDayOff, fcfsEnabled, totalPhysicians, onStatusChange,
}: Props) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [promoting,    setPromoting]    = useState<string | null>(null)

  const daysInMonth   = getDaysInMonth(new Date(year, month - 1))
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay()

  const days: string[] = []
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(`${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`)
  }

  const selectedEntries    = selectedDate ? (dayMap[selectedDate] ?? []) : []
  const confirmedEntries   = selectedEntries.filter((e) => e.status === "CONFIRMED")
  const waitlistedEntries  = selectedEntries.filter((e) => e.status === "WAITLISTED")

  async function toggleStatus(entry: DayEntry, date: string) {
    if (!onStatusChange) return
    setPromoting(entry.userId)
    const newStatus = entry.status === "CONFIRMED" ? "WAITLISTED" : "CONFIRMED"
    await onStatusChange(entry.userId, date, newStatus)
    setPromoting(null)
  }

  const allDaysWithRequests = Object.entries(dayMap).filter(([,e]) => e.length > 0)
  const daysAtLimit = maxDayOff
    ? allDaysWithRequests.filter(([,e]) => e.filter(x => x.status === "CONFIRMED").length >= maxDayOff).length
    : 0
  const totalWaitlisted = Object.values(dayMap).flat().filter((e) => e.status === "WAITLISTED").length

  return (
    <div className="space-y-5">

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 ring-1 ring-slate-200">
          {allDaysWithRequests.length} days with requests
        </span>
        {maxDayOff && (
          <span className={`px-2.5 py-1 rounded-full ring-1 font-medium ${
            daysAtLimit > 0
              ? "bg-red-100 text-red-700 ring-red-300"
              : "bg-emerald-100 text-emerald-700 ring-emerald-200"
          }`}>
            {daysAtLimit} day{daysAtLimit !== 1 ? "s" : ""} at limit ({maxDayOff} max)
          </span>
        )}
        {totalWaitlisted > 0 && (
          <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 ring-1 ring-amber-300 font-medium">
            {totalWaitlisted} waitlisted request{totalWaitlisted !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span className="font-medium text-slate-600">Severity:</span>
        {[
          { bg: "bg-emerald-50",  label: "1–2 off" },
          { bg: "bg-yellow-50",   label: "~10%" },
          { bg: "bg-amber-100",   label: "~30%" },
          { bg: "bg-orange-100",  label: "~50%" },
          { bg: "bg-red-100",     label: "At limit" },
        ].map((s) => (
          <span key={s.label} className="flex items-center gap-1">
            <span className={`w-3.5 h-3.5 rounded ${s.bg} ring-1 ring-slate-200 inline-block`} />
            {s.label}
          </span>
        ))}
        <span className="flex items-center gap-1 ml-2">
          <span className="w-3.5 h-3.5 rounded bg-slate-100 ring-1 ring-slate-300 inline-block opacity-50" />
          Waitlisted
        </span>
      </div>

      {/* Calendar grid */}
      <div className="rounded-xl overflow-hidden ring-1 ring-slate-200 bg-white select-none">
        <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
          {DAY_NAMES.map((d) => (
            <div key={d} className="text-center text-xs font-medium text-slate-500 py-2">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`pad-${i}`} className="h-14 border-b border-r border-slate-100" />
          ))}

          {days.map((dateStr) => {
            const entries   = dayMap[dateStr] ?? []
            const confirmed  = entries.filter((e) => e.status === "CONFIRMED")
            const waitlisted = entries.filter((e) => e.status === "WAITLISTED")
            const colors     = heatColor(confirmed.length, waitlisted.length, totalPhysicians, maxDayOff)
            const dayNum     = parseInt(dateStr.split("-")[2])
            const isSelected = selectedDate === dateStr
            const isWeekend  = new Date(dateStr + "T12:00:00").getDay() % 6 === 0

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                className={`
                  h-14 border-b border-r border-slate-100 flex flex-col items-center justify-center
                  gap-0.5 transition cursor-pointer relative
                  ${entries.length > 0 ? colors.bg : isWeekend ? "bg-slate-50/70" : "bg-white hover:bg-slate-50"}
                  ${isSelected ? "ring-2 ring-inset z-10" : ""}
                `}
                style={isSelected ? { outlineColor: "#0d2580" } : {}}
              >
                <span className={`text-sm font-bold ${entries.length > 0 ? colors.text : isWeekend ? "text-slate-400" : "text-slate-700"}`}>
                  {dayNum}
                </span>

                {entries.length > 0 && (
                  <div className="flex items-center gap-0.5">
                    {confirmed.length > 0 && (
                      <span className={`text-[10px] font-bold leading-none px-1 py-0.5 rounded ${colors.bg} ${colors.text}`}>
                        {confirmed.length}
                      </span>
                    )}
                    {waitlisted.length > 0 && (
                      <span className="text-[10px] font-bold leading-none px-1 py-0.5 rounded bg-slate-200 text-slate-500">
                        +{waitlisted.length}W
                      </span>
                    )}
                  </div>
                )}

                {maxDayOff !== null && confirmed.length >= maxDayOff && confirmed.length > 0 && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected day detail */}
      {selectedDate && (
        <div className="rounded-xl ring-1 ring-slate-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
            <div>
              <h3 className="font-semibold text-slate-800">
                {format(new Date(selectedDate + "T12:00:00"), "EEEE, MMMM d")}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {confirmedEntries.length} confirmed off
                {waitlistedEntries.length > 0 && ` · ${waitlistedEntries.length} waitlisted`}
                {maxDayOff && ` · limit: ${maxDayOff}`}
              </p>
            </div>
            <button
              onClick={() => setSelectedDate(null)}
              className="text-slate-400 hover:text-slate-600 text-lg leading-none"
            >✕</button>
          </div>

          {selectedEntries.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-400 text-center italic">
              No time-off requests for this day.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {confirmedEntries.length > 0 && (
                <div className="px-4 py-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Confirmed ({confirmedEntries.length})
                  </p>
                  {confirmedEntries.map((e, i) => (
                    <div key={e.userId} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        <span className="text-sm font-medium text-slate-800">{e.name.replace("Dr. ","")}</span>
                        {e.isPRN && <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full">PRN</span>}
                        <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                          e.type === "VACATION" ? "bg-orange-100 text-orange-700"
                          : e.type === "PERSONAL" ? "bg-red-100 text-red-700"
                          : "bg-purple-100 text-purple-700"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${TYPE_DOT[e.type]}`} />
                          {TYPE_LABEL[e.type]}
                        </span>
                      </div>
                      {onStatusChange && fcfsEnabled && (
                        <button
                          type="button"
                          disabled={promoting === e.userId}
                          onClick={() => toggleStatus(e, selectedDate)}
                          className="text-xs text-slate-400 hover:text-amber-600 transition px-2 py-1 rounded hover:bg-amber-50"
                          title="Move to waitlist"
                        >
                          {promoting === e.userId ? "…" : "→ Waitlist"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {waitlistedEntries.length > 0 && (
                <div className="px-4 py-3 space-y-2 bg-amber-50/50">
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide flex items-center gap-1">
                    <span>⏳</span> Waitlisted ({waitlistedEntries.length})
                    {fcfsEnabled && (
                      <span className="normal-case font-normal text-amber-600 ml-1">
                        — over limit · scheduler treats as available
                      </span>
                    )}
                  </p>
                  {waitlistedEntries.map((e) => (
                    <div key={e.userId} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-500">{e.name.replace("Dr. ","")}</span>
                        {e.isPRN && <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full">PRN</span>}
                        <span className="text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                          {TYPE_LABEL[e.type]}
                        </span>
                      </div>
                      {onStatusChange && fcfsEnabled && (
                        <button
                          type="button"
                          disabled={promoting === e.userId}
                          onClick={() => toggleStatus(e, selectedDate)}
                          className="text-xs text-slate-400 hover:text-green-600 transition px-2 py-1 rounded hover:bg-green-50"
                          title="Promote to confirmed"
                        >
                          {promoting === e.userId ? "…" : "↑ Confirm"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
