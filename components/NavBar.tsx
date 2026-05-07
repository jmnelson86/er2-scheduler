"use client"

import Link from "next/link"
import { useSession, signOut } from "next-auth/react"
import { usePathname } from "next/navigation"

export default function NavBar() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const isAdmin = session?.user?.role === "ADMIN"

  const isActive = (href: string) => pathname.startsWith(href)

  const linkClass = (href: string) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition ${
      isActive(href)
        ? "bg-white/20 text-white font-semibold"
        : "text-blue-100 hover:bg-white/10 hover:text-white"
    }`

  return (
    <nav className="shadow-lg" style={{ background: "#0d2580" }}>
      {/* TotalCare red accent stripe */}
      <div className="h-0.5" style={{ background: "#c62828" }} />

      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">

        {/* Logo */}
        <div className="flex items-center gap-3">
          {/* Mini TotalCare mark */}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "#1565c0" }}
          >
            <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none">
              <rect x="8"  y="2"  width="4" height="16" rx="1" fill="#c62828"/>
              <rect x="2"  y="8"  width="16" height="4" rx="1" fill="#c62828"/>
            </svg>
          </div>
          <div className="flex items-baseline gap-0 leading-none">
            <span className="font-black text-white text-sm tracking-tight">TOTAL</span>
            <span className="font-black text-sm tracking-tight" style={{ color: "#60a5fa" }}>CARE</span>
            <span className="text-blue-300 text-[9px] ml-0.5 align-super">™</span>
          </div>
          <span className="text-blue-300 text-xs hidden md:inline">Denton</span>
        </div>

        {/* Nav links */}
        {session && (
          <div className="flex items-center gap-1">
            {isAdmin ? (
              <>
                <Link href="/admin"            className={linkClass("/admin")}>Overview</Link>
                <Link href="/admin/physicians" className={linkClass("/admin/physicians")}>Physicians</Link>
                <Link href="/admin/schedule"   className={linkClass("/admin/schedule")}>Schedule</Link>
              </>
            ) : (
              <>
                <Link href="/dashboard"   className={linkClass("/dashboard")}>Dashboard</Link>
                <Link href="/preferences" className={linkClass("/preferences")}>Preferences</Link>
                <Link href="/schedule"    className={linkClass("/schedule")}>My Schedule</Link>
              </>
            )}
          </div>
        )}

        {/* User / sign out */}
        {session && (
          <div className="flex items-center gap-3">
            <span className="text-blue-200 text-xs hidden sm:block">
              {session.user.name}
              {(session.user as any).isPRN && (
                <span
                  className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full"
                  style={{ background: "rgba(198,40,40,0.3)", color: "#fca5a5" }}
                >
                  PRN
                </span>
              )}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-xs text-blue-300 hover:text-white transition"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}
