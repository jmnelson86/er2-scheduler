"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import NavBar from "@/components/NavBar"
import Link from "next/link"

interface PhysicianRow {
  id:                string
  name:              string
  username:          string
  isPRN:             boolean
  prefersTwelveHour: boolean
  adminTargetShifts: number | null
  adminHardCap:      boolean
  // loaded separately per period
  minShifts?:        number | null
  targetShifts?:     number | null
  maxShifts?:        number | null
}

interface Period {
  id: string; month: number; year: number; status: string
}

const MONTH_NAMES = [
  "","January","February","March","April","May","June",
  "July","August","September","October","November","December",
]

export default function PhysicianSettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [physicians, setPhysicians] = useState<PhysicianRow[]>([])
  const [periods, setPeriods]       = useState<Period[]>([])
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null)
  const [saving, setSaving]         = useState<Record<string, boolean>>({})
  const [saved, setSaved]           = useState<Record<string, boolean>>({})
  const [loading, setLoading]       = useState(true)

  // Local edit state per physician
  const [edits, setEdits] = useState<Record<string, { adminTargetShifts: string; adminHardCap: boolean; prefersTwelveHour: boolean }>>({})

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
    if (status === "authenticated" && session?.user?.role !== "ADMIN") router.push("/dashboard")
  }, [status, session, router])

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/physician-settings").then((r) => r.json()),
      fetch("/api/periods/open").then((r) => r.json()),
    ]).then(([settingsData, periodsData]) => {
      const docs: PhysicianRow[] = settingsData.physicians ?? []
      setPhysicians(docs)
      const initialEdits: typeof edits = {}
      for (const d of docs) {
        initialEdits[d.id] = {
          adminTargetShifts: d.adminTargetShifts != null ? String(d.adminTargetShifts) : "",
          adminHardCap:      d.adminHardCap,
          prefersTwelveHour: d.prefersTwelveHour,
        }
      }
      setEdits(initialEdits)

      const allPeriods: Period[] = periodsData.periods ?? []
      setPeriods(allPeriods)
      if (allPeriods.length > 0) setSelectedPeriodId(allPeriods[0].id)
      setLoading(false)
    })
  }, [])

  // Load physician preferences for selected period
  useEffect(() => {
    if (!selectedPeriodId || physicians.length === 0) return
    fetch(`/api/admin/physician-preferences?periodId=${selectedPeriodId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.preferences) return
        const prefMap: Record<string, { minShifts: number | null; targetShifts: number | null; maxShifts: number | null }> = {}
        for (const pref of data.preferences) {
          prefMap[pref.userId] = {
            minShifts:    pref.minShifts ?? null,
            targetShifts: pref.targetShifts ?? null,
            maxShifts:    pref.maxShifts ?? null,
          }
        }
        setPhysicians((prev) =>
          prev.map((p) => ({
            ...p,
            minShifts:    prefMap[p.id]?.minShifts ?? null,
            targetShifts: prefMap[p.id]?.targetShifts ?? null,
            maxShifts:    prefMap[p.id]?.maxShifts ?? null,
          }))
        )
      })
      .catch(() => {/* preferences endpoint may not exist yet */})
  }, [selectedPeriodId, physicians.length])

  function setEdit(userId: string, field: "adminTargetShifts" | "adminHardCap" | "prefersTwelveHour", value: string | boolean) {
    setEdits((prev) => ({ ...prev, [userId]: { ...prev[userId], [field]: value } }))
  }

  async function handleSave(userId: string) {
    setSaving((prev) => ({ ...prev, [userId]: true }))
    const edit = edits[userId]
    const adminTargetShifts = edit.adminTargetShifts !== "" ? Number(edit.adminTargetShifts) : null
    await fetch("/api/admin/physician-settings", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        userId,
        adminTargetShifts,
        adminHardCap:      edit.adminHardCap,
        prefersTwelveHour: edit.prefersTwelveHour,
      }),
    })
    setSaving((prev) => ({ ...prev, [userId]: false }))
    setSaved((prev) => ({ ...prev, [userId]: true }))
    setTimeout(() => setSaved((prev) => ({ ...prev, [userId]: false })), 2000)
  }

  if (status === "loading" || !session || loading) return null

  return (
    <div className="min-h-screen" style={{ background: "#f4f6fb" }}>
      <NavBar />

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Physician Shift Settings</h1>
            <p className="text-slate-500 mt-1 text-sm">
              Set per-physician admin targets and hard caps. These override physician requests during scheduling.
            </p>
          </div>
          <Link href="/admin" className="btn-secondary text-sm">
            &larr; Admin Overview
          </Link>
        </div>

        {/* Period selector for context */}
        {periods.length > 0 && (
          <div className="card space-y-2">
            <p className="text-sm font-medium text-slate-700">
              Show physician requests from period:
            </p>
            <div className="flex flex-wrap gap-2">
              {periods.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPeriodId(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ring-1 transition ${
                    selectedPeriodId === p.id
                      ? "bg-blue-700 text-white ring-blue-700"
                      : "bg-white text-slate-600 ring-slate-200 hover:ring-blue-300"
                  }`}
                >
                  {MONTH_NAMES[p.month]} {p.year}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Table */}
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-3 font-medium">Physician</th>
                <th className="px-4 py-3 font-medium">Admin Target</th>
                <th className="px-4 py-3 font-medium">Hard Cap</th>
                <th className="px-4 py-3 font-medium">Shift Length</th>
                <th className="px-4 py-3 font-medium text-slate-400">
                  Physician Request (min / ideal / max)
                </th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {physicians.map((doc) => {
                const edit = edits[doc.id] ?? { adminTargetShifts: "", adminHardCap: false, prefersTwelveHour: false }
                const isSaving = saving[doc.id] ?? false
                const isSaved  = saved[doc.id]  ?? false
                return (
                  <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{doc.name}</div>
                      <div className="text-xs text-slate-400">
                        @{doc.username}{doc.isPRN ? " · PRN" : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={1}
                        max={31}
                        placeholder="—"
                        value={edit.adminTargetShifts}
                        onChange={(e) => setEdit(doc.id, "adminTargetShifts", e.target.value)}
                        className="input w-20 text-center"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={edit.adminHardCap}
                          onChange={(e) => setEdit(doc.id, "adminHardCap", e.target.checked)}
                          className="w-4 h-4 rounded accent-blue-600"
                        />
                        <span className="text-xs text-slate-600">
                          {edit.adminHardCap ? "Hard cap" : "Soft cap"}
                        </span>
                      </label>
                    </td>
                    {/* Shift length preference toggle */}
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setEdit(doc.id, "prefersTwelveHour", !edit.prefersTwelveHour)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold ring-1 transition ${
                          edit.prefersTwelveHour
                            ? "bg-amber-100 text-amber-700 ring-amber-300 hover:bg-amber-200"
                            : "bg-blue-100 text-blue-700 ring-blue-300 hover:bg-blue-200"
                        }`}
                        title="Click to toggle shift length preference"
                        aria-label={`Shift length preference for ${doc.name}`}
                      >
                        {edit.prefersTwelveHour ? "12h shifts" : "24h shifts"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {doc.targetShifts != null ? (
                        <span>
                          {doc.minShifts ?? "—"} / <strong className="text-slate-700">{doc.targetShifts}</strong> / {doc.maxShifts ?? "—"}
                        </span>
                      ) : (
                        <span className="text-slate-300 italic">No submission yet</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleSave(doc.id)}
                        disabled={isSaving}
                        className="btn-primary text-xs py-1.5 px-3"
                      >
                        {isSaving ? "Saving…" : isSaved ? "Saved ✓" : "Save"}
                      </button>
                    </td>
                  </tr>
                )
              })}
              {physicians.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    No active physicians found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg bg-blue-50 ring-1 ring-blue-100 px-4 py-3 text-xs text-blue-800 space-y-1">
          <p><strong>Admin Target:</strong> Overrides the physician&apos;s ideal shift count during scheduling. Leave blank to use the physician&apos;s own request.</p>
          <p><strong>Hard Cap:</strong> When checked, the scheduler will never assign more shifts than the admin target. When unchecked, the admin target is used for scoring only (soft guidance).</p>
          <p><strong>Shift Length:</strong> Sets whether the physician prefers 12-hour (day/night) or 24-hour shifts. Click the button to toggle, then click Save.</p>
        </div>
      </main>
    </div>
  )
}
