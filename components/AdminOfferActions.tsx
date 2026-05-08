"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

type Props = {
  offerId: string
}

export default function AdminOfferActions({ offerId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  const doAction = async (action: "approve" | "deny") => {
    setLoading(action)
    try {
      const res = await fetch("/api/admin/shift-offers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: offerId, action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Action failed")
      router.refresh()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex gap-2">
      <button
        className="btn-primary text-xs py-1 px-2"
        disabled={!!loading}
        onClick={() => doAction("approve")}
      >
        {loading === "approve" ? "…" : "Approve"}
      </button>
      <button
        className="btn-danger text-xs py-1 px-2"
        disabled={!!loading}
        onClick={() => doAction("deny")}
      >
        {loading === "deny" ? "…" : "Deny"}
      </button>
    </div>
  )
}
