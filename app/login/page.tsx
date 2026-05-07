"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const router  = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error,   setError]     = useState("")
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const result = await signIn("credentials", {
      username,
      password,
      redirect: false,
    })

    setLoading(false)

    if (result?.error) {
      setError("Invalid username or password")
    } else {
      router.push("/")
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg, #0d2580 0%, #1a3a9f 50%, #0d2580 100%)" }}
    >
      <div className="w-full max-w-sm">

        {/* TotalCare logo mark */}
        <div className="text-center mb-8 select-none">
          {/* Circle with cross — TotalCare brand mark */}
          <div className="inline-flex items-center justify-center mb-5">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center shadow-2xl"
              style={{ background: "#1565c0", border: "3px solid rgba(255,255,255,0.3)" }}
            >
              {/* Red cross */}
              <svg viewBox="0 0 40 40" className="w-10 h-10" fill="none">
                <rect x="15" y="5"  width="10" height="30" rx="2" fill="#c62828"/>
                <rect x="5"  y="15" width="30" height="10" rx="2" fill="#c62828"/>
              </svg>
            </div>
          </div>

          {/* TOTALCARE wordmark */}
          <div className="flex items-baseline justify-center gap-0 mb-1">
            <span
              className="text-3xl font-black tracking-tight"
              style={{ color: "#ffffff", letterSpacing: "-0.02em" }}
            >
              TOTAL
            </span>
            <span
              className="text-3xl font-black tracking-tight"
              style={{ color: "#60a5fa", letterSpacing: "-0.02em" }}
            >
              CARE
            </span>
            <span className="text-white text-xs align-super ml-0.5 font-normal">™</span>
          </div>
          <p className="text-blue-200 text-sm font-medium tracking-wide">
            Denton · Shift Scheduler
          </p>
        </div>

        {/* Login card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Red accent bar */}
          <div className="h-1" style={{ background: "#c62828" }} />

          <div className="p-8 space-y-5">
            <h2 className="text-xl font-bold text-center" style={{ color: "#0d2580" }}>
              Sign In
            </h2>

            {error && (
              <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg ring-1 ring-red-200">
                {error}
              </div>
            )}

            <div>
              <label className="label">Username</label>
              <input
                type="text"
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
              />
            </div>

            <div>
              <label className="label">Password</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="button"
              onClick={handleSubmit as any}
              disabled={loading}
              className="btn-primary w-full py-3 text-base"
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>

            <p className="text-xs text-center text-slate-400">
              Forgot your password? Contact your schedule administrator.
            </p>
          </div>
        </div>

        <p className="mt-6 text-blue-300 text-xs text-center max-w-xs mx-auto">
          📱 On iPhone, tap Share → &quot;Add to Home Screen&quot; to install. On Android, tap &quot;Add to Home Screen&quot; when prompted.
        </p>
      </div>
    </div>
  )
}
