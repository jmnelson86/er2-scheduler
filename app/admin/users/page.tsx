"use client"

import { useState, useEffect, Dispatch, SetStateAction } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import NavBar from "@/components/NavBar"
import Link from "next/link"

type User = {
  id:               string
  name:             string
  username:         string
  email:            string | null
  role:             "ADMIN" | "PHYSICIAN"
  isPRN:            boolean
  isActive:         boolean
  shiftLengthPref:  string
  allowedShiftTypes: string
  adminTargetShifts: number | null
  color:            string
  createdAt:        string
}

type EditState = {
  name:        string
  username:    string
  email:       string
  role:        "ADMIN" | "PHYSICIAN"
  isPRN:       boolean
}

const PREF_LABEL: Record<string, string> = {
  PREFER_24H: "24h pref",
  EITHER:     "either",
  PREFER_12H: "12h pref",
}
const PREF_STYLE: Record<string, string> = {
  PREFER_24H: "bg-blue-100 text-blue-700",
  EITHER:     "bg-slate-100 text-slate-600",
  PREFER_12H: "bg-amber-100 text-amber-700",
}

type UserRowProps = {
  user:          User
  editing:       Record<string, boolean>
  edits:         Record<string, EditState>
  saving:        Record<string, string>
  errors:        Record<string, string>
  pwOpen:        Record<string, boolean>
  pwValue:       Record<string, string>
  pwMsg:         Record<string, string>
  setEdits:      Dispatch<SetStateAction<Record<string, EditState>>>
  startEdit:     (user: User) => void
  saveEdit:      (userId: string) => void
  cancelEdit:    (userId: string) => void
  toggleActive:  (user: User) => void
  setPwOpen:     Dispatch<SetStateAction<Record<string, boolean>>>
  setPwValue:    Dispatch<SetStateAction<Record<string, string>>>
  resetPassword: (userId: string) => void
}

function UserRow({
  user, editing, edits, saving, errors, pwOpen, pwValue, pwMsg,
  setEdits, startEdit, saveEdit, cancelEdit, toggleActive, setPwOpen, setPwValue, resetPassword,
}: UserRowProps) {
  const isEditing = editing[user.id] ?? false
  const edit      = edits[user.id]
  const saveMsg   = saving[user.id] ?? ""
  const errMsg    = errors[user.id] ?? ""
  const hasPwOpen = pwOpen[user.id] ?? false

  return (
    <tr className={`transition-colors ${user.isActive ? "hover:bg-slate-50" : "opacity-50 bg-slate-50"}`}>

      {/* Name / username / email */}
      <td className="px-4 py-3">
        {isEditing ? (
          <div className="space-y-1.5">
            <input
              value={edit.name}
              onChange={(e) => setEdits((ev) => ({ ...ev, [user.id]: { ...ev[user.id], name: e.target.value } }))}
              className="input text-xs py-1 w-full"
              placeholder="Full name"
            />
            <input
              value={edit.username}
              onChange={(e) => setEdits((ev) => ({ ...ev, [user.id]: { ...ev[user.id], username: e.target.value } }))}
              className="input text-xs py-1 w-full"
              placeholder="username"
            />
            <input
              type="email"
              value={edit.email}
              onChange={(e) => setEdits((ev) => ({ ...ev, [user.id]: { ...ev[user.id], email: e.target.value } }))}
              className="input text-xs py-1 w-full"
              placeholder="Email (optional)"
            />
          </div>
        ) : (
          <div>
            <p className="font-medium text-slate-800">{user.name}</p>
            <p className="text-xs text-slate-400">@{user.username}</p>
            {user.email && <p className="text-xs text-slate-400">{user.email}</p>}
          </div>
        )}
      </td>

      {/* Role / PRN */}
      <td className="px-4 py-3">
        {isEditing ? (
          <div className="space-y-1.5">
            <select
              value={edit.role}
              onChange={(e) => setEdits((ev) => ({ ...ev, [user.id]: { ...ev[user.id], role: e.target.value as any } }))}
              className="input text-xs py-1"
            >
              <option value="PHYSICIAN">Physician</option>
              <option value="ADMIN">Admin</option>
            </select>
            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={edit.isPRN}
                onChange={(e) => setEdits((ev) => ({ ...ev, [user.id]: { ...ev[user.id], isPRN: e.target.checked } }))}
                className="rounded accent-blue-600"
              />
              PRN
            </label>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              user.role === "ADMIN" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
            }`}>
              {user.role === "ADMIN" ? "Admin" : "Physician"}
            </span>
            {user.isPRN && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">PRN</span>
            )}
            {user.role === "PHYSICIAN" && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PREF_STYLE[user.shiftLengthPref] ?? "bg-slate-100 text-slate-600"}`}>
                {PREF_LABEL[user.shiftLengthPref] ?? user.shiftLengthPref}
              </span>
            )}
          </div>
        )}
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          user.isActive ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-500"
        }`}>
          {user.isActive ? "Active" : "Inactive"}
        </span>
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-2 items-center">
          {isEditing ? (
            <>
              <button
                onClick={() => saveEdit(user.id)}
                className="btn-primary text-xs py-1 px-3"
              >
                Save
              </button>
              <button
                onClick={() => cancelEdit(user.id)}
                className="btn-secondary text-xs py-1 px-3"
              >
                Cancel
              </button>
              {errMsg && <span className="text-xs text-red-600">{errMsg}</span>}
            </>
          ) : (
            <>
              <button
                onClick={() => startEdit(user)}
                className="btn-secondary text-xs py-1 px-3"
              >
                Edit
              </button>
              <button
                onClick={() => toggleActive(user)}
                className={`text-xs py-1 px-3 rounded-lg ring-1 font-medium transition ${
                  user.isActive
                    ? "bg-white text-red-600 ring-red-200 hover:bg-red-50"
                    : "bg-white text-green-600 ring-green-200 hover:bg-green-50"
                }`}
              >
                {user.isActive ? "Deactivate" : "Reactivate"}
              </button>
              <button
                onClick={() => setPwOpen((o) => ({ ...o, [user.id]: !hasPwOpen }))}
                className="btn-secondary text-xs py-1 px-3"
              >
                {hasPwOpen ? "Cancel" : "Reset PW"}
              </button>
            </>
          )}
          {saveMsg && !isEditing && (
            <span className={`text-xs ${saveMsg.includes("Saved") ? "text-green-600" : "text-slate-400"}`}>
              {saveMsg}
            </span>
          )}
        </div>

        {/* Inline password reset */}
        {hasPwOpen && !isEditing && (
          <div className="mt-2 flex gap-2 items-center">
            <input
              type="password"
              value={pwValue[user.id] ?? ""}
              onChange={(e) => setPwValue((v) => ({ ...v, [user.id]: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && resetPassword(user.id)}
              className="input text-xs py-1 w-40"
              placeholder="New password (min 6)"
            />
            <button
              onClick={() => resetPassword(user.id)}
              className="btn-primary text-xs py-1 px-3"
            >
              Set
            </button>
            {pwMsg[user.id] && (
              <span className={`text-xs ${pwMsg[user.id]?.includes("reset") ? "text-green-600" : "text-red-600"}`}>
                {pwMsg[user.id]}
              </span>
            )}
          </div>
        )}
      </td>
    </tr>
  )
}

export default function UserManagementPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [users, setUsers]           = useState<User[]>([])
  const [loading, setLoading]       = useState(true)
  const [showInactive, setShowInactive] = useState(false)

  // Inline edit state per user
  const [editing, setEditing]       = useState<Record<string, boolean>>({})
  const [edits, setEdits]           = useState<Record<string, EditState>>({})
  const [saving, setSaving]         = useState<Record<string, string>>({})
  const [errors, setErrors]         = useState<Record<string, string>>({})

  // Password reset
  const [pwOpen,  setPwOpen]  = useState<Record<string, boolean>>({})
  const [pwValue, setPwValue] = useState<Record<string, string>>({})
  const [pwMsg,   setPwMsg]   = useState<Record<string, string>>({})

  // New physician form
  const [showNew,    setShowNew]    = useState(false)
  const [newName,    setNewName]    = useState("")
  const [newUsername, setNewUsername] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [newEmail,   setNewEmail]   = useState("")
  const [newRole,    setNewRole]    = useState<"PHYSICIAN" | "ADMIN">("PHYSICIAN")
  const [newPRN,     setNewPRN]     = useState(false)
  const [creating,   setCreating]   = useState(false)
  const [createError, setCreateError] = useState("")

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
    if (status === "authenticated" && session?.user?.role !== "ADMIN") router.push("/dashboard")
  }, [status, session, router])

  useEffect(() => {
    if (status !== "authenticated") return
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data) => {
        setUsers(data.users ?? [])
        setLoading(false)
      })
  }, [status])

  function startEdit(user: User) {
    setEditing((e) => ({ ...e, [user.id]: true }))
    setEdits((e) => ({
      ...e,
      [user.id]: {
        name:     user.name,
        username: user.username,
        email:    user.email ?? "",
        role:     user.role,
        isPRN:    user.isPRN,
      },
    }))
    setErrors((e) => ({ ...e, [user.id]: "" }))
  }

  function cancelEdit(userId: string) {
    setEditing((e) => ({ ...e, [userId]: false }))
    setErrors((e) => ({ ...e, [userId]: "" }))
  }

  async function saveEdit(userId: string) {
    const edit = edits[userId]
    setSaving((s) => ({ ...s, [userId]: "Saving…" }))
    setErrors((e) => ({ ...e, [userId]: "" }))
    const res = await fetch("/api/admin/users", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        userId,
        name:     edit.name,
        username: edit.username,
        email:    edit.email.trim() || null,
        role:     edit.role,
        isPRN:    edit.isPRN,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      setUsers((u) => u.map((x) => x.id === userId ? { ...x, ...data.user } : x))
      setEditing((e) => ({ ...e, [userId]: false }))
      setSaving((s) => ({ ...s, [userId]: "Saved!" }))
      setTimeout(() => setSaving((s) => ({ ...s, [userId]: "" })), 2000)
    } else {
      const data = await res.json()
      setErrors((e) => ({ ...e, [userId]: data.error ?? "Save failed" }))
      setSaving((s) => ({ ...s, [userId]: "" }))
    }
  }

  async function toggleActive(user: User) {
    const next = !user.isActive
    setSaving((s) => ({ ...s, [user.id]: next ? "Activating…" : "Deactivating…" }))
    const res = await fetch("/api/admin/users", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ userId: user.id, isActive: next }),
    })
    if (res.ok) {
      const data = await res.json()
      setUsers((u) => u.map((x) => x.id === user.id ? { ...x, ...data.user } : x))
    }
    setSaving((s) => ({ ...s, [user.id]: "" }))
  }

  async function resetPassword(userId: string) {
    const pw = pwValue[userId] ?? ""
    if (pw.length < 6) { setPwMsg((m) => ({ ...m, [userId]: "Min 6 characters" })); return }
    const res = await fetch("/api/admin/users", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ userId, newPassword: pw }),
    })
    if (res.ok) {
      setPwMsg((m) => ({ ...m, [userId]: "Password reset!" }))
      setPwValue((v) => ({ ...v, [userId]: "" }))
      setPwOpen((o) => ({ ...o, [userId]: false }))
    } else {
      const data = await res.json()
      setPwMsg((m) => ({ ...m, [userId]: data.error ?? "Failed" }))
    }
    setTimeout(() => setPwMsg((m) => ({ ...m, [userId]: "" })), 3000)
  }

  async function handleCreate() {
    setCreateError("")
    if (!newName.trim())     { setCreateError("Name is required"); return }
    if (!newUsername.trim()) { setCreateError("Username is required"); return }
    if (newPassword.length < 6) { setCreateError("Password must be at least 6 characters"); return }

    setCreating(true)
    const res = await fetch("/api/admin/users", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        name:     newName.trim(),
        username: newUsername.trim(),
        password: newPassword,
        email:    newEmail.trim() || null,
        role:     newRole,
        isPRN:    newPRN,
      }),
    })
    setCreating(false)
    if (res.ok) {
      const data = await res.json()
      setUsers((u) => [...u, data.user].sort((a, b) => {
        if (a.role !== b.role) return a.role === "ADMIN" ? -1 : 1
        if (a.isPRN !== b.isPRN) return a.isPRN ? 1 : -1
        return a.name.localeCompare(b.name)
      }))
      setShowNew(false)
      setNewName(""); setNewUsername(""); setNewPassword("")
      setNewEmail(""); setNewRole("PHYSICIAN"); setNewPRN(false)
    } else {
      const data = await res.json()
      setCreateError(data.error ?? "Failed to create user")
    }
  }

  if (status === "loading" || !session || loading) return null

  const visible    = users.filter((u) => showInactive ? true : u.isActive)
  const physicians = visible.filter((u) => u.role === "PHYSICIAN")
  const admins     = visible.filter((u) => u.role === "ADMIN")

  const rowProps = { editing, edits, saving, errors, pwOpen, pwValue, pwMsg,
    setEdits, startEdit, saveEdit, cancelEdit, toggleActive, setPwOpen, setPwValue, resetPassword }

  return (
    <div className="min-h-screen" style={{ background: "#f4f6fb" }}>
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
            <p className="text-slate-500 mt-1 text-sm">
              Add, edit, deactivate, or reactivate physicians and admins.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link href="/admin" className="btn-secondary text-sm">← Admin Overview</Link>
            <button
              onClick={() => { setShowNew(true); setCreateError("") }}
              className="btn-primary text-sm"
            >
              + Add User
            </button>
          </div>
        </div>

        {/* New user form */}
        {showNew && (
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">New User</h2>
              <button onClick={() => { setShowNew(false); setCreateError("") }} className="text-slate-400 hover:text-slate-600 text-lg leading-none">&times;</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Full Name *</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="input w-full"
                  placeholder="Dr. Jane Smith"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Username *</label>
                <input
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
                  className="input w-full"
                  placeholder="jsmith"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Temporary Password *</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input w-full"
                  placeholder="At least 6 characters"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Email (optional)</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="input w-full"
                  placeholder="jane@example.com"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="input w-full"
                >
                  <option value="PHYSICIAN">Physician</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={newPRN}
                    onChange={(e) => setNewPRN(e.target.checked)}
                    className="w-4 h-4 rounded accent-blue-600"
                  />
                  PRN (per-diem)
                </label>
              </div>
            </div>
            {createError && <p className="text-xs text-red-600">{createError}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={creating}
                className="btn-primary text-sm"
              >
                {creating ? "Creating…" : "Create User"}
              </button>
              <button
                onClick={() => { setShowNew(false); setCreateError("") }}
                className="btn-secondary text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Show inactive toggle */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600">
            <button
              role="switch"
              aria-checked={showInactive}
              onClick={() => setShowInactive((v) => !v)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                showInactive ? "bg-blue-600" : "bg-slate-300"
              }`}
            >
              <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
                showInactive ? "translate-x-5" : "translate-x-1"
              }`} />
            </button>
            Show inactive users
          </label>
          <span className="text-xs text-slate-400">
            {users.filter((u) => !u.isActive).length} inactive
          </span>
        </div>

        {/* Physicians table */}
        {physicians.length > 0 && (
          <div className="card overflow-x-auto p-0">
            <div className="px-4 py-3 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800 text-sm">
                Physicians <span className="text-slate-400 font-normal">({physicians.filter((u) => u.isActive).length} active)</span>
              </h2>
            </div>
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="text-left text-xs text-slate-500 uppercase tracking-wide border-b border-slate-100">
                  <th className="px-4 py-2 font-medium">Name / Username / Email</th>
                  <th className="px-4 py-2 font-medium">Role / Type</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {physicians.map((u) => <UserRow key={u.id} user={u} {...rowProps} />)}
              </tbody>
            </table>
          </div>
        )}

        {/* Admins table */}
        {admins.length > 0 && (
          <div className="card overflow-x-auto p-0">
            <div className="px-4 py-3 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800 text-sm">Admins</h2>
            </div>
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="text-left text-xs text-slate-500 uppercase tracking-wide border-b border-slate-100">
                  <th className="px-4 py-2 font-medium">Name / Username / Email</th>
                  <th className="px-4 py-2 font-medium">Role / Type</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {admins.map((u) => <UserRow key={u.id} user={u} {...rowProps} />)}
              </tbody>
            </table>
          </div>
        )}

        {visible.length === 0 && (
          <p className="text-center py-12 text-slate-400 italic">No users found.</p>
        )}
      </main>
    </div>
  )
}
