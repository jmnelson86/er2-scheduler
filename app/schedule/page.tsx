import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import NavBar from "@/components/NavBar"

const MONTH_NAMES = [
  "","January","February","March","April","May","June",
  "July","August","September","October","November","December",
]

const SHIFT_LABEL: Record<string, string> = {
  "24H":   "24-hour  9AM–9AM",
  DAY12:   "Day  9AM–9PM",
  NIGHT12: "Night  9PM–9AM",
}
const SHIFT_COLOR: Record<string, string> = {
  "24H":   "bg-blue-100 text-blue-800",
  DAY12:   "bg-amber-100 text-amber-800",
  NIGHT12: "bg-indigo-100 text-indigo-800",
}

export default async function MySchedulePage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")
  if (session.user.role === "ADMIN") redirect("/admin")

  const now      = new Date()
  const thisYear = now.getFullYear()
  const thisMon  = now.getMonth() + 1

  const assignments = await prisma.shiftAssignment.findMany({
    where:   { userId: session.user.id },
    include: { period: true },
    orderBy: { date: "asc" },
  })

  // Group by period
  const byPeriod: Record<string, typeof assignments> = {}
  for (const a of assignments) {
    const key = a.period.id
    if (!byPeriod[key]) byPeriod[key] = []
    byPeriod[key].push(a)
  }

  const periods = Object.values(byPeriod)
    .map((arr) => arr[0].period)
    .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month)

  return (
    <div className="min-h-screen" style={{ background: "#f4f6fb" }}>
      <NavBar />

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">My Schedule</h1>

        {periods.length === 0 && (
          <div className="card text-center py-10 text-slate-400">
            No shifts scheduled yet.
          </div>
        )}

        {periods.map((period) => {
          const shifts = byPeriod[period.id]
          const isPast = period.year < thisYear || (period.year === thisYear && period.month < thisMon)
          return (
            <div key={period.id} className="card space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-slate-800">
                  {MONTH_NAMES[period.month]} {period.year}
                  {isPast && <span className="ml-2 text-xs text-slate-400">(past)</span>}
                </h2>
                <span className="text-sm text-slate-500">{shifts.length} shift{shifts.length !== 1 ? "s" : ""}</span>
              </div>

              <div className="space-y-1.5">
                {shifts.map((a) => {
                  const d = new Date(a.date + "T12:00:00")
                  const today = new Date(); today.setHours(0,0,0,0)
                  const isToday = d.toDateString() === new Date().toDateString()
                  return (
                    <div
                      key={a.id}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-lg ${
                        isToday ? "bg-blue-50 ring-2 ring-blue-300" : "bg-slate-50"
                      }`}
                    >
                      <div>
                        <p className="font-medium text-slate-700 text-sm">
                          {isToday && <span className="text-blue-600 mr-1">●</span>}
                          {d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">{SHIFT_LABEL[a.shiftType]}</p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${SHIFT_COLOR[a.shiftType]}`}>
                        {a.shiftType}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </main>
    </div>
  )
}
