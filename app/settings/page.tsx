"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import NavBar from "@/components/NavBar"

const COLOR_PALETTE = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#14b8a6", "#06b6d4", "#3b82f6", "#6366f1",
  "#8b5cf6", "#ec4899", "#f43f5e", "#84cc16",
  "#10b981", "#a855f7", "#0ea5e9", "#64748b",
]

interface Settings {
  name: string
  username: string
  color: string
  prefersTwelveHour: boolean
}

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [settings, setSettings]   = useState<Settings | null>(null)
  const [selected, setSelected]   = useState<string>("#6366f1")
  const [saving,   setSaving]     = useState(false)
  const [msg,      setMsg]        = useState("")

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  useEffect(() => {
    if (status !== "authenticated") return
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data: Settings) => {
        setSettings(data)
        setSelected(data.color ?? "#6366f1")
      })
  }, [status])

  async function handleSave() {
    setSaving(true)
    setMsg("")
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ color: selected }),
    })
    setSaving(false)
    if (res.ok) {
      setSettings((prev) => prev ? { ...prev, color: selected } : prev)
      setMsg("Color saved!")
    } else {
      setMsg("Failed to save.")
    }
    setTimeout(() => setMsg(""), 3000)
  }

  if (status === "loading" || !session || !settings) return null

  return (
    <div className="min-h-screen" style={{ background: "#f4f6fb" }}>
      <NavBar />
      <main className="max-w-lg mx-auto px-4 py-10 space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>

        {/* Profile */}
        <div className="card space-y-3">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Profile</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Name</p>
              <p className="font-medium text-slate-800">{settings.name}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Username</p>
              <p className="font-medium text-slate-800">{settings.username}</p>
            </div>
          </div>
        </div>

        {/* My Color */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">My Calendar Color</h2>
          <p className="text-xs text-slate-500">
            Choose the color that represents you on the schedule calendar.
          </p>
          <div className="grid grid-cols-8 gap-2">
            {COLOR_PALETTE.map((hex) => (
              <button
                key={hex}
                type="button"
                onClick={() => setSelected(hex)}
                className="w-8 h-8 rounded-full flex items-center justify-center transition focus:outline-none"
                style={{
                  backgroundColor: hex,
                  outline: selected === hex ? `3px solid ${hex}` : "none",
                  outlineOffset: "2px",
                }}
                title={hex}
              >
                {selected === hex && (
                  <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none">
                    <path d="M3 8l3.5 3.5L13 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving || selected === settings.color}
              className="btn-primary text-sm"
            >
              {saving ? "Saving…" : "Save Color"}
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span
                className="w-5 h-5 rounded-full border border-slate-200"
                style={{ backgroundColor: selected }}
              />
              <span>{selected}</span>
            </div>
            {msg && (
              <span className={`text-xs ${msg.includes("Failed") ? "text-red-600" : "text-green-700"}`}>
                {msg}
              </span>
            )}
          </div>
        </div>

        {/* Shift preference */}
        <div className="card space-y-3">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Shift Preference</h2>
          <div className="text-sm">
            <p className="text-xs text-slate-500 mb-0.5">Preferred shift length</p>
            <p className="font-medium text-slate-800">
              {settings.prefersTwelveHour ? "12-hour shifts" : "24-hour shifts"}
            </p>
          </div>
          <p className="text-xs text-slate-400">Contact an admin to change your shift preference.</p>
        </div>
      </main>
    </div>
  )
}
