"use client"

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export type BlockType = "OFF_REQUIRED" | "OFF_PREFERRED" | "AVAILABLE"
export type RecurringPref = { dow: number; blockType: BlockType }

interface Props {
  prefs: RecurringPref[]
  onChange: (prefs: RecurringPref[]) => void
  showAvailable?: boolean
  disabled?: boolean
}

export default function RecurringDayPicker({ prefs, onChange, showAvailable = true, disabled }: Props) {
  function getState(dow: number): BlockType | "none" {
    return (prefs.find((p) => p.dow === dow)?.blockType as BlockType) ?? "none"
  }

  function cycle(dow: number) {
    const current = getState(dow)
    const states = showAvailable
      ? (["none", "OFF_REQUIRED", "OFF_PREFERRED", "AVAILABLE"] as const)
      : (["none", "OFF_REQUIRED", "OFF_PREFERRED"] as const)
    const next = states[(states.indexOf(current as any) + 1) % states.length]
    if (next === "none") {
      onChange(prefs.filter((p) => p.dow !== dow))
    } else {
      const has = prefs.some((p) => p.dow === dow)
      if (has) onChange(prefs.map((p) => (p.dow === dow ? { ...p, blockType: next } : p)))
      else onChange([...prefs, { dow, blockType: next }])
    }
  }

  const COLORS: Record<string, string> = {
    none: "bg-slate-100 text-slate-500 ring-slate-200 hover:bg-slate-200",
    OFF_REQUIRED: "bg-red-100 text-red-700 ring-red-300",
    OFF_PREFERRED: "bg-amber-100 text-amber-700 ring-amber-300",
    AVAILABLE: "bg-green-100 text-green-700 ring-green-300",
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5 flex-wrap">
        {DAYS.map((label, dow) => {
          const state = getState(dow)
          return (
            <button
              key={dow}
              type="button"
              onClick={() => cycle(dow)}
              disabled={disabled}
              className={`text-xs font-semibold rounded-lg px-2.5 py-1.5 ring-1 transition select-none ${COLORS[state]}`}
            >
              {label}
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-3 text-[11px] text-slate-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />Required off</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />Preferred off</span>
        {showAvailable && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />Always available</span>}
        <span className="text-slate-400 italic">Click to cycle · gray = no pattern</span>
      </div>
    </div>
  )
}
