import NextAuth from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name: string
      email: string
      role: string
      isPRN: boolean
      prefersTwelveHour: boolean
      useHoursTarget: boolean
      username: string
      color: string
    }
  }
}
