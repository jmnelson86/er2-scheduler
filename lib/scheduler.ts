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
 * Weekly soft limits (rolling 7-day window, penalty-based not hard block):
 *   - Prefer ≤ 3 × 24H shifts per week
 *   - Prefer ≤ 4 × 12H shifts per week
 *
 * Weekend fairness: weekend slots are distributed evenly across physicians.
 *   Exception: if a physician explicitly listed a weekend date as a preferred/
 *   available date, the balance penalty does not apply to them for that date.
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
  softBlockedDates: string[]  // PREFERRED — also hard block; never assign
  preferredDates:   string[]  // "YYYY-MM-DD" — if any set, physician only works these days
  targetShifts:      number   // ideal shifts
  minShifts:         number   // minimum (default: targetShifts - 3, min 1)
  maxShifts:         number   // maximum (default: targetShifts + 3)
  adminTargetShifts?: number  // admin override
  adminHardCap:      boolean  // if true, hard stop at adminTargetShifts
  allowedShiftTypes: string   // "ALL" or comma-sep: "24H","DAY12","NIGHT12"
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

// Weekly soft limits (rolling 7-day window)
const MAX_24H_PER_WEEK  = 3   // prefer ≤ 3 × 24H shifts in any 7-day window
const MAX_12H_PER_WEEK  = 4   // prefer ≤ 4 × 12H shifts in any 7-day window

// Weekend balance penalty weight (per extra weekend shift above the current minimum)
const WEEKEND_BALANCE_WEIGHT = 25

// Returns true if a date string falls on Saturday or Sunday
function isWeekend(dateStr: string): boolean {
  const dow = new Date(dateStr + "T12:00:00").getDay()
  return dow === 0 || dow === 6
}

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
 *
 * Strategy: compute how many 24H days vs split (DAY12+NIGHT12) days the month
 * needs to satisfy each physician group's shift targets, then assign those day
 * types to the calendar days where the relevant physicians are most available.
 *
 * - Physicians who prefer 24H  (prefersTwelveHour=false) consume one 24H slot/day.
 * - Physicians who prefer 12H  (prefersTwelveHour=true)  consume one DAY12 or
 *   NIGHT12 slot/day; each split day provides both.
 *
 * Slots are still created for every day — no day is left uncovered.
 */
export function buildSlots(
  year: number,
  month: number,
  physicians: PhysicianData[]
): SlotInput[] {
  const days = getDaysInMonth(new Date(year, month - 1))

  // Build date strings for every day
  const dateStrings: string[] = []
  for (let d = 0; d < days; d++) {
    dateStrings.push(
      `${year}-${String(month).padStart(2, "0")}-${String(d + 1).padStart(2, "0")}`
    )
  }

  // Helper: is a physician actually available on a given date?
  function isAvailableOn(p: PhysicianData, dateStr: string): boolean {
    if (p.hardBlockedDates.includes(dateStr)) return false
    if (p.softBlockedDates.includes(dateStr)) return false
    if (p.preferredDates.length > 0 && !p.preferredDates.includes(dateStr)) return false
    return true
  }

  // Helper: does a physician's allowedShiftTypes permit a given shift type?
  function canWorkType(p: PhysicianData, type: string): boolean {
    if (p.allowedShiftTypes === "ALL") return true
    return p.allowedShiftTypes.split(",").map((s) => s.trim()).includes(type)
  }

  // Split physicians into groups by effective shift-type capability & preference
  const physicians24h = physicians.filter(
    (p) => !p.prefersTwelveHour && canWorkType(p, "24H")
  )
  const physicians12h = physicians.filter(
    (p) => p.prefersTwelveHour && (canWorkType(p, "DAY12") || canWorkType(p, "NIGHT12"))
  )

  // Total target shifts for each group (use admin override if set)
  const total24hTarget = physicians24h.reduce(
    (s, p) => s + (p.adminTargetShifts ?? p.targetShifts), 0
  )
  const total12hTarget = physicians12h.reduce(
    (s, p) => s + (p.adminTargetShifts ?? p.targetShifts), 0
  )

  // Each split day provides 2 twelve-hour slots (DAY12 + NIGHT12).
  // Each full day provides 1 twenty-four-hour slot.
  const idealSplitDays = Math.ceil(total12hTarget / 2)
  const ideal24hDays   = total24hTarget
  const totalIdeal     = ideal24hDays + idealSplitDays

  let num24h: number, numSplit: number

  if (totalIdeal === 0) {
    // No physicians configured — default all days to 24H
    num24h = days; numSplit = 0
  } else if (totalIdeal <= days) {
    // Enough days to satisfy both groups; fill remaining proportionally
    num24h   = ideal24hDays
    numSplit = idealSplitDays
    const extra = days - totalIdeal
    const extra24h = total24hTarget > 0
      ? Math.round(extra * (ideal24hDays / totalIdeal))
      : 0
    num24h   += extra24h
    numSplit += extra - extra24h
  } else {
    // More demand than days — scale proportionally
    numSplit = Math.round(days * (idealSplitDays / totalIdeal))
    num24h   = days - numSplit
  }

  // For each calendar day, score how many 24H-eligible physicians are available
  // vs how many 12H-eligible physicians are available.
  // Days with a stronger 24H advantage get assigned as 24H days.
  const dayScores = dateStrings.map((dateStr) => {
    const avail24h = physicians24h.filter((p) => isAvailableOn(p, dateStr)).length
    const avail12h = physicians12h.filter((p) => isAvailableOn(p, dateStr)).length
    return { dateStr, score: avail24h - avail12h }
  })

  // The `num24h` days with the highest score become 24H days; the rest split.
  const sortedDesc = [...dayScores].sort((a, b) => b.score - a.score)
  const use24h = new Set(sortedDesc.slice(0, num24h).map((d) => d.dateStr))

  // Emit slots in calendar order
  const slots: SlotInput[] = []
  for (const dateStr of dateStrings) {
    if (use24h.has(dateStr)) {
      slots.push({ date: dateStr, shiftType: "24H" })
    } else {
      slots.push({ date: dateStr, shiftType: "DAY12" })
      slots.push({ date: dateStr, shiftType: "NIGHT12" })
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

  // Track weekend shift count per physician (for fair distribution)
  const weekendCount: Record<string, number> = {}
  physicians.forEach((p) => { weekendCount[p.id] = 0 })

  const results: Assignment[] = []

  // Count a physician's 24H and 12H shifts in a rolling window [windowStart, windowEnd] (day indices)
  function shiftsInWindow(physId: string, windowStart: number, windowEnd: number) {
    let count24h = 0, count12h = 0
    for (const a of results) {
      if (a.userId !== physId) continue
      const d = dayIndex(a.date)
      if (d >= windowStart && d <= windowEnd) {
        if (a.shiftType === "24H") count24h++
        else count12h++
      }
    }
    return { count24h, count12h }
  }

  for (const slot of slots) {
    const d = dayIndex(slot.date)
    const { start, end } = slotMinutes(d, slot.shiftType)

    // Candidates: not blocked (hard or preferred), respects rest gap, not over hard cap, shift type allowed
    const candidates = physicians.filter((p) => {
      if (p.hardBlockedDates.includes(slot.date)) return false  // Hard block — excluded
      if (p.softBlockedDates.includes(slot.date)) return false  // Preferred day off — also excluded
      // Availability constraint: if a physician listed preferred (available) dates,
      // they can ONLY be scheduled on those days. No preferred dates = available all month.
      if (p.preferredDates.length > 0 && !p.preferredDates.includes(slot.date)) return false
      // Allowed shift types filter
      if (p.allowedShiftTypes !== "ALL") {
        const allowed = p.allowedShiftTypes.split(",").map((s) => s.trim())
        if (!allowed.includes(slot.shiftType)) return false
      }
      const canStart = lastEnd[p.id] + MIN_REST <= start
      if (!canStart) return false
      // Hard cap check — exclude if admin hard cap reached
      if (p.adminHardCap && p.adminTargetShifts != null && shiftCount[p.id] >= p.adminTargetShifts) return false
      return true
    })

    if (candidates.length === 0) {
      // Determine why no candidate was available for a more helpful conflict note
      const notHardBlocked = physicians.filter((p) => !p.hardBlockedDates.includes(slot.date))
      const notAnyBlocked = notHardBlocked.filter((p) => !p.softBlockedDates.includes(slot.date))
      const notAvailRestricted = notAnyBlocked.filter(
        (p) => p.preferredDates.length === 0 || p.preferredDates.includes(slot.date)
      )
      const conflictNote = notHardBlocked.length === 0
        ? "No available physician — all have required days off on this date"
        : notAnyBlocked.length === 0
        ? "No available physician — all have this date marked as a day off"
        : notAvailRestricted.length === 0
        ? "No available physician — all have this date outside their listed availability"
        : "No available physician — rest gap or cap constraints prevented assignment"

      results.push({
        date:        slot.date,
        shiftType:   slot.shiftType,
        userId:      null,
        isConflict:  true,
        conflictNote,
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

      // Shift-count scoring
      // Under effective target — incentivize
      const remaining = effectiveTarget - shiftCount[p.id]
      score += Math.max(0, remaining) * 10

      // Penalty for going over effective target
      if (shiftCount[p.id] >= effectiveTarget) score -= 25

      // Soft cap penalty — strong penalty for exceeding max
      if (shiftCount[p.id] >= effectiveMax) score -= 60

      // PRN penalty
      if (p.isPRN) score -= 40

      // Rest quality bonus (more rest = better circadian)
      const gap = start - lastEnd[p.id]
      if (gap >= 1440) score += 20  // been off a full day

      // ── Weekly workload limit (rolling 7-day window) ──────────────────────
      // Prefer ≤ 3 × 24H or ≤ 4 × 12H shifts in any 7-day window.
      // This is a soft penalty — coverage is still guaranteed if no other candidate.
      const windowStart = Math.max(0, d - 6)
      const { count24h: w24h, count12h: w12h } = shiftsInWindow(p.id, windowStart, d - 1)
      if (slot.shiftType === "24H"  && w24h >= MAX_24H_PER_WEEK)  score -= 50
      if (slot.shiftType !== "24H"  && w12h >= MAX_12H_PER_WEEK)  score -= 50

      // ── Weekend fairness ─────────────────────────────────────────────────
      // Distribute weekend shifts evenly unless this physician explicitly
      // requested this date (it appears in their preferredDates list).
      if (isWeekend(slot.date) && !p.preferredDates.includes(slot.date)) {
        const minWeekend = Math.min(...candidates.map((c) => weekendCount[c.id]))
        const maxWeekend = Math.max(...candidates.map((c) => weekendCount[c.id]))
        if (maxWeekend > minWeekend) {
          // Bonus for having fewer weekends, penalty for having more
          score += (maxWeekend - weekendCount[p.id]) * WEEKEND_BALANCE_WEIGHT
        }
      }

      // Tiebreaker
      score += Math.random() * 5

      return { p, score }
    })

    scored.sort((a, b) => b.score - a.score)
    const winner = scored[0].p

    lastEnd[winner.id] = end
    shiftCount[winner.id]++
    if (isWeekend(slot.date)) weekendCount[winner.id]++

    results.push({
      date:        slot.date,
      shiftType:   slot.shiftType,
      userId:      winner.id,
      isConflict:  false,
      conflictNote: "",
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
