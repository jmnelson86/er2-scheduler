"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import NavBar from "@/components/NavBar"
import CalendarPicker from "@/components/CalendarPicker"
import PreferredCalendar from "@/components/PreferredCalendar"
import RecurringDayPicker from "@/components/RecurringDayPicker"
import { Suspense } from "react"

interface Period {
  id: string; month: number; year: number; status: string
}

interface BlockedDate {
  date: string; type: string; hardness: "REQUIRED" | "PREFERRED"
}

interface PreferredDate {
  date: string; shiftType: string | null
}

const MONTH_NAMES = [
  "","January","February","March","April","May","June",
  "July","August","September","October","November","December",
]

function PreferencesInner() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [periods, setPeriods]         = useState<Period[]>([])
  const [selectedId, setSelectedId]   = useState<string | null>(null)
  const [blocked, setBlocked]           = useState<BlockedDate[]>([])
  const [preferred, setPreferred]       = useState<PreferredDate[]>([])
  const [targetShifts, setTargetShifts] = useState(15)
  const [minShifts, setMinShifts]       = useState(12)
  const [maxShifts, setMaxShifts]       = useState(18)
  const [notes, setNotes]               = useState("")
  const [allowedShiftTypes, setAllowedShiftTypes] = useState<string>("ALL")
  const [waitlisted, setWaitlisted]     = useState<string[]>([])
  const [saving, setSaving]             = useState(false)
  const [saved, setSaved]               = useState(false)
  const [saveError, setSaveError]       = useState("")
  const [submitting, setSubmitting]     = useState(false)
  const [submitted, setSubmitted]       = useState(false)
  const [submitError, setSubmitError]   = useState("")
  const [loadingPref, setLoadingPref]   = useState(false)
  const debounceRef      = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prefDebounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [recurringPrefs, setRecurringPrefs]       = useState<{ dow: number; blockType: string }[]>([])
  const [recurringLoading, setRecurringLoading]   = useState(false)
  const [recurringSaved, setRecurringSaved]         = useState(false)
  const [applyingRecurring, setApplyingRecurring] = useState(false)
  const [applyMsg, setApplyMsg]                   = useState("")
  const [showRecurringBanner, setShowRecurringBanner] = useState(false)

  const selectedPeriod = periods.find((p) => p.id === selectedId)

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
    if (status === "authenticated" && session?.user?.role === "ADMIN") router.push("/admin")
  }, [status, session, router])

  // Load own settings (allowedShiftTypes)
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.allowedShiftTypes) setAllowedShiftTypes(data.allowedShiftTypes)
      })
  }, [])

  async function saveAllowedShiftTypes(val: string) {
    setAllowedShiftTypes(val)
    await fetch("/api/settings", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ allowedShiftTypes: val }),
    })
  }

  function toggleMyShift(shiftType: string) {
    const active = allowedShiftTypes === "ALL" ? ["24H","DAY12","NIGHT12"] : allowedShiftTypes.split(",").map((s) => s.trim())
    const next = active.includes(shiftType) ? active.filter((s) => s !== shiftType) : [...active, shiftType]
    if (next.length === 0) return  // must have at least one
    const val = next.sort().join(",") === "24H,DAY12,NIGHT12" ? "ALL" : next.join(",")
    saveAllowedShiftTypes(val)
  }

  // Load open periods + recurring prefs
  useEffect(() => {
    Promise.all([
      fetch("/api/periods/open").then((r) => r.json()),
      fetch("/api/recurring-preferences").then((r) => r.json()),
    ]).then(([data, recurData]) => {
      setPeriods(data.periods ?? [])
      setRecurringPrefs(recurData.prefs ?? [])
      const pidParam = searchParams.get("periodId")
      if (pidParam && data.periods.some((p: Period) => p.id === pidParam)) {
        setSelectedId(pidParam)
      } else if (data.periods.length > 0) {
        setSelectedId(data.periods[0].id)
      }
    })
  }, [searchParams])

  // Load preferences when period changes
  useEffect(() => {
    if (!selectedId) return
    setLoadingPref(true)
    setSubmitted(false)
    setWaitlisted([])

    Promise.all([
      fetch(`/api/preferences?periodId=${selectedId}`).then((r) => r.json()),
      fetch(`/api/blocked-dates?periodId=${selectedId}`).then((r) => r.json()),
      fetch(`/api/preferred-dates?periodId=${selectedId}`).then((r) => r.json()),
    ]).then(([prefData, blockedData, preferredData]) => {
      const target = prefData.preference?.targetShifts ?? 15
      setTargetShifts(target)
      setMinShifts(prefData.preference?.minShifts ?? Math.max(1, target - 3))
      setMaxShifts(prefData.preference?.maxShifts ?? target + 3)
      setNotes(prefData.preference?.notes ?? "")
      setSubmitted(!!prefData.preference?.submittedAt)
      setBlocked((blockedData.dates ?? []).map((d: any) => ({ date: d.date, type: d.type, hardness: (d.hardness ?? "REQUIRED") as "REQUIRED" | "PREFERRED" })))
      setWaitlisted((blockedData.dates ?? []).filter((d: any) => d.status === "WAITLISTED").map((d: any) => d.date))
      const preferredDates = (preferredData.dates ?? []).map((d: any) => ({ date: d.date, shiftType: d.shiftType ?? null }))
      setPreferred(preferredDates)
      // Show auto-apply banner if physician has recurring prefs and this period has no data yet
      const hasNoData = (blockedData.dates ?? []).length === 0 && preferredDates.length === 0
      setRecurringPrefs((rp) => {
        setShowRecurringBanner(hasNoData && rp.length > 0)
        return rp
      })
      setLoadingPref(false)
    })
  }, [selectedId])

  // Auto-save blocked dates
  const saveBlocked = useCallback(async (dates: BlockedDate[]) => {
    if (!selectedId) return
    setSaving(true)
    setSaved(false)
    const res = await fetch("/api/blocked-dates", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ periodId: selectedId, dates }),
    })
    const data = await res.json()
    if (data.waitlisted?.length > 0) setWaitlisted(data.waitlisted)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }, [selectedId])

  function handleBlockedChange(dates: BlockedDate[]) {
    setBlocked(dates)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => saveBlocked(dates), 800)
  }

  const savePreferred = useCallback(async (dates: PreferredDate[]) => {
    if (!selectedId) return
    await fetch("/api/preferred-dates", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ periodId: selectedId, dates }),
    })
  }, [selectedId])

  function handlePreferredChange(dates: PreferredDate[]) {
    setPreferred(dates)
    if (prefDebounceRef.current) clearTimeout(prefDebounceRef.current)
    prefDebounceRef.current = setTimeout(() => savePreferred(dates), 800)
  }

  async function saveRecurringPrefs(prefs: typeof recurringPrefs) {
    setRecurringLoading(true)
    await fetch("/api/recurring-preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefs }),
    })
    setRecurringPrefs(prefs)
    setRecurringLoading(false)
    setRecurringSaved(true)
    setTimeout(() => setRecurringSaved(false), 2000)
  }

  async function applyRecurringToMonth() {
    if (!selectedId) return
    setApplyingRecurring(true)
    setApplyMsg("")
    const res = await fetch("/api/recurring-preferences/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodId: selectedId }),
    })
    const data = await res.json()
    setApplyMsg(`Applied: ${data.blocks ?? 0} day${data.blocks !== 1 ? "s" : ""} off, ${data.available ?? 0} available day${data.available !== 1 ? "s" : ""}`)
    setApplyingRecurring(false)
    setShowRecurringBanner(false)
    // Reload blocked/preferred dates
    if (selectedId) {
      Promise.all([
        fetch(`/api/blocked-dates?periodId=${selectedId}`).then((r) => r.json()),
        fetch(`/api/preferred-dates?periodId=${selectedId}`).then((r) => r.json()),
      ]).then(([blockedData, preferredData]) => {
        setBlocked((blockedData.dates ?? []).map((d: any) => ({ date: d.date, type: d.type, hardness: (d.hardness ?? "REQUIRED") as "REQUIRED" | "PREFERRED" })))
        setWaitlisted((blockedData.dates ?? []).filter((d: any) => d.status === "WAITLISTED").map((d: any) => d.date))
        setPreferred((preferredData.dates ?? []).map((d: any) => ({ date: d.date, shiftType: d.shiftType ?? null })))
      })
    }
    setTimeout(() => setApplyMsg(""), 4000)
  }

  async function handleSaveDraft() {
    if (!selectedId) return
    setSaving(true)
    setSaveError("")
    try {
      const res  = await fetch("/api/preferences", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          periodId: selectedId,
          targetShifts,
          minShifts,
          maxShifts,
          notes,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSaveError(data.error ?? "Failed to save. Please try again.")
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } catch {
      setSaveError("Network error. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedId) return
    setSubmitting(true)
    setSubmitError("")
    try {
      const res  = await fetch("/api/preferences", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          periodId: selectedId,
          targetShifts,
          minShifts,
          maxShifts,
          notes,
          submit: true,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSubmitError(data.error ?? "Failed to submit. Please try again.")
      } else {
        setSubmitted(true)
      }
    } catch {
      setSubmitError("Network error. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (status === "loading" || !session) return null

  return (
    <div className="min-h-screen" style={{ background: "#f4f6fb" }}>
      <NavBar />

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Preferences</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Submit your availability and shift preferences for scheduling.
          </p>
        </div>

        {/* Period selector */}
        {periods.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {periods.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ring-1 transition ${
                  selectedId === p.id
                    ? "bg-blue-700 text-white ring-blue-700"
                    : "bg-white text-slate-600 ring-slate-200 hover:ring-blue-300"
                }`}
              >
                {MONTH_NAMES[p.month]} {p.year}
              </button>
            ))}
          </div>
        )}

        {periods.length === 0 && (
          <div className="card text-center py-10 text-slate-400">
            No open periods for preferences yet.
          </div>
        )}

        {selectedPeriod && (
          <>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-slate-700">
                {MONTH_NAMES[selectedPeriod.month]} {selectedPeriod.year}
              </h2>
              {submitted && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full ring-1 ring-green-200">
                  ✅ Submitted
                </span>
              )}
            </div>

            {showRecurringBanner && selectedPeriod && (
              <div className="rounded-xl bg-blue-50 ring-1 ring-blue-200 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-semibold text-blue-800">You have recurring preferences set</p>
                  <p className="text-xs text-blue-600 mt-0.5">Apply your recurring day-off and availability patterns to {MONTH_NAMES[selectedPeriod.month]} {selectedPeriod.year}?</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button type="button" onClick={() => setShowRecurringBanner(false)} className="text-xs text-blue-600 hover:underline">Skip</button>
                  <button type="button" onClick={applyRecurringToMonth} disabled={applyingRecurring} className="btn-primary text-xs py-1.5 px-3">
                    {applyingRecurring ? "Applying…" : "Apply"}
                  </button>
                </div>
              </div>
            )}

            {loadingPref ? (
              <div className="text-slate-400 text-sm animate-pulse">Loading preferences…</div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">

                {/* Shift preference info */}
                <div className="card space-y-3">
                  <h3 className="font-semibold text-slate-700">Shift Length Preference</h3>
                  <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">
                    Your current preference is set to{" "}
                    <strong>
                      {(session.user as any).shiftLengthPref === "PREFER_12H" ? "12-hour shifts"
                        : (session.user as any).shiftLengthPref === "EITHER"  ? "either length"
                        : "24-hour shifts"}
                    </strong>
                    . Contact your administrator to change this.
                  </div>
                </div>

                {/* Target shifts */}
                <div className="card space-y-4">
                  <h3 className="font-semibold text-slate-700">Shift Count Request</h3>
                  <p className="text-xs text-slate-500">
                    The scheduler will try to hit your ideal, staying between your min and max.
                  </p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="label">Minimum shifts</label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={minShifts}
                        onChange={(e) => setMinShifts(Number(e.target.value))}
                        className="input w-full"
                      />
                    </div>
                    <div>
                      <label className="label">Ideal shifts</label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={targetShifts}
                        onChange={(e) => setTargetShifts(Number(e.target.value))}
                        className="input w-full"
                      />
                    </div>
                    <div>
                      <label className="label">Maximum shifts</label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={maxShifts}
                        onChange={(e) => setMaxShifts(Number(e.target.value))}
                        className="input w-full"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">
                    Each shift (24h or 12h) counts as one shift toward your total.
                  </p>
                </div>

                {/* Shift type availability */}
                <div className="card space-y-3">
                  <div>
                    <h3 className="font-semibold text-slate-700">Shifts Available For</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Select the shift types you are available to work. Deselected types will never be assigned to you.
                      Auto-saves when changed.
                    </p>
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    {(["24H","DAY12","NIGHT12"] as const).map((st) => {
                      const labels: Record<string, string> = { "24H": "24-Hour (9AM–9AM)", "DAY12": "Day 12H (9AM–9PM)", "NIGHT12": "Night 12H (9PM–9AM)" }
                      const active = allowedShiftTypes === "ALL" ? ["24H","DAY12","NIGHT12"] : allowedShiftTypes.split(",").map((s) => s.trim())
                      const on = active.includes(st)
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => toggleMyShift(st)}
                          className={`px-4 py-2 rounded-xl text-sm font-semibold ring-1 transition ${
                            on
                              ? st === "24H"    ? "bg-blue-100 text-blue-800 ring-blue-300"
                              : st === "DAY12"  ? "bg-amber-100 text-amber-800 ring-amber-300"
                              :                   "bg-indigo-100 text-indigo-800 ring-indigo-300"
                              : "bg-white text-slate-300 ring-slate-200"
                          }`}
                        >
                          {on ? "✓ " : ""}{labels[st]}
                        </button>
                      )
                    })}
                  </div>
                  {allowedShiftTypes !== "ALL" && (
                    <p className="text-xs text-amber-700">
                      ⚠ You are restricted to: {allowedShiftTypes.split(",").join(", ")}. The scheduler will only assign these shift types to you.
                    </p>
                  )}
                </div>

                {/* Recurring Preferences */}
                <div className="card space-y-4">
                  <div>
                    <h3 className="font-semibold text-slate-700">Recurring Preferences</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Set day-of-week patterns that carry over every month. Click a day to cycle: gray = no pattern, red = required off, amber = preferred off, green = always available.
                    </p>
                  </div>
                  <RecurringDayPicker
                    prefs={recurringPrefs as any}
                    onChange={(p) => saveRecurringPrefs(p)}
                    showAvailable={true}
                    disabled={recurringLoading}
                  />
                  <div className="flex items-center gap-3">
                    {recurringSaved && <span className="text-xs text-green-700">Saved ✓</span>}
                    {recurringLoading && <span className="text-xs text-slate-500">Saving…</span>}
                    {selectedId && recurringPrefs.length > 0 && (
                      <button
                        type="button"
                        onClick={applyRecurringToMonth}
                        disabled={applyingRecurring}
                        className="btn-secondary text-xs py-1.5 px-3"
                      >
                        {applyingRecurring ? "Applying…" : `Apply to ${selectedPeriod ? MONTH_NAMES[selectedPeriod.month] : "this month"}`}
                      </button>
                    )}
                    {applyMsg && <span className="text-xs text-green-700">{applyMsg}</span>}
                  </div>
                </div>

                {/* Blocked dates */}
                <div className="card space-y-3">
                  <h3 className="font-semibold text-slate-700">Days Off / Unavailable</h3>
                  <p className="text-xs text-slate-500">
                    Tap a date to block it. Auto-saves as you edit.
                    {saving && <span className="text-blue-500 ml-2">Saving…</span>}
                    {saved  && <span className="text-green-600 ml-2">Saved ✓</span>}
                  </p>
                  <CalendarPicker
                    key={selectedPeriod.id}
                    year={selectedPeriod.year}
                    month={selectedPeriod.month}
                    blocked={blocked}
                    onChange={handleBlockedChange}
                    waitlisted={waitlisted}
                  />
                  {waitlisted.length > 0 && (
                    <div className="rounded-lg bg-amber-50 ring-1 ring-amber-200 px-3 py-2 text-xs text-amber-800">
                      ⚠️ {waitlisted.length} of your requested day{waitlisted.length !== 1 ? "s" : ""} off {waitlisted.length !== 1 ? "are" : "is"} waitlisted
                      because the daily limit has been reached. The scheduler may assign you on those days.
                    </div>
                  )}
                </div>

                {/* Preferred dates */}
                <div className="card space-y-3">
                  <h3 className="font-semibold text-slate-700">Shifts I Can Work</h3>
                  <p className="text-xs text-slate-500">
                    Tap the days you <strong>are available</strong> to work.
                    If you mark any days, the scheduler will <strong>only assign you on those days</strong> — leave this blank to remain available all month.
                    Auto-saves as you edit.
                  </p>
                  <PreferredCalendar
                    key={selectedPeriod.id + "-pref"}
                    year={selectedPeriod.year}
                    month={selectedPeriod.month}
                    preferred={preferred}
                    onChange={handlePreferredChange}
                    shiftLengthPref={(session.user as any).shiftLengthPref ?? "PREFER_24H"}
                  />
                </div>

                {/* Notes */}
                <div className="card space-y-3">
                  <h3 className="font-semibold text-slate-700">Notes</h3>
                  <textarea
                    rows={3}
                    placeholder="Any other scheduling considerations…"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="input resize-none"
                  />
                </div>

                {/* Actions */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={handleSaveDraft}
                      disabled={saving}
                      className="btn-secondary text-sm"
                    >
                      {saving ? "Saving…" : "Save Draft"}
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="btn-primary text-sm"
                    >
                      {submitting ? "Submitting…" :
                       submitted  ? "Update Submission" :
                                    "Submit Preferences"}
                    </button>
                    {saved && !submitting && (
                      <span className="text-sm text-green-700">Saved ✓</span>
                    )}
                  </div>
                  {saveError && (
                    <div className="rounded-lg bg-red-50 ring-1 ring-red-200 px-3 py-2 text-sm text-red-700">
                      ⚠️ {saveError}
                    </div>
                  )}
                  {submitError && (
                    <div className="rounded-lg bg-red-50 ring-1 ring-red-200 px-3 py-2 text-sm text-red-700">
                      ⚠️ {submitError}
                    </div>
                  )}
                </div>
              </form>
            )}
          </>
        )}
      </main>
    </div>
  )
}

export default function PreferencesPage() {
  return (
    <Suspense>
      <PreferencesInner />
    </Suspense>
  )
}
