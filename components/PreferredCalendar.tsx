"use client"

import { useState } from "react"
import { getDaysInMonth } from "date-fns"

interface PreferredDate {
  date:      string
  shiftType: string | null
}

interface Props {
  year:              number
  month:             number
  preferred:         PreferredDate[]
  onChange:          (dates: PreferredDate[]) => void
  prefersTwelveHour?: boolean
}

const DAY_NAMES   = ["Su","Mo","Tu","We","Th","Fr","Sa"]
const MONTH_NAMES = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

interface TypeOpt {
  value:     string | null
  label:     string
  bg:        string
  text:      string
  ring:      string
  dot:       string
}

function getTypeOpts(prefersTwelveHour: boolean): TypeOpt[] {
  if (prefersTwelveHour) {
    return [
      { value: null,      label: "Any",           bg: "bg-green-100",  text: "text-green-800",  ring: "bg-green-100 text-green-800 ring-green-300",  dot: "bg-green-400"  },
      { value: "DAY12",   label: "Day 9AM–9PM",   bg: "bg-sky-100",    text: "text-sky-800",    ring: "bg-sky-100 text-sky-800 ring-sky-300",         dot: "bg-sky-400"    },
      { value: "NIGHT12", label: "Night 9PM–9AM", bg: "bg-indigo-100", text: "text-indigo-800", ring: "bg-indigo-100 text-indigo-800 ring-indigo-300", dot: "bg-indigo-400" },
    ]
  }
  return [
    { value: "24H", label: "24H Shift", bg: "bg-green-100", text: "text-green-800", ring: "bg-green-100 text-green-800 ring-green-300", dot: "bg-green-400" },
  ]
}

function typeStyle(shiftType: string | null, opts: TypeOpt[]): TypeOpt {
  return opts.find((t) => t.value === shiftType) ?? opts[0]
}

export default function PreferredCalendar({
  year,
  month,
  preferred,
  onChange,
  prefersTwelveHour = false,
}: Props) {
  const typeOpts = getTypeOpts(prefersTwelveHour)
  const [activeType, setActiveType] = useState<string | null>(typeOpts[0].value)

  const daysInMonth = getDaysInMonth(new Date(year, month - 1))
  const firstDow    = new Date(year, month - 1, 1).getDay()

  // Fast lookup
  const prefByDate: Record<string, PreferredDate> = {}
  for (const p of preferred) prefByDate[p.date] = p

  function toggleDate(dateStr: string) {
    const existing = prefByDate[dateStr]
    if (existing) {
      if (existing.shiftType === activeType) {
        // Same type — remove
        onChange(preferred.filter((p) => p.date !== dateStr))
      } else {
        // Different type — change it
        onChange(preferred.map((p) => p.date === dateStr ? { ...p, shiftType: activeType } : p))
      }
    } else {
      onChange([...preferred, { date: dateStr, shiftType: activeType }])
    }
  }

  const days: string[] = []
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(`${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`)
  }

  return (
    <div className="space-y-3">
      {/* Type selector — only show if 12h physician (multiple options) */}
      {typeOpts.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {typeOpts.map((t) => (
            <button
              key={String(t.value)}
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
      )}

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
            const entry    = prefByDate[dateStr]
            const isPref   = !!entry
            const style    = entry ? typeStyle(entry.shiftType, typeOpts) : null
            const dow      = new Date(dateStr + "T12:00:00").getDay()
            const weekend  = dow === 0 || dow === 6
            const dayNum   = parseInt(dateStr.split("-")[2])

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => toggleDate(dateStr)}
                className={`
                  h-10 border-b border-r border-slate-100 flex items-center justify-center
                  text-sm transition relative
                  ${isPref
                    ? ""
                    : weekend
                    ? "bg-slate-50 hover:bg-green-50"
                    : "hover:bg-green-50"}
                `}
              >
                <span className={`
                  w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold
                  ${isPref
                    ? `${style!.bg} ${style!.text}`
                    : weekend ? "text-slate-400" : "text-slate-700"}
                `}>
                  {dayNum}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
        {typeOpts.map((t) => (
          <span key={String(t.value)} className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded-full ${t.dot}`} />
            {t.label}
          </span>
        ))}
      </div>

      <p className="text-xs text-slate-500">
        {preferred.length} day{preferred.length !== 1 ? "s" : ""} requested
        {preferred.length > 0 && " — tap a marked day with same type to remove, or different type to change"}
      </p>
    </div>
  )
}
