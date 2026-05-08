import { Suspense } from "react"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import NavBar from "@/components/NavBar"
import ShiftOffersClient from "@/components/ShiftOffersClient"

export default async function ShiftOffersPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")
  if (session.user.role === "ADMIN") redirect("/admin/shift-offers")

  return (
    <div className="min-h-screen" style={{ background: "#f4f6fb" }}>
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Shift Offers</h1>
          <div className="tc-divider" />
          <p className="text-slate-500 mt-2 text-sm">Trade shifts or pick up open shifts from colleagues.</p>
        </div>
        <Suspense fallback={<div className="card text-center py-10 text-slate-400">Loading…</div>}>
          <ShiftOffersClient userId={(session.user as any).id} />
        </Suspense>
      </main>
    </div>
  )
}
