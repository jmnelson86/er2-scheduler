import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import NavBar from "@/components/NavBar"
import Link from "next/link"
import CreatePeriodForm from "@/components/CreatePeriodForm"

const MONTH_NAMES = [
  "","January","February","March","April","May","June",
  "July","August","September","October","November","December",
]

const STATUS_STYLE: Record<string, string> = {
  DRAFT:      "bg-slate-100 text-slate-600",
  OPEN:       "bg-green-100 text-green-700",
  GENERATING: "bg-blue-100 text-blue-700",
  PUBLISHED:  "bg-purple-100 text-purple-700",
}

export default async function AdminPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")
  if (session.user.role !== "ADMIN") redirect("/dashboard")

  const [periods, physicians, totalFT] = await Promise.all([
    prisma.schedulePeriod.findMany({
      orderBy: [{ year: "desc" }, { month: "desc" }],
      include: { _count: { select: { assignments: true, preferences: true } } },
    }),
    prisma.user.findMany({
      where: { role: "PHYSICIAN", isActive: true },
      orderBy: [{ isPRN: "asc" }, { name: "asc" }],
    }),
    prisma.user.count({ where: { role: "PHYSICIAN", isActive: true, isPRN: false } }),
  ])

  // Submission counts for open periods
  const openPeriods = periods.filter((p) => p.status === "OPEN" || p.status === "DRAFT")
  const submissionCounts: Record<string, number> = {}
  for (const p of openPeriods) {
    submissionCounts[p.id] = await prisma.physicianPreference.count({
      where: { periodId: p.id, submittedAt: { not: null } },
    })
  }

  return (
    <div className="min-h-screen" style={{ background: "#f4f6fb" }}>
      <NavBar />

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Overview</h1>
          <div className="tc-divider" />
          <p className="text-slate-500 mt-2 text-sm">TotalCare Denton · Manage schedule periods and physicians.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="card text-center">
            <p className="text-3xl font-bold text-blue-600">{physicians.filter((p) => !p.isPRN).length}</p>
            <p className="text-xs text-slate-500 mt-1">Full-Time Physicians</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-purple-600">{physicians.filter((p) => p.isPRN).length}</p>
            <p className="text-xs text-slate-500 mt-1">PRN Physicians</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-slate-700">{periods.length}</p>
            <p className="text-xs text-slate-500 mt-1">Total Periods</p>
          </div>
        </div>

        {/* All-submitted banners */}
        {openPeriods
          .filter((p) => totalFT > 0 && (submissionCounts[p.id] ?? 0) >= totalFT)
          .map((p) => (
            <div
              key={`banner-${p.id}`}
              className="flex items-center justify-between gap-4 px-5 py-4 rounded-xl bg-green-50 ring-2 ring-green-300 flex-wrap"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">✅</span>
                <div>
                  <p className="font-semibold text-green-800 text-sm">
                    All physicians have submitted for {MONTH_NAMES[p.month]} {p.year}
                  </p>
                  <p className="text-xs text-green-700 mt-0.5">
                    {submissionCounts[p.id]} / {totalFT} full-time physicians submitted — ready to generate the schedule.
                  </p>
                </div>
              </div>
              <Link
                href={`/admin/schedule?periodId=${p.id}`}
                className="btn-primary text-sm py-2 px-4 shrink-0"
              >
                Generate Schedule →
              </Link>
            </div>
          ))
        }

        {/* Create period */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-slate-800">Open New Schedule Period</h2>
          <CreatePeriodForm />
        </div>

        {/* Periods list */}
        <div className="space-y-3">
          <h2 className="font-semibold text-slate-800">Schedule Periods</h2>
          {periods.length === 0 && (
            <div className="card text-center py-8 text-slate-400">
              No periods yet. Create one above.
            </div>
          )}
          {periods.map((period) => (
            <div key={period.id} className="card flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div>
                  <p className="font-semibold text-slate-800">
                    {MONTH_NAMES[period.month]} {period.year}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {period._count.preferences} preference{period._count.preferences !== 1 ? "s" : ""},&nbsp;
                    {period._count.assignments} assignment{period._count.assignments !== 1 ? "s" : ""}
                  </p>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_STYLE[period.status]}`}>
                  {period.status}
                </span>
              </div>
              <div className="flex gap-2">
                <Link href={`/admin/physicians?periodId=${period.id}`} className="btn-secondary text-xs py-1.5">
                  Preferences
                </Link>
                <Link href={`/admin/schedule?periodId=${period.id}`} className="btn-primary text-xs py-1.5">
                  Schedule →
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Physician roster */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Physician Roster</h2>
            <span className="text-xs text-slate-400">{physicians.length} active</span>
          </div>
          <div className="divide-y divide-slate-100">
            {physicians.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs shrink-0">
                    {doc.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    <p className="font-medium text-slate-700 text-sm">{doc.name}</p>
                    <p className="text-xs text-slate-400">@{doc.username}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {doc.isPRN && (
                    <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">PRN</span>
                  )}
                  <span className={`px-2 py-0.5 rounded-full ${
                    doc.prefersTwelveHour
                      ? "bg-amber-100 text-amber-700"
                      : "bg-blue-100 text-blue-700"
                  }`}>
                    {doc.prefersTwelveHour ? "12h pref" : "24h pref"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
