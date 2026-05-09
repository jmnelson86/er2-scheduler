"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import NavBar from "@/components/NavBar"
import CalendarPicker from "@/components/CalendarPicker"
import PreferredCalendar from "@/components/PreferredCalendar"
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
  const [waitlisted, setWaitlisted]     = useState<string[]>([])
  const [saving, setSaving]             = useState(false)
  const [saved, setSaved]               = useState(false)
  const [submitting, setSubmitting]     = useState(false)
  const [submitted, setSubmitted]       = useState(false)
  const [loadingPref, setLoadingPref]   = useState(false)
  const debounceRef      = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prefDebounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selectedPeriod = periods.find((p) => p.id === selectedId)

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
    if (status === "authenticated" && session?.user?.role === "ADMIN") router.push("/admin")
  }, [status, session, router])

  // Load open periods
  useEffect(() => {
    fetch("/api/periods/open")
      .then((r) => r.json())
      .then((data) => {
        setPeriods(data.periods ?? [])
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
      setPreferred((preferredData.dates ?? []).map((d: any) => ({ date: d.date, shiftType: d.shiftType ?? null })))
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

  async function handleSaveDraft() {
    if (!selectedId) return
    setSaving(true)
    await fetch("/api/preferences", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ periodId: selectedId, targetShifts, minShifts, maxShifts, notes }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedId) return
    setSubmitting(true)
    await fetch("/api/preferences", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ periodId: selectedId, targetShifts, minShifts, maxShifts, notes, submit: true }),
    })
    setSubmitting(false)
    setSubmitted(true)
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
                      {(session.user as any).prefersTwelveHour ? "12-hour shifts" : "24-hour shifts"}
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
                    {(session.user as any).prefersTwelveHour
                      ? "Each 12h shift counts as one shift."
                      : "Each 24h shift counts as one shift."}
                  </p>
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
                  <h3 className="font-semibold text-slate-700">Shifts I Want to Work</h3>
                  <p className="text-xs text-slate-500">
                    Tap a date to request it. The scheduler will prioritize these days.
                    Auto-saves as you edit.
                  </p>
                  <PreferredCalendar
                    key={selectedPeriod.id + "-pref"}
                    year={selectedPeriod.year}
                    month={selectedPeriod.month}
                    preferred={preferred}
                    onChange={handlePreferredChange}
                    prefersTwelveHour={(session.user as any).prefersTwelveHour}
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
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={saving}
                    className="btn-secondary text-sm"
                  >
                    Save Draft
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || submitted}
                    className="btn-primary text-sm"
                  >
                    {submitted   ? "✅ Submitted" :
                     submitting  ? "Submitting…" :
                                   "Submit Preferences"}
                  </button>
                  {saved && !submitting && (
                    <span className="text-sm text-green-700">Saved ✓</span>
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
