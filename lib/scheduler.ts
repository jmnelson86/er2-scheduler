/**
 * Location 2 Scheduler
 *
 * Shift model:
 *   24H   : 9AM day D  → 9AM day D+1   (1440 min duration)
 *   DAY12 : 9AM day D  → 9PM day D     ( 720 min duration)
 *   NIGHT12: 9PM day D → 9AM day D+1   ( 720 min duration)
 *
 * Coverage requirement: every moment from 9AM day-1 to 9AM day-(daysInMonth+1)
 * must be covered by exactly one physician.
 *
 * Rest rule: ≥ 12h (720 min) between end of one shift and start of the next.
 *
 * Shift start/end in absolute minutes from midnight of day 0 (= day 1 of month):
 *   Day D (0-indexed): midnight = D * 1440
 *   24H  : start = D*1440 + 540,  end = D*1440 + 1980  (= (D+1)*1440 + 540)
 *   DAY12: start = D*1440 + 540,  end = D*1440 + 1260
 *   NIGHT12: start = D*1440 + 1260, end = D*1440 + 1980
 */

import { getDaysInMonth } from "date-fns"

export interface PhysicianData {
  id:               string
  name:             string
  isPRN:            boolean
  prefersTwelveHour: boolean
  hardBlockedDates: string[]  // REQUIRED — never assign
  softBlockedDates: string[]  // PREFERRED — large penalty, last resort
  preferredDates:   string[]  // "YYYY-MM-DD"
  targetShifts:      number   // ideal shifts
  minShifts:         number   // minimum (default: targetShifts - 3, min 1)
  maxShifts:         number   // maximum (default: targetShifts + 3)
  adminTargetShifts?: number  // admin override
  adminHardCap:      boolean  // if true, hard stop at adminTargetShifts
  useHoursTarget:    boolean  // if true, use hours instead of shift counts for scoring/capping
  targetHours:       number   // ideal total hours/month (used when useHoursTarget=true)
  minHours:          number   // minimum hours
  maxHours:          number   // maximum hours
}

export interface SlotInput {
  date:      string   // "YYYY-MM-DD"
  shiftType: "24H" | "DAY12" | "NIGHT12"
}

export interface Assignment {
  date:        string
  shiftType:   "24H" | "DAY12" | "NIGHT12"
  userId:      string | null
  isConflict:  boolean
  conflictNote: string
}

const MIN_REST = 720  // 12 hours

// Returns absolute start/end minutes (from midnight day 0) for a slot
function slotMinutes(d: number, type: "24H" | "DAY12" | "NIGHT12") {
  const midnight = d * 1440
  if (type === "24H")    return { start: midnight + 540, end: midnight + 1980 }
  if (type === "DAY12")  return { start: midnight + 540, end: midnight + 1260 }
  return                        { start: midnight + 1260, end: midnight + 1980 } // NIGHT12
}

// Day index (0-based) from "YYYY-MM-DD"
function dayIndex(dateStr: string) {
  return parseInt(dateStr.split("-")[2]) - 1
}

/**
 * Build the slot list for a month.
 * Decision: for each day, if at least one 12h-preferring physician is available
 * AND there's another physician available for the paired slot, split the day.
 * Otherwise use a 24H slot.
 *
 * We do a two-pass approach: first decide coverage type per day, then assign.
 */
export function buildSlots(
  year: number,
  month: number,
  physicians: PhysicianData[]
): SlotInput[] {
  const days = getDaysInMonth(new Date(year, month - 1))
  const slots: SlotInput[] = []

  for (let d = 0; d < days; d++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d + 1).padStart(2, "0")}`
    // Heuristic: check if any active (non-hard-blocked) physician prefers 12h
    const availPhy = physicians.filter((p) => !p.hardBlockedDates.includes(dateStr))
    const has12hPref = availPhy.some((p) => p.prefersTwelveHour)

    if (has12hPref && availPhy.length >= 2) {
      // Split into DAY12 + NIGHT12
      slots.push({ date: dateStr, shiftType: "DAY12" })
      slots.push({ date: dateStr, shiftType: "NIGHT12" })
    } else {
      slots.push({ date: dateStr, shiftType: "24H" })
    }
  }
  return slots
}

/**
 * Run the scheduling algorithm.
 */
export function runScheduler(
  year: number,
  month: number,
  physicians: PhysicianData[]
): Assignment[] {
  const slots = buildSlots(year, month, physicians)

  // Track last shift end (absolute minutes) per physician
  const lastEnd: Record<string, number> = {}
  physicians.forEach((p) => { lastEnd[p.id] = -9999 })

  // Track assigned shift count per physician
  const shiftCount: Record<string, number> = {}
  physicians.forEach((p) => { shiftCount[p.id] = 0 })

  // Track total hours worked per physician (for useHoursTarget mode)
  const hoursWorked: Record<string, number> = {}
  physicians.forEach((p) => { hoursWorked[p.id] = 0 })

  const SHIFT_HOURS: Record<string, number> = { "24H": 24, "DAY12": 12, "NIGHT12": 12 }

  const results: Assignment[] = []

  for (const slot of slots) {
    const d = dayIndex(slot.date)
    const { start, end } = slotMinutes(d, slot.shiftType)

    // Candidates: not HARD blocked, respects rest gap, not over hard cap
    const candidates = physicians.filter((p) => {
      if (p.hardBlockedDates.includes(slot.date)) return false  // Hard block — excluded
      const canStart = lastEnd[p.id] + MIN_REST <= start
      if (!canStart) return false
      // Hard cap check — exclude if admin hard cap reached
      if (p.adminHardCap && p.adminTargetShifts != null && shiftCount[p.id] >= p.adminTargetShifts) return false
      // Hours-mode hard cap check
      if (p.useHoursTarget) {
        const slotHours = SHIFT_HOURS[slot.shiftType]
        const effectiveMaxHours = (p.adminHardCap && p.adminTargetShifts != null)
          ? p.adminTargetShifts
          : p.maxHours
        if (hoursWorked[p.id] + slotHours > effectiveMaxHours) return false
      }
      return true
    })

    if (candidates.length === 0) {
      // No valid candidate — flag conflict
      results.push({
        date:        slot.date,
        shiftType:   slot.shiftType,
        userId:      null,
        isConflict:  true,
        conflictNote: "No available physician — all have required days off on this date",
      })
      continue
    }

    // Score each candidate
    const scored = candidates.map((p) => {
      let score = 0

      // Effective targets
      const effectiveTarget = p.adminTargetShifts ?? p.targetShifts
      const effectiveMax = (p.adminHardCap && p.adminTargetShifts != null)
        ? p.adminTargetShifts
        : p.maxShifts

      // Prefer-12h match
      if (slot.shiftType !== "24H" && p.prefersTwelveHour)  score += 60
      if (slot.shiftType === "24H" && !p.prefersTwelveHour) score += 30

      if (p.useHoursTarget) {
        // Hours-mode scoring
        const slotHours = SHIFT_HOURS[slot.shiftType]
        const effectiveTargetHours = p.adminTargetShifts ?? p.targetHours
        const effectiveMaxHours = (p.adminHardCap && p.adminTargetShifts != null)
          ? p.adminTargetShifts
          : p.maxHours
        const remainingHours = effectiveTargetHours - hoursWorked[p.id]
        score += Math.max(0, remainingHours / 12) * 5
        if (hoursWorked[p.id] >= effectiveTargetHours) score -= 25
        if (hoursWorked[p.id] + slotHours > effectiveMaxHours) score -= 60
      } else {
        // Shift-count scoring
        // Under effective target — incentivize
        const remaining = effectiveTarget - shiftCount[p.id]
        score += Math.max(0, remaining) * 10

        // Penalty for going over effective target
        if (shiftCount[p.id] >= effectiveTarget) score -= 25

        // Soft cap penalty — strong penalty for exceeding max
        if (shiftCount[p.id] >= effectiveMax) score -= 60
      }

      // PRN penalty
      if (p.isPRN) score -= 40

      // Soft block penalty — large, last resort only
      if (p.softBlockedDates.includes(slot.date)) score -= 80

      // Preferred date bonus
      if (p.preferredDates.includes(slot.date)) score += 20

      // Rest quality bonus (more rest = better circadian)
      const gap = start - lastEnd[p.id]
      if (gap >= 1440) score += 20  // been off a full day

      // Tiebreaker
      score += Math.random() * 5

      return { p, score }
    })

    scored.sort((a, b) => b.score - a.score)
    const winner = scored[0].p
    const winnerHasSoftBlock = winner.softBlockedDates.includes(slot.date)

    lastEnd[winner.id] = end
    shiftCount[winner.id]++
    hoursWorked[winner.id] += SHIFT_HOURS[slot.shiftType]

    results.push({
      date:        slot.date,
      shiftType:   slot.shiftType,
      userId:      winner.id,
      isConflict:  winnerHasSoftBlock,
      conflictNote: winnerHasSoftBlock
        ? "Physician assigned on a preferred day off — no other physicians available"
        : "",
    })
  }

  return results
}

/**
 * Validate rest gaps in an existing assignment set.
 * Returns a map of assignmentId → conflictNote for violations.
 */
export function validateAssignments(
  assignments: { id: string; userId: string | null; date: string; shiftType: string }[]
): Record<string, string> {
  const conflicts: Record<string, string> = {}

  // Group by user
  const byUser: Record<string, typeof assignments> = {}
  for (const a of assignments) {
    if (!a.userId) continue
    if (!byUser[a.userId]) byUser[a.userId] = []
    byUser[a.userId].push(a)
  }

  for (const [, userAssignments] of Object.entries(byUser)) {
    // Sort by start time
    const sorted = [...userAssignments].sort((a, b) => {
      const dA = dayIndex(a.date)
      const dB = dayIndex(b.date)
      const sA = slotMinutes(dA, a.shiftType as any).start
      const sB = slotMinutes(dB, b.shiftType as any).start
      return sA - sB
    })

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]
      const curr = sorted[i]
      const prevEnd = slotMinutes(dayIndex(prev.date), prev.shiftType as any).end
      const currStart = slotMinutes(dayIndex(curr.date), curr.shiftType as any).start
      const gap = currStart - prevEnd

      if (gap < MIN_REST) {
        const gapH = (gap / 60).toFixed(1)
        conflicts[curr.id] = `Only ${gapH}h rest after previous shift (need 12h)`
      }
    }
  }

  return conflicts
}
