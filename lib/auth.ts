import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "./db"

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null

        let user
        try {
          user = await prisma.user.findUnique({
            where: { username: credentials.username },
          })
        } catch (err) {
          console.error("[auth] DB error:", err)
          return null
        }

        if (!user || !user.isActive) {
          console.error("[auth] User not found or inactive:", credentials.username)
          return null
        }

        const isValid = await bcrypt.compare(credentials.password, user.password)
        if (!isValid) {
          console.error("[auth] Password mismatch for:", credentials.username)
          return null
        }

        return {
          id: user.id,
          name: user.name,
          email: "",
          role: user.role,
          isPRN: user.isPRN,
          prefersTwelveHour: user.prefersTwelveHour,
          username: user.username,
          color: user.color,
        }
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role              = (user as any).role
        token.isPRN             = (user as any).isPRN
        token.prefersTwelveHour = (user as any).prefersTwelveHour
        token.username          = (user as any).username
        token.color             = (user as any).color
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as any).id               = token.sub
        ;(session.user as any).role             = token.role
        ;(session.user as any).isPRN            = token.isPRN
        ;(session.user as any).prefersTwelveHour = token.prefersTwelveHour
        ;(session.user as any).username         = token.username
        ;(session.user as any).color            = token.color
      }
      return session
    },
  },
  pages: { signIn: "/login" },
  secret: process.env.NEXTAUTH_SECRET,
}
