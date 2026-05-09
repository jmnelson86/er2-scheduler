"use client"

import { useState } from "react"
import { getDaysInMonth } from "date-fns"

interface BlockedDate {
  date: string
  type: string
  hardness: "REQUIRED" | "PREFERRED"
}

interface Props {
  year:        number
  month:       number
  blocked:     BlockedDate[]
  onChange:    (dates: BlockedDate[]) => void
  waitlisted?: string[]
}

const TYPE_OPTS = [
  { value: "VACATION", label: "Vacation",    bg: "bg-orange-200", text: "text-orange-900", ring: "bg-orange-100 text-orange-700 ring-orange-200" },
  { value: "PERSONAL", label: "Unavailable", bg: "bg-red-200",    text: "text-red-900",    ring: "bg-red-100 text-red-700 ring-red-200" },
  { value: "OTHER",    label: "Other",       bg: "bg-purple-200", text: "text-purple-900", ring: "bg-purple-100 text-purple-700 ring-purple-200" },
]

const DAY_NAMES   = ["Su","Mo","Tu","We","Th","Fr","Sa"]
const MONTH_NAMES = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

function typeStyle(type: string) {
  return TYPE_OPTS.find((t) => t.value === type) ?? TYPE_OPTS[0]
}

export default function CalendarPicker({ year, month, blocked, onChange, waitlisted = [] }: Props) {
  const [activeType, setActiveType]       = useState("VACATION")
  const [hardness, setHardness]           = useState<"REQUIRED" | "PREFERRED">("REQUIRED")

  const daysInMonth = getDaysInMonth(new Date(year, month - 1))
  const firstDow    = new Date(year, month - 1, 1).getDay()

  // Build fast lookups
  const blockedByDate: Record<string, BlockedDate> = {}
  for (const b of blocked) blockedByDate[b.date] = b
  const waitSet = new Set(waitlisted)

  function toggleDate(dateStr: string) {
    if (blockedByDate[dateStr]) {
      const existing = blockedByDate[dateStr]
      // Same type AND same hardness → remove
      if (existing.type === activeType && existing.hardness === hardness) {
        onChange(blocked.filter((b) => b.date !== dateStr))
      } else {
        // Different type OR different hardness → update
        onChange(blocked.map((b) => b.date === dateStr ? { ...b, type: activeType, hardness } : b))
      }
    } else {
      onChange([...blocked, { date: dateStr, type: activeType, hardness }])
    }
  }

  const days: string[] = []
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(`${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`)
  }

  const requiredCount  = blocked.filter((b) => b.hardness === "REQUIRED").length
  const preferredCount = blocked.filter((b) => b.hardness === "PREFERRED").length

  return (
    <div className="space-y-3">
      {/* Hardness toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setHardness("REQUIRED")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold ring-1 transition ${
            hardness === "REQUIRED"
              ? "bg-red-100 text-red-700 ring-red-300 shadow-sm"
              : "bg-white text-slate-500 ring-slate-200 hover:ring-slate-300"
          }`}
        >
          🚫 Unavailable (Required)
        </button>
        <button
          type="button"
          onClick={() => setHardness("PREFERRED")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold ring-1 transition ${
            hardness === "PREFERRED"
              ? "bg-amber-100 text-amber-700 ring-amber-300 shadow-sm"
              : "bg-white text-slate-500 ring-slate-200 hover:ring-slate-300"
          }`}
        >
          ⚠️ Preferred Off
        </button>
      </div>

      {/* Type selector */}
      <div className="flex gap-2 flex-wrap">
        {TYPE_OPTS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setActiveType(t.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ring-1 transition ${
              activeType === t.value
                ? `${t.ring} shadow-sm`
                : "bg-white text-slate-500 ring-slate-200 hover:ring-slate-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Calendar */}
      <div className="rounded-xl overflow-hidden ring-1 ring-slate-200 bg-white">
        <div className="bg-slate-50 px-3 py-2 text-center text-sm font-semibold text-slate-700 border-b border-slate-200">
          {MONTH_NAMES[month]} {year}
        </div>
        <div className="grid grid-cols-7">
          {DAY_NAMES.map((d) => (
            <div key={d} className="text-center text-xs font-medium text-slate-400 py-2">{d}</div>
          ))}

          {Array.from({ length: firstDow }).map((_, i) => (
            <div key={`pad-${i}`} className="h-10 border-b border-r border-slate-100" />
          ))}

          {days.map((dateStr) => {
            const entry     = blockedByDate[dateStr]
            const isBlocked = !!entry
            const style     = entry ? typeStyle(entry.type) : null
            const isPreferred = entry?.hardness === "PREFERRED"
            const isWait    = waitSet.has(dateStr)
            const dow       = new Date(dateStr + "T12:00:00").getDay()
            const weekend   = dow === 0 || dow === 6
            const dayNum    = parseInt(dateStr.split("-")[2])

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => toggleDate(dateStr)}
                className={`
                  h-10 border-b border-r border-slate-100 flex items-center justify-center
                  text-sm transition relative
                  ${isBlocked
                    ? ""
                    : weekend
                    ? "bg-slate-50 hover:bg-slate-100"
                    : "hover:bg-blue-50"}
                `}
              >
                <span className={`
                  w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold
                  ${isBlocked
                    ? isPreferred
                      ? `bg-amber-50 text-amber-800 ring-2 ring-dashed ring-amber-300`
                      : `${style!.bg} ${style!.text}`
                    : weekend ? "text-slate-400" : "text-slate-700"}
                  ${isWait ? "ring-2 ring-amber-400" : ""}
                `}>
                  {dayNum}
                </span>
                {isWait && (
                  <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-amber-400" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
        {TYPE_OPTS.map((t) => (
          <span key={t.value} className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded-full ${t.bg}`} />
            {t.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-amber-700">
          <span className="w-3 h-3 rounded-full bg-amber-100 ring-2 ring-dashed ring-amber-300" />
          Preferred off
        </span>
        {waitlisted.length > 0 && (
          <span className="flex items-center gap-1.5 text-amber-600">
            <span className="w-3 h-3 rounded-full bg-amber-400" />
            Waitlisted
          </span>
        )}
      </div>

      {blocked.length > 0 && (
        <p className="text-xs text-slate-500">
          {requiredCount > 0 && `${requiredCount} required off`}
          {requiredCount > 0 && preferredCount > 0 && " · "}
          {preferredCount > 0 && `${preferredCount} preferred off`}
          {" "}— tap a blocked day again to change type or hardness, or tap with same settings to remove
        </p>
      )}
    </div>
  )
}
