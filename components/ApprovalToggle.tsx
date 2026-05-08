"use client"

import { useState } from "react"

type Props = {
  initialValue: boolean
}

export default function ApprovalToggle({ initialValue }: Props) {
  const [enabled, setEnabled] = useState(initialValue)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const toggle = async () => {
    const newValue = !enabled
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "shiftOfferApproval", value: newValue ? "true" : "false" }),
      })
      if (!res.ok) throw new Error("Failed to save")
      setEnabled(newValue)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      alert("Failed to save setting.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={toggle}
        disabled={saving}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
          enabled ? "bg-[#0d2580]" : "bg-slate-300"
        } disabled:opacity-50`}
        role="switch"
        aria-checked={enabled}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            enabled ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
      <span className="text-sm text-slate-700">
        {enabled ? "Admin approval required" : "Auto-approve (no admin approval needed)"}
      </span>
      {saved && <span className="text-xs text-green-600 font-medium">Saved</span>}
    </div>
  )
}
