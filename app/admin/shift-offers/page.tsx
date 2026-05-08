import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import NavBar from "@/components/NavBar"
import ApprovalToggle from "@/components/ApprovalToggle"
import AdminOfferActions from "@/components/AdminOfferActions"

const MONTH_NAMES = [
  "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

const SHIFT_COLOR: Record<string, string> = {
  "24H":   "bg-blue-100 text-blue-800",
  DAY12:   "bg-amber-100 text-amber-800",
  NIGHT12: "bg-indigo-100 text-indigo-800",
}

const STATUS_COLOR: Record<string, string> = {
  PENDING:   "bg-yellow-100 text-yellow-800",
  ACCEPTED:  "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-slate-100 text-slate-500",
  DENIED:    "bg-red-100 text-red-800",
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00")
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
}

export default async function AdminShiftOffersPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")
  if ((session.user as any).role !== "ADMIN") redirect("/dashboard")

  const [offers, approvalSetting] = await Promise.all([
    prisma.shiftOffer.findMany({
      where: { status: { not: "CANCELLED" } },
      include: {
        offeringUser:    { select: { id: true, name: true } },
        targetUser:      { select: { id: true, name: true } },
        requestedByUser: { select: { id: true, name: true } },
        assignment: {
          include: { period: { select: { month: true, year: true } } },
        },
        targetAssignment: {
          select: { id: true, date: true, shiftType: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.adminSetting.findUnique({ where: { key: "shiftOfferApproval" } }),
  ])

  const approvalEnabled = approvalSetting ? approvalSetting.value !== "false" : true
  const pendingApproval = offers.filter((o) => o.status === "ACCEPTED")

  return (
    <div className="min-h-screen" style={{ background: "#f4f6fb" }}>
      <NavBar />

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Shift Offers</h1>
          <div className="tc-divider" />
          <p className="text-slate-500 mt-2 text-sm">Review and manage physician shift trades and pickups.</p>
        </div>

        {/* Approval setting */}
        <div className="card space-y-2">
          <h2 className="font-semibold text-slate-800 text-sm">Approval Setting</h2>
          <ApprovalToggle initialValue={approvalEnabled} />
          <p className="text-xs text-slate-400">
            When enabled, shift swaps require admin approval before taking effect.
          </p>
        </div>

        {/* Awaiting approval banner */}
        {pendingApproval.length > 0 && (
          <div className="flex items-center gap-3 px-5 py-4 rounded-xl bg-blue-50 ring-2 ring-blue-200">
            <span className="text-xl">🔄</span>
            <p className="font-medium text-blue-800 text-sm">
              {pendingApproval.length} offer{pendingApproval.length !== 1 ? "s" : ""} awaiting your approval
            </p>
          </div>
        )}

        {/* Offers table */}
        <div className="card overflow-x-auto">
          <h2 className="font-semibold text-slate-800 mb-4">All Offers</h2>
          {offers.length === 0 ? (
            <p className="text-center py-8 text-slate-400 text-sm">No offers yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase tracking-wide">
                  <th className="pb-2 pr-3">Date</th>
                  <th className="pb-2 pr-3">Shift</th>
                  <th className="pb-2 pr-3">Type</th>
                  <th className="pb-2 pr-3">Offering</th>
                  <th className="pb-2 pr-3">Target / Requester</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {offers.map((offer) => (
                  <tr key={offer.id} className="py-2">
                    <td className="py-2.5 pr-3 whitespace-nowrap text-slate-700">
                      {formatDate(offer.assignment.date)}
                      <span className="block text-xs text-slate-400">
                        {MONTH_NAMES[offer.assignment.period.month]} {offer.assignment.period.year}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${SHIFT_COLOR[offer.assignment.shiftType]}`}>
                        {offer.assignment.shiftType}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                        {offer.type}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-slate-700">{offer.offeringUser.name}</td>
                    <td className="py-2.5 pr-3 text-slate-500">
                      {offer.type === "TRADE" ? (
                        <span>
                          {offer.targetUser?.name ?? "—"}
                          {offer.targetAssignment && (
                            <span className="block text-xs text-slate-400">
                              {formatDate(offer.targetAssignment.date)} {offer.targetAssignment.shiftType}
                            </span>
                          )}
                        </span>
                      ) : (
                        offer.requestedByUser?.name ?? <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[offer.status]}`}>
                        {offer.status}
                      </span>
                    </td>
                    <td className="py-2.5">
                      {offer.status === "ACCEPTED" ? (
                        <AdminOfferActions offerId={offer.id} />
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}
