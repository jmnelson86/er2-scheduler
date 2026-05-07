"use client"

import { useEffect, useState, useCallback } from "react"
import AvailabilityHeatmap from "./AvailabilityHeatmap"

interface DayEntry {
  userId: string; name: string; isPRN: boolean
  type: string; status: string; createdAt: string
}

interface Props {
  periodId:        string
  totalPhysicians: number
}

export default function AvailabilityPanel({ periodId, totalPhysicians }: Props) {
  const [dayMap,      setDayMap]      = useState<Record<string, DayEntry[]>>({})
  const [maxDayOff,   setMaxDayOff]   = useState<number | null>(null)
  const [fcfsEnabled, setFcfsEnabled] = useState(false)
  const [month,       setMonth]       = useState(1)
  const [year,        setYear]        = useState(2026)
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [saveMsg,     setSaveMsg]     = useState("")

  const [draftMax,  setDraftMax]  = useState<string>("")
  const [draftFcfs, setDraftFcfs] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res  = await fetch(`/api/admin/availability?periodId=${periodId}`)
    const data = await res.json()
    setDayMap(data.dayMap      ?? {})
    setMaxDayOff(data.maxDayOff ?? null)
    setFcfsEnabled(data.fcfsEnabled ?? false)
    setMonth(data.month ?? 1)
    setYear(data.year  ?? 2026)
    setDraftMax(data.maxDayOff != null ? String(data.maxDayOff) : "")
    setDraftFcfs(data.fcfsEnabled ?? false)
    setLoading(false)
  }, [periodId])

  useEffect(() => { load() }, [load])

  async function saveSettings() {
    setSaving(true)
    setSaveMsg("")
    const maxVal = draftMax.trim() === "" ? null : Number(draftMax)
    const res = await fetch("/api/admin/period-settings", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ periodId, maxDayOff: maxVal, fcfsEnabled: draftFcfs }),
    })
    if (res.ok) {
      setMaxDayOff(maxVal)
      setFcfsEnabled(draftFcfs)
      await load()
      setSaveMsg("Settings saved.")
    } else {
      setSaveMsg("Failed to save. Please try again.")
    }
    setSaving(false)
    setTimeout(() => setSaveMsg(""), 3000)
  }

  async function handleStatusChange(userId: string, date: string, newStatus: "CONFIRMED" | "WAITLISTED") {
    await fetch("/api/admin/availability", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ userId, date, status: newStatus }),
    })
    setDayMap((prev) => {
      const updated = { ...prev }
      if (updated[date]) {
        updated[date] = updated[date].map((e) =>
          e.userId === userId ? { ...e, status: newStatus } : e
        )
      }
      return updated
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400 animate-pulse text-sm">
        Loading availability data…
      </div>
    )
  }

  const settingsChanged =
    draftFcfs !== fcfsEnabled ||
    (draftMax.trim() === "" ? null : Number(draftMax)) !== maxDayOff

  // Build alert summary
  const allDays = Object.entries(dayMap)
  const daysAtLimit = maxDayOff
    ? allDays.filter(([,e]) => e.filter(x => x.status === "CONFIRMED").length >= maxDayOff).length
    : 0
  const totalRequests = allDays.reduce((sum, [,e]) => sum + e.length, 0)
  const highDemandDays = allDays.filter(([,e]) => {
    const conf = e.filter(x => x.status === "CONFIRMED").length
    return conf / Math.max(totalPhysicians, 1) >= 0.3
  }).length

  return (
    <div className="space-y-6">

      {/* ── Admin Alert Banner ── */}
      {totalRequests > 0 && (
        <div
          className="rounded-xl p-4 space-y-2 ring-1"
          style={{ background: "#fff8f0", borderColor: "#fed7aa" }}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">🔔</span>
            <h3 className="font-semibold text-slate-800 text-sm">Day-Off Request Summary</h3>
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="bg-white px-3 py-1.5 rounded-lg ring-1 ring-slate-200 text-slate-700">
              <strong className="text-slate-900">{allDays.filter(([,e])=>e.length>0).length}</strong> days have requests
            </span>
            <span className="bg-white px-3 py-1.5 rounded-lg ring-1 ring-slate-200 text-slate-700">
              <strong className="text-slate-900">{totalRequests}</strong> total requests
            </span>
            {highDemandDays > 0 && (
              <span className="bg-orange-50 px-3 py-1.5 rounded-lg ring-1 ring-orange-200 text-orange-800">
                ⚠ <strong>{highDemandDays}</strong> high-demand day{highDemandDays !== 1 ? "s" : ""} (≥30% off)
              </span>
            )}
            {daysAtLimit > 0 && (
              <span className="bg-red-50 px-3 py-1.5 rounded-lg ring-1 ring-red-200 text-red-800">
                🚫 <strong>{daysAtLimit}</strong> day{daysAtLimit !== 1 ? "s" : ""} at limit
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Availability Limit Settings ── */}
      <div
        className="rounded-xl p-4 space-y-4 ring-1"
        style={{ background: "#eff3ff", borderColor: "#c7d2fe" }}
      >
        <div>
          <h3 className="font-semibold" style={{ color: "#0d2580" }}>Availability Limit Settings</h3>
          <p className="text-xs mt-0.5" style={{ color: "#3730a3" }}>
            Set a cap on same-day requests and optionally enforce first-come, first-served.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          {/* Max off per day */}
          <div>
            <label className="label" style={{ color: "#1e3a8a" }}>Max physicians off per day</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={totalPhysicians}
                placeholder="No limit"
                value={draftMax}
                onChange={(e) => setDraftMax(e.target.value)}
                className="input w-32"
              />
              {draftMax && (
                <button type="button" onClick={() => setDraftMax("")}
                  className="text-xs text-slate-400 hover:text-red-500 transition">
                  Clear
                </button>
              )}
            </div>
            <p className="text-xs mt-1" style={{ color: "#4338ca" }}>
              {draftMax
                ? `Flags days where ${draftMax}+ physicians request off.`
                : "No limit set — all requests accepted."}
            </p>
          </div>

          {/* FCFS toggle */}
          <div className="space-y-1">
            <label className="label" style={{ color: "#1e3a8a" }}>First-come, first-served</label>
            <button
              type="button"
              onClick={() => setDraftFcfs((v) => !v)}
              className={`relative inline-flex h-7 w-14 items-center rounded-full transition`}
              style={{ background: draftFcfs ? "#0d2580" : "#cbd5e1" }}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                  draftFcfs ? "translate-x-8" : "translate-x-1"
                }`}
              />
            </button>
            <p className="text-xs" style={{ color: "#4338ca" }}>
              {draftFcfs
                ? "Requests over limit are auto-waitlisted."
                : "Off — all requests show as confirmed."}
            </p>
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center gap-3">
          <button
            onClick={saveSettings}
            disabled={saving || !settingsChanged}
            className="btn-primary py-2 px-4 text-sm"
          >
            {saving ? "Saving…" : "Save Settings"}
          </button>
          {saveMsg && (
            <span className={`text-sm ${saveMsg.includes("Failed") ? "text-red-600" : "text-green-700"}`}>
              {saveMsg}
            </span>
          )}
          {!settingsChanged && !saveMsg && (
            <span className="text-xs" style={{ color: "#4338ca" }}>No unsaved changes</span>
          )}
        </div>

        {fcfsEnabled && maxDayOff && (
          <div className="rounded-lg bg-white/60 border px-3 py-2 text-xs space-y-1" style={{ borderColor: "#a5b4fc", color: "#1e3a8a" }}>
            <p><strong>FCFS active</strong> — limit is {maxDayOff} physician{maxDayOff !== 1 ? "s" : ""} off per day.</p>
            <p>Waitlisted days are treated as <strong>available</strong> by the scheduler. You can manually promote/demote requests below.</p>
          </div>
        )}
      </div>

      {/* ── Heatmap ── */}
      <AvailabilityHeatmap
        year={year}
        month={month}
        dayMap={dayMap}
        maxDayOff={maxDayOff}
        fcfsEnabled={fcfsEnabled}
        totalPhysicians={totalPhysicians}
        onStatusChange={fcfsEnabled ? handleStatusChange : undefined}
      />
    </div>
  )
}
