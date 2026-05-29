"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

type ShiftLengthPref = "PREFER_24H" | "EITHER" | "PREFER_12H"

type Physician = {
  id: string
  name: string
  username: string
  isPRN: boolean
  shiftLengthPref: ShiftLengthPref
  adminTargetShifts: number | null
  adminHardCap: boolean
}

type Props = {
  initialPhysicians: Physician[]
}

export default function PhysicianSettingsTable({ initialPhysicians }: Props) {
  const router = useRouter()
  const [physicians, setPhysicians] = useState<Physician[]>(initialPhysicians)
  // Track which row is currently saving and what field
  const [saving, setSaving] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState<Record<string, boolean>>({})

  async function patch(userId: string, field: string, payload: Record<string, unknown>) {
    setSaving((s) => ({ ...s, [userId]: field }))
    setSaved((s) => ({ ...s, [userId]: false }))

    try {
      const res = await fetch("/api/admin/physician-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...payload }),
      })
      if (!res.ok) throw new Error("Save failed")
      const data = await res.json()
      // Update local state with the returned record
      setPhysicians((prev) =>
        prev.map((p) => (p.id === userId ? { ...p, ...data.user } : p))
      )
      setSaved((s) => ({ ...s, [userId]: true }))
      setTimeout(() => setSaved((s) => ({ ...s, [userId]: false })), 2000)
    } catch {
      alert("Failed to save. Please try again.")
    } finally {
      setSaving((s) => {
        const next = { ...s }
        delete next[userId]
        return next
      })
    }
  }

  function handleTargetChange(physician: Physician, raw: string) {
    const trimmed = raw.trim()
    const parsed = trimmed === "" ? null : parseInt(trimmed, 10)
    if (trimmed !== "" && (isNaN(parsed!) || parsed! < 0)) return
    setPhysicians((prev) =>
      prev.map((p) => (p.id === physician.id ? { ...p, adminTargetShifts: parsed } : p))
    )
  }

  function handleTargetBlur(physician: Physician) {
    patch(physician.id, "adminTargetShifts", { adminTargetShifts: physician.adminTargetShifts })
  }

  function handleHardCapToggle(physician: Physician) {
    const next = !physician.adminHardCap
    patch(physician.id, "adminHardCap", { adminHardCap: next })
  }

  function handleShiftPrefChange(physician: Physician, pref: ShiftLengthPref) {
    patch(physician.id, "shiftLengthPref", { shiftLengthPref: pref })
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
            <th className="pb-2 pr-4 font-semibold">Physician</th>
            <th className="pb-2 pr-4 font-semibold">Target Shifts</th>
            <th className="pb-2 pr-4 font-semibold">Hard Cap</th>
            <th className="pb-2 pr-4 font-semibold">Shift Length</th>
            <th className="pb-2 font-semibold"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {physicians.map((doc) => {
            const isSaving = Boolean(saving[doc.id])
            const wasSaved = Boolean(saved[doc.id])

            return (
              <tr key={doc.id} className="align-middle">
                {/* Name */}
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                      style={{ background: "#0d2580" }}
                    >
                      {doc.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{doc.name}</p>
                      <p className="text-xs text-slate-400">@{doc.username}</p>
                    </div>
                    {doc.isPRN && (
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                        PRN
                      </span>
                    )}
                  </div>
                </td>

                {/* Admin target shifts */}
                <td className="py-3 pr-4">
                  <input
                    type="number"
                    min={0}
                    max={31}
                    value={doc.adminTargetShifts ?? ""}
                    placeholder="—"
                    onChange={(e) => handleTargetChange(doc, e.target.value)}
                    onBlur={() => handleTargetBlur(doc)}
                    disabled={isSaving}
                    className="input w-20 text-center disabled:opacity-50"
                    aria-label={`Admin target shifts for ${doc.name}`}
                  />
                </td>

                {/* Hard cap toggle */}
                <td className="py-3 pr-4">
                  <button
                    onClick={() => handleHardCapToggle(doc)}
                    disabled={isSaving}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                      doc.adminHardCap ? "bg-[#0d2580]" : "bg-slate-300"
                    }`}
                    role="switch"
                    aria-checked={doc.adminHardCap}
                    aria-label={`Hard cap for ${doc.name}`}
                    title={doc.adminHardCap ? "Hard cap on (never exceed target)" : "Hard cap off"}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        doc.adminHardCap ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                  <span className="ml-2 text-xs text-slate-500">
                    {doc.adminHardCap ? "Hard" : "Soft"}
                  </span>
                </td>

                {/* Shift length preference — 3-way selector */}
                <td className="py-3 pr-4">
                  <div className="flex gap-1" role="group" aria-label={`Shift length preference for ${doc.name}`}>
                    {(["PREFER_24H", "EITHER", "PREFER_12H"] as ShiftLengthPref[]).map((pref) => {
                      const active = doc.shiftLengthPref === pref
                      const labels: Record<ShiftLengthPref, string> = {
                        PREFER_24H: "24h",
                        EITHER:     "Either",
                        PREFER_12H: "12h",
                      }
                      const styles: Record<ShiftLengthPref, string> = {
                        PREFER_24H: active
                          ? "bg-blue-600 text-white ring-blue-600"
                          : "bg-white text-blue-700 ring-blue-200 hover:bg-blue-50",
                        EITHER: active
                          ? "bg-slate-600 text-white ring-slate-600"
                          : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50",
                        PREFER_12H: active
                          ? "bg-amber-500 text-white ring-amber-500"
                          : "bg-white text-amber-700 ring-amber-200 hover:bg-amber-50",
                      }
                      return (
                        <button
                          key={pref}
                          onClick={() => handleShiftPrefChange(doc, pref)}
                          disabled={isSaving || active}
                          className={`px-2 py-0.5 rounded text-xs font-semibold ring-1 transition disabled:cursor-default ${styles[pref]}`}
                          title={
                            pref === "PREFER_24H" ? "Prefer 24-hour shifts (+30 score bonus)"
                            : pref === "EITHER"   ? "Works either length (no preference bonus)"
                            :                       "Prefer 12-hour shifts (+60 score bonus)"
                          }
                        >
                          {labels[pref]}
                        </button>
                      )
                    })}
                  </div>
                </td>

                {/* Save indicator */}
                <td className="py-3 text-xs">
                  {isSaving && <span className="text-slate-400">Saving…</span>}
                  {wasSaved && !isSaving && (
                    <span className="text-green-600 font-medium">Saved</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {physicians.length === 0 && (
        <p className="text-center py-8 text-slate-400 italic">No active physicians found.</p>
      )}
    </div>
  )
}
