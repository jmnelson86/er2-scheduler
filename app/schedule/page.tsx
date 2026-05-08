import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import NavBar from "@/components/NavBar"
import ShiftList from "@/components/ShiftList"

export default async function MySchedulePage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")
  if (session.user.role === "ADMIN") redirect("/admin")

  const assignments = await prisma.shiftAssignment.findMany({
    where:   { userId: session.user.id },
    include: { period: true },
    orderBy: { date: "asc" },
  })

  return (
    <div className="min-h-screen" style={{ background: "#f4f6fb" }}>
      <NavBar />

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">My Schedule</h1>
        <ShiftList assignments={assignments} />
      </main>
    </div>
  )
}
