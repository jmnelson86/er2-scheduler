import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import NavBar from "@/components/NavBar"
import { format } from "date-fns"
import Link from "next/link"
import AvailabilityPanel from "@/components/AvailabilityPanel"

const MONTH_NAMES = [
  "","January","February","March","April","May","June",
  "July","August","September","October","November","December",
]
const BLOCK_COLOR: Record<string, string> = {
  VACATION: "bg-orange-100 text-orange-700",
  PERSONAL: "bg-red-100 text-red-700",
  OTHER:    "bg-purple-100 text-purple-700",
}

export default async function PhysiciansPage({
  searchParams,
}: {
  searchParams: Promise<{ periodId?: string; tab?: string }>
}) {
  const { periodId: periodIdParam, tab } = await searchParams

  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")
  if (session.user.role !== "ADMIN") redirect("/dashboard")

  let period = periodIdParam
    ? await prisma.schedulePeriod.findUnique({ where: { id: periodIdParam } })
    : null

  if (!period) {
    period = await prisma.schedulePeriod.findFirst({
      where: { status: { in: ["OPEN", "DRAFT", "GENERATING"] } },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    })
  }

  const allPeriods = await prisma.schedulePeriod.findMany({
    where: { status: { not: "PUBLISHED" } },
    orderBy: [{ year: "asc" }, { month: "asc" }],
  })

  const physicians = await prisma.user.findMany({
    where: { isActive: true, role: "PHYSICIAN" },
    orderBy: [{ isPRN: "asc" }, { name: "asc" }],
    include: {
      preferences: period ? { where: { periodId: period.id } } : false,
      blockedDates: period
        ? {
            where: { date: { startsWith: `${period.year}-${String(period.month).padStart(2, "0")}` } },
            orderBy: { date: "asc" },
          }
        : false,
    },
  })

  const submitted    = period ? physicians.filter((d) => (d.preferences as any)?.[0]?.submittedAt).length : 0
  const totalRegular = physicians.filter((d) => !d.isPRN).length

  const activeTab = tab ?? "submissions"

  return (
    <div className="min-h-screen" style={{ background: "#f4f6fb" }}>
      <NavBar />

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Physician Preferences</h1>
            <p className="text-slate-500 mt-1 text-sm">
              {period
                ? `Showing submissions for ${MONTH_NAMES[period.month]} ${period.year}`
                : "No active period selected"}
            </p>
          </div>
          <Link href="/admin" className="btn-secondary text-xs py-2">← Admin Overview</Link>
        </div>

        {/* Period switcher */}
        {allPeriods.length > 1 && (
          <div className="card space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Switch period</p>
            <div className="flex flex-wrap gap-2">
              {allPeriods.map((p) => (
                <Link
                  key={p.id}
                  href={`/admin/physicians?periodId=${p.id}&tab=${activeTab}`}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ring-1 transition ${
                    period?.id === p.id
                      ? "text-white ring-0"
                      : "bg-white text-slate-600 ring-slate-200 hover:ring-blue-300"
                  }`}
                  style={period?.id === p.id ? { background: "#0d2580" } : {}}
                >
                  {MONTH_NAMES[p.month]} {p.year}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Submission progress */}
        {period && (
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">Submissions</h2>
              <span className="text-sm text-slate-500">
                {submitted} of {totalRegular} regular physicians
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
              <div
                className="h-3 rounded-full transition-all"
                style={{
                  width: `${totalRegular > 0 ? (submitted / totalRegular) * 100 : 0}%`,
                  background: "#0d2580",
                }}
              />
            </div>
          </div>
        )}

        {!period && (
          <div className="card text-center py-10 text-slate-400">
            No active period. Open one from Admin Overview.
          </div>
        )}

        {/* ── Tabs ── */}
        {period && (
          <>
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
              <Link
                href={`/admin/physicians?periodId=${period.id}&tab=submissions`}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  activeTab === "submissions"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                📋 Submissions
              </Link>
              <Link
                href={`/admin/physicians?periodId=${period.id}&tab=availability`}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  activeTab === "availability"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                🗓 Availability
              </Link>
            </div>

            {/* Availability tab */}
            {activeTab === "availability" && (
              <AvailabilityPanel
                periodId={period.id}
                totalPhysicians={totalRegular}
              />
            )}
          </>
        )}

        {/* Submissions tab */}
        {period && activeTab === "submissions" && (
          <>
            {/* Legend */}
            <div className="flex flex-wrap gap-3 text-xs">
              {[
                { cls: "bg-green-50 text-green-700 ring-green-200", dot: "bg-green-400", label: "Submitted" },
                { cls: "bg-amber-50 text-amber-700 ring-amber-200",  dot: "bg-amber-400",  label: "Draft" },
                { cls: "bg-slate-100 text-slate-500 ring-slate-200", dot: "bg-slate-300",  label: "Not started" },
              ].map((s) => (
                <span key={s.label} className={`flex items-center gap-1.5 px-2 py-1 rounded-full ring-1 ${s.cls}`}>
                  <span className={`w-2 h-2 rounded-full ${s.dot}`} /> {s.label}
                </span>
              ))}
            </div>

            {/* Physician cards */}
            <div className="space-y-4">
              {physicians.map((doc) => {
                const pref    = (doc.preferences as any)?.[0] ?? null
                const blocked = (doc.blockedDates as any) ?? []

                const submissionStatus = pref?.submittedAt ? "submitted" : pref ? "draft" : "none"
                const statusStyles: Record<string, string> = {
                  submitted: "bg-green-100 text-green-700",
                  draft:     "bg-amber-100 text-amber-700",
                  none:      "bg-slate-100 text-slate-500",
                }
                const statusText: Record<string, string> = {
                  submitted: pref?.submittedAt ? `Submitted ${format(new Date(pref.submittedAt), "MMM d")}` : "Submitted",
                  draft:     "Draft saved",
                  none:      "Not started",
                }

                return (
                  <div key={doc.id} className="card space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                          style={{ background: "#0d2580" }}
                        >
                          {doc.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{doc.name}</p>
                          <p className="text-xs text-slate-400">@{doc.username}</p>
                        </div>
                        <div className="flex gap-1.5">
                          {doc.isPRN && (
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">PRN</span>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            doc.prefersTwelveHour
                              ? "bg-amber-100 text-amber-700"
                              : "bg-blue-100 text-blue-700"
                          }`}>
                            {doc.prefersTwelveHour ? "12h pref" : "24h pref"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {pref && (
                          <span className="text-sm font-semibold" style={{ color: "#0d2580" }}>
                            {pref.targetShifts} shifts requested
                          </span>
                        )}
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusStyles[submissionStatus]}`}>
                          {statusText[submissionStatus]}
                        </span>
                      </div>
                    </div>

                    {blocked.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-2">
                          Blocked dates ({blocked.length})
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {blocked.map((b: any) => (
                            <span
                              key={b.date}
                              className={`text-xs px-2 py-0.5 rounded-full ${BLOCK_COLOR[b.type]}`}
                            >
                              {format(new Date(b.date + "T12:00:00"), "MMM d")}
                              {b.status === "WAITLISTED" && " ⏳"}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {pref?.notes && (
                      <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 italic">
                        &quot;{pref.notes}&quot;
                      </div>
                    )}

                    {!pref && blocked.length === 0 && (
                      <p className="text-sm text-slate-400 italic">No preferences entered yet.</p>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
