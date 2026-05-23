"use client"

import { useState } from "react"
import Link from "next/link"
import { useSession, signOut } from "next-auth/react"
import { usePathname } from "next/navigation"

export default function NavBar() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const isAdmin = session?.user?.role === "ADMIN"
  const [menuOpen, setMenuOpen] = useState(false)

  const isActive = (href: string) => pathname.startsWith(href)

  const linkClass = (href: string) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition ${
      isActive(href)
        ? "bg-white/20 text-white font-semibold"
        : "text-blue-100 hover:bg-white/10 hover:text-white"
    }`

  const adminLinks = [
    { href: "/admin",              label: "Overview"     },
    { href: "/admin/physicians",   label: "Physicians"   },
    { href: "/admin/schedule",     label: "Schedule"     },
    { href: "/admin/shift-offers", label: "Shift Offers" },
  ]

  const physicianLinks = [
    { href: "/dashboard",    label: "Dashboard"    },
    { href: "/preferences",  label: "Preferences"  },
    { href: "/schedule",     label: "My Schedule"  },
    { href: "/shift-offers", label: "Shift Offers" },
    { href: "/settings",     label: "⚙ Settings"  },
  ]

  const links = isAdmin ? adminLinks : physicianLinks

  return (
    <nav className="shadow-lg" style={{ background: "#0d2580" }}>
      <div className="h-0.5" style={{ background: "#c62828" }} />

      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
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

        {/* Desktop nav links */}
        {session && (
          <div className="hidden md:flex items-center gap-1">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className={linkClass(link.href)}>
                {link.label}
              </Link>
            ))}
          </div>
        )}

        {/* Desktop user / sign out */}
        {session && (
          <div className="hidden md:flex items-center gap-3">
            <span className="text-blue-200 text-xs">
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

        {/* Mobile: sign out + hamburger */}
        {session && (
          <div className="flex items-center gap-1 md:hidden">
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-xs text-blue-300 hover:text-white transition px-2 py-1.5 rounded-md hover:bg-white/10"
            >
              Sign out
            </button>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="p-2 rounded-lg hover:bg-white/10 transition"
              aria-label="Toggle menu"
            >
              {menuOpen ? (
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Mobile dropdown */}
      {menuOpen && session && (
        <div className="md:hidden border-t border-blue-900 px-4 py-3 space-y-1" style={{ background: "#0a1e6e" }}>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className={`block ${linkClass(link.href)}`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  )
}
