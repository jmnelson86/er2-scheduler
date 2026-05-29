"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import NavBar from "@/components/NavBar"

export default function AdminSettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [currentPw, setCurrentPw] = useState("")
  const [newPw,     setNewPw]     = useState("")
  const [confirmPw, setConfirmPw] = useState("")
  const [saving,    setSaving]    = useState(false)
  const [msg,       setMsg]       = useState("")
  const [error,     setError]     = useState("")

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
    if (status === "authenticated" && (session?.user as any)?.role !== "ADMIN") router.push("/dashboard")
  }, [status, session, router])

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setMsg(""); setError("")
    if (newPw !== confirmPw) { setError("New passwords do not match"); return }
    if (newPw.length < 6)    { setError("New password must be at least 6 characters"); return }

    setSaving(true)
    const res = await fetch("/api/account/password", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
    })
    setSaving(false)

    if (res.ok) {
      setMsg("Password updated successfully.")
      setCurrentPw(""); setNewPw(""); setConfirmPw("")
    } else {
      const data = await res.json()
      setError(data.error ?? "Failed to update password")
    }
  }

  if (status === "loading" || !session) return null

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <main className="max-w-lg mx-auto px-4 py-10 space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Admin Settings</h1>

        <div className="card space-y-4">
          <h2 className="text-base font-semibold text-slate-800">Change Password</h2>
          <form onSubmit={handleChangePassword} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Current password</label>
              <input
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                required
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">New password</label>
              <input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                required
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Confirm new password</label>
              <input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                required
                className="input w-full"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {msg   && <p className="text-sm text-green-700">{msg}</p>}
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Saving…" : "Update Password"}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
