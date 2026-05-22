import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = "TotalCare Denton Scheduler <onboarding@resend.dev>"

const MONTH_NAMES = [
  "","January","February","March","April","May","June",
  "July","August","September","October","November","December",
]

export async function sendShiftOfferEmail({
  toEmail,
  toName,
  offeringName,
  date,
  shiftType,
  offerType,
}: {
  toEmail: string
  toName: string
  offeringName: string
  date: string
  shiftType: string
  offerType: "PICKUP" | "TRADE"
}) {
  const shiftLabel: Record<string, string> = { "24H": "24-hour", DAY12: "Day 12h", NIGHT12: "Night 12h" }
  const subject = offerType === "TRADE"
    ? `Shift trade request from ${offeringName}`
    : `Shift pickup offer from ${offeringName}`
  const action = offerType === "TRADE" ? "trade their shift with you" : "offer a shift for pickup"

  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject,
    html: `
      <p>Hi ${toName},</p>
      <p><strong>${offeringName}</strong> would like to ${action}:</p>
      <p style="margin-left:16px">
        <strong>Date:</strong> ${date}<br/>
        <strong>Shift:</strong> ${shiftLabel[shiftType] ?? shiftType}
      </p>
      <p>Log in to <a href="${process.env.NEXTAUTH_URL}/shift-offers">TotalCare Denton Scheduler</a> to review and respond.</p>
      <p style="color:#888;font-size:12px">TotalCare Denton · Shift Scheduler</p>
    `,
  })
}

export async function sendSchedulePublishedEmail({
  toEmail,
  toName,
  month,
  year,
}: {
  toEmail: string
  toName: string
  month: number
  year: number
}) {
  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: `Schedule published: ${MONTH_NAMES[month]} ${year}`,
    html: `
      <p>Hi ${toName},</p>
      <p>The schedule for <strong>${MONTH_NAMES[month]} ${year}</strong> has been published.</p>
      <p><a href="${process.env.NEXTAUTH_URL}/schedule">View your schedule →</a></p>
      <p style="color:#888;font-size:12px">TotalCare Denton · Shift Scheduler</p>
    `,
  })
}
