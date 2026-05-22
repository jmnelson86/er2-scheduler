"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import NavBar from "@/components/NavBar"
import ScheduleGrid from "@/components/ScheduleGrid"
import Link from "next/link"

const MONTH_NAMES = [
  "","January","February","March","April","May","June",
  "July","August","September","October","November","December",
]

interface Period {
  id: string; month: number; year: number; status: string
}
interface Physician {
  id: string; name: string; isPRN: boolean; prefersTwelveHour: boolean; color: string
}
interface Assignment {
  id: string; date: string; shiftType: string
  userId: string | null; isLocked: boolean
  isConflict: boolean; conflictNote: string
  user: Physician | null
}

function ScheduleInner() {
  const searchParams   = useSearchParams()
  const router         = useRouter()
  const { data: session, status } = useSession()
  const periodId = searchParams.get("periodId")

  const [period,      setPeriod]      = useState<Period | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [physicians,  setPhysicians]  = useState<Physician[]>([])
  const [allPeriods,  setAllPeriods]  = useState<Period[]>([])
  const [loading,     setLoading]     = useState(true)
  const [generating,  setGenerating]  = useState(false)
  const [publishing,  setPublishing]  = useState(false)
  const [clearing,    setClearing]    = useState(false)
  const [msg,         setMsg]         = useState("")

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
    if (status === "authenticated" && session?.user?.role !== "ADMIN") router.push("/dashboard")
  }, [status, session, router])

  useEffect(() => {
    fetch("/api/admin/schedule")
      .then((r) => r.json())
      .then((data) => setAllPeriods(data.periods ?? []))
  }, [])

  useEffect(() => {
    if (!periodId) { setLoading(false); return }
    setLoading(true)
    Promise.all([
      fetch(`/api/admin/schedule?periodId=${periodId}`).then((r) => r.json()),
      fetch("/api/admin/schedule/physicians").then((r) => r.json()),
    ]).then(([schedData, physData]) => {
      setPeriod(schedData.period)
      setAssignments(schedData.assignments ?? [])
      setPhysicians(physData.physicians ?? [])
      setLoading(false)
    })
  }, [periodId])

  async function generate() {
    if (!periodId) return
    setGenerating(true)
    setMsg("")
    const res = await fetch("/api/admin/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodId }),
    })
    const data = await res.json()
    if (res.ok) {
      setAssignments(data.assignments ?? [])
      setPeriod((prev) => prev ? { ...prev, status: "DRAFT" } : prev)
      setMsg(`Generated ${data.assignments?.length ?? 0} assignments`)
    } else {
      setMsg(data.error ?? "Generation failed")
    }
    setGenerating(false)
    setTimeout(() => setMsg(""), 4000)
  }

  async function publish() {
    if (!periodId) return
    if (!confirm("Publish this schedule? Physicians will see their assignments.")) return
    setPublishing(true)
    const res = await fetch("/api/admin/schedule", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodId, status: "PUBLISHED" }),
    })
    if (res.ok) setPeriod((prev) => prev ? { ...prev, status: "PUBLISHED" } : prev)
    setPublishing(false)
  }

  async function unpublish() {
    if (!periodId) return
    setPublishing(true)
    const res = await fetch("/api/admin/schedule", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodId, status: "DRAFT" }),
    })
    if (res.ok) setPeriod((prev) => prev ? { ...prev, status: "DRAFT" } : prev)
    setPublishing(false)
  }

  async function reopenForPreferences() {
    if (!periodId) return
    if (!confirm("Reopen this period so physicians can update their preferences? The current draft schedule will be cleared.")) return
    setClearing(true)
    // Clear assignments first
    await fetch(`/api/admin/schedule?periodId=${periodId}`, { method: "DELETE" })
    // Set status back to OPEN
    const res = await fetch("/api/admin/schedule", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodId, status: "OPEN" }),
    })
    if (res.ok) {
      setAssignments([])
      setPeriod((prev) => prev ? { ...prev, status: "OPEN" } : prev)
      setMsg("Period reopened — physicians can now update preferences.")
    }
    setClearing(false)
  }

  async function clearSchedule() {
    if (!periodId) return
    if (!confirm("Clear all non-locked assignments?")) return
    setClearing(true)
    const res = await fetch(`/api/admin/schedule?periodId=${periodId}`, { method: "DELETE" })
    if (res.ok) {
      const data = await res.json()
      setAssignments(data.assignments ?? [])
      setPeriod((prev) => prev ? { ...prev, status: "DRAFT" } : prev)
    }
    setClearing(false)
  }

  async function handleReassign(assignmentId: string, userId: string | null) {
    const res = await fetch("/api/admin/schedule", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignmentId, userId }),
    })
    if (res.ok) {
      const data = await res.json()
      setAssignments((prev) =>
        prev.map((a) => a.id === assignmentId ? { ...a, ...data.assignment } : a)
      )
    }
  }

  async function handleToggleLock(assignmentId: string) {
    const a = assignments.find((x) => x.id === assignmentId)
    if (!a) return
    const res = await fetch("/api/admin/schedule", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignmentId, lock: !a.isLocked }),
    })
    if (res.ok) {
      setAssignments((prev) =>
        prev.map((x) => x.id === assignmentId ? { ...x, isLocked: !a.isLocked } : x)
      )
    }
  }

  async function handleSplit(assignmentId: string) {
    const res = await fetch("/api/admin/schedule", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "split", assignmentId }),
    })
    if (res.ok) {
      const data = await res.json()
      setAssignments((prev) => [
        ...prev.filter((a) => a.id !== data.removed),
        ...data.added,
      ])
    }
  }

  async function handleAddSlot(date: string, shiftType: "DAY12" | "NIGHT12") {
    if (!periodId) return
    const res = await fetch("/api/admin/schedule", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", periodId, date, shiftType }),
    })
    if (res.ok) {
      const data = await res.json()
      setAssignments((prev) => [...prev, data.assignment])
    }
  }

  if (status === "loading" || !session) return null

  const stats = {
    total:      assignments.length,
    filled:     assignments.filter((a) => a.userId).length,
    conflicts:  assignments.filter((a) => a.isConflict).length,
    locked:     assignments.filter((a) => a.isLocked).length,
  }

  return (
    <div className="min-h-screen" style={{ background: "#f4f6fb" }}>
      <NavBar />

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Schedule</h1>
            {period && (
              <p className="text-slate-500 mt-1 text-sm">
                {MONTH_NAMES[period.month]} {period.year} ·{" "}
                <span className={`font-medium ${
                  period.status === "PUBLISHED" ? "text-purple-600" :
                  period.status === "GENERATING" ? "text-blue-600" : "text-slate-600"
                }`}>{period.status}</span>
              </p>
            )}
          </div>
          <Link href="/admin" className="btn-secondary text-xs py-2">
            ← Admin Overview
          </Link>
        </div>

        {/* Period switcher */}
        {allPeriods.length > 1 && (
          <div className="card space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Switch period</p>
            <div className="flex flex-wrap gap-2">
              {allPeriods.map((p) => (
                <Link
                  key={p.id}
                  href={`/admin/schedule?periodId=${p.id}`}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ring-1 transition ${
                    periodId === p.id
                      ? "bg-blue-700 text-white ring-blue-700"
                      : "bg-white text-slate-600 ring-slate-200 hover:ring-blue-300"
                  }`}
                >
                  {MONTH_NAMES[p.month]} {p.year}
                </Link>
              ))}
            </div>
          </div>
        )}

        {!periodId && (
          <div className="card text-center py-12 text-slate-400">
            Select a period above or create one from Admin Overview.
          </div>
        )}

        {periodId && !loading && period && (
          <>
            {/* Controls */}
            <div className="card space-y-4">
              <div className="flex flex-wrap gap-3 items-center">
                <button
                  onClick={generate}
                  disabled={generating || period.status === "PUBLISHED"}
                  className="btn-primary text-sm"
                >
                  {generating ? "Generating…" : "⚡ Generate Schedule"}
                </button>

                {assignments.length > 0 && period.status !== "PUBLISHED" && (
                  <>
                    <button onClick={publish} disabled={publishing} className="btn-danger text-sm">
                      {publishing ? "Publishing…" : "🚀 Publish"}
                    </button>
                    <button onClick={clearSchedule} disabled={clearing} className="btn-danger text-sm">
                      {clearing ? "Clearing…" : "Clear Schedule"}
                    </button>
                  </>
                )}

                {period.status === "PUBLISHED" && (
                  <button onClick={unpublish} disabled={publishing} className="btn-secondary text-sm">
                    Unpublish
                  </button>
                )}

                {(period.status === "DRAFT" || period.status === "GENERATING") && (
                  <button
                    onClick={reopenForPreferences}
                    disabled={clearing}
                    className="btn-secondary text-sm"
                    title="Clear the draft schedule and reopen the period so physicians can submit preferences"
                  >
                    ↩ Reopen for Preferences
                  </button>
                )}

                {msg && (
                  <span className={`text-sm ${msg.includes("fail") || msg.includes("error") ? "text-red-600" : "text-green-700"}`}>
                    {msg}
                  </span>
                )}
              </div>

              {/* Stats */}
              {assignments.length > 0 && (
                <div className="flex flex-wrap gap-4 text-sm">
                  <span className="text-slate-600">
                    <strong className="text-slate-900">{stats.filled}</strong>/{stats.total} filled
                  </span>
                  {stats.conflicts > 0 && (
                    <span className="text-red-600 font-medium">⚠ {stats.conflicts} conflict{stats.conflicts !== 1 ? "s" : ""}</span>
                  )}
                  {stats.locked > 0 && (
                    <span className="text-slate-500">🔒 {stats.locked} locked</span>
                  )}
                </div>
              )}
            </div>

            {/* Schedule grid */}
            {assignments.length > 0 ? (
              <div className="card">
                <ScheduleGrid
                  year={period.year}
                  month={period.month}
                  assignments={assignments}
                  physicians={physicians}
                  onReassign={handleReassign}
                  onToggleLock={handleToggleLock}
                  onSplit={period.status !== "PUBLISHED" ? handleSplit : undefined}
                  onAddSlot={period.status !== "PUBLISHED" ? handleAddSlot : undefined}
                />
              </div>
            ) : (
              <div className="card text-center py-12 text-slate-400">
                No assignments yet. Click Generate to auto-schedule.
              </div>
            )}
          </>
        )}

        {loading && (
          <div className="card text-center py-12 text-slate-400 animate-pulse">Loading…</div>
        )}
      </main>
    </div>
  )
}

export default function AdminSchedulePage() {
  return (
    <Suspense>
      <ScheduleInner />
    </Suspense>
  )
}
