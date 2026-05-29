import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import NavBar from "@/components/NavBar"
import Link from "next/link"

const MONTH_NAMES = [
  "", "January","February","March","April","May","June",
  "July","August","September","October","November","December",
]

const SHIFT_LABEL: Record<string, string> = {
  "24H":    "24-hour (9AM–9AM)",
  DAY12:    "Day 12h (9AM–9PM)",
  NIGHT12:  "Night 12h (9PM–9AM)",
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")
  if (session.user.role === "ADMIN") redirect("/admin")

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, isPRN: true, shiftLengthPref: true },
  })

  // Open periods
  const openPeriods = await prisma.schedulePeriod.findMany({
    where: { status: { in: ["OPEN", "DRAFT"] } },
    orderBy: [{ year: "asc" }, { month: "asc" }],
  })

  // Upcoming published shifts
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`

  const upcoming = await prisma.shiftAssignment.findMany({
    where: { userId: session.user.id, date: { gte: todayStr } },
    include: { period: true },
    orderBy: { date: "asc" },
    take: 5,
  })

  // Preference status for each open period
  const prefs = await prisma.physicianPreference.findMany({
    where: {
      userId:   session.user.id,
      periodId: { in: openPeriods.map((p) => p.id) },
    },
  })
  const prefByPeriod = Object.fromEntries(prefs.map((p) => [p.periodId, p]))

  return (
    <div className="min-h-screen" style={{ background: "#f4f6fb" }}>
      <NavBar />

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Welcome */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Welcome, {user?.name?.replace("Dr. ", "Dr. ")}
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Shift preference: <span className="font-medium text-slate-700">
              {user?.shiftLengthPref === "PREFER_12H" ? "12-hour shifts"
                : user?.shiftLengthPref === "EITHER"  ? "either length"
                : "24-hour shifts"}
            </span>
            {user?.isPRN && <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">PRN</span>}
          </p>
        </div>

        {/* Open periods needing preferences */}
        {openPeriods.length > 0 && (
          <div className="card space-y-3">
            <h2 className="font-semibold text-slate-800">Open Periods</h2>
            <div className="space-y-2">
              {openPeriods.map((period) => {
                const pref = prefByPeriod[period.id]
                const status = pref?.submittedAt ? "submitted" : pref ? "draft" : "none"
                return (
                  <div key={period.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <p className="font-medium text-slate-700">
                        {MONTH_NAMES[period.month]} {period.year}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {status === "submitted" ? "✅ Preferences submitted" :
                         status === "draft"     ? "⏳ Draft saved" :
                                                  "⚪ No preferences yet"}
                      </p>
                    </div>
                    <Link
                      href={`/preferences?periodId=${period.id}`}
                      className="btn-primary text-sm py-1.5 px-3"
                    >
                      {status === "none" ? "Submit Preferences" : "Edit Preferences"}
                    </Link>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Upcoming shifts */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Upcoming Shifts</h2>
            <Link href="/schedule" className="text-xs text-blue-600 hover:underline">View all →</Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm text-slate-400 italic py-2">No upcoming shifts scheduled yet.</p>
          ) : (
            <div className="space-y-2">
              {upcoming.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-700">
                      {new Date(a.date + "T12:00:00").toLocaleDateString("en-US", {
                        weekday: "short", month: "short", day: "numeric",
                      })}
                    </p>
                    <p className="text-xs text-slate-500">{SHIFT_LABEL[a.shiftType]}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    a.shiftType === "24H"    ? "bg-blue-100 text-blue-700" :
                    a.shiftType === "DAY12"  ? "bg-amber-100 text-amber-700" :
                                               "bg-indigo-100 text-indigo-700"
                  }`}>
                    {a.shiftType}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
