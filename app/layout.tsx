import type { Metadata, Viewport } from "next"
import "./globals.css"
import SessionProvider from "@/components/SessionProvider"

export const metadata: Metadata = {
  title: "TotalCare Denton Scheduler",
  description: "TotalCare Denton – Emergency Room Shift Scheduling",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TotalCare Denton",
  },
}

export const viewport: Viewport = {
  themeColor: "#0d2580",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased" style={{ background: "#f4f6fb" }}>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
