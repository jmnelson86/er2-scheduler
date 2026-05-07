"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

const MONTH_NAMES = [
  "", "January","February","March","April","May","June",
  "July","August","September","October","November","December",
]

export default function CreatePeriodForm() {
  const router = useRouter()
  const now    = new Date()
  const [month,  setMonth]  = useState(now.getMonth() + 2 > 12 ? 1 : now.getMonth() + 2)
  const [year,   setYear]   = useState(now.getMonth() + 2 > 12 ? now.getFullYear() + 1 : now.getFullYear())
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const res = await fetch("/api/admin/schedule", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ month, year }),
    })

    setLoading(false)

    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? "Failed to create period")
    } else {
      router.refresh()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div>
        <label className="label">Month</label>
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="input w-36"
        >
          {MONTH_NAMES.slice(1).map((name, i) => (
            <option key={i + 1} value={i + 1}>{name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Year</label>
        <input
          type="number"
          min={2025}
          max={2035}
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="input w-24"
        />
      </div>
      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? "Creating…" : "Open Period"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  )
}
