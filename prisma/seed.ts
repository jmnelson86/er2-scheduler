import { PrismaClient } from "@prisma/client"
import { PrismaLibSql } from "@prisma/adapter-libsql"
import bcrypt from "bcryptjs"
import path from "path"

const rawUrl = process.env.DATABASE_URL ?? `file:${path.resolve(__dirname, "../er2-scheduler.db")}`
const dbUrl = rawUrl.startsWith("file:./")
  ? `file:${path.resolve(rawUrl.slice(7))}`
  : rawUrl
const authToken = process.env.DATABASE_AUTH_TOKEN
const adapterConfig: any = { url: dbUrl }
if (authToken) adapterConfig.authToken = authToken
const adapter = new PrismaLibSql(adapterConfig)
const prisma  = new PrismaClient({ adapter } as any)

async function main() {
  console.log("Seeding Location 2 ER Scheduler…")

  // Admin
  await prisma.user.upsert({
    where:  { username: "admin" },
    update: {},
    create: {
      name:     "Admin",
      username: "admin",
      password: await bcrypt.hash("admin123", 10),
      role:     "ADMIN",
      isPRN:    false,
    },
  })

  // Full-time physicians (~4)
  const regularDocs = [
    { name: "Dr. Allison Carter",  username: "acarter",   prefersTwelveHour: false },
    { name: "Dr. Brandon Reyes",   username: "breyes",    prefersTwelveHour: true  },
    { name: "Dr. Clara Kim",       username: "ckim",      prefersTwelveHour: false },
    { name: "Dr. David Nguyen",    username: "dnguyen",   prefersTwelveHour: true  },
  ]

  for (const doc of regularDocs) {
    await prisma.user.upsert({
      where:  { username: doc.username },
      update: {},
      create: {
        name:              doc.name,
        username:          doc.username,
        password:          await bcrypt.hash("password123", 10),
        role:              "PHYSICIAN",
        isPRN:             false,
        prefersTwelveHour: doc.prefersTwelveHour,
      },
    })
  }

  // PRN physicians (~3-4)
  const prnDocs = [
    { name: "Dr. Elena Morales",  username: "emorales",  prefersTwelveHour: false },
    { name: "Dr. Frank Okafor",   username: "fokafor",   prefersTwelveHour: true  },
    { name: "Dr. Grace Lin",      username: "glin",      prefersTwelveHour: false },
    { name: "Dr. Henry Walsh",    username: "hwalsh",    prefersTwelveHour: true  },
  ]

  for (const doc of prnDocs) {
    await prisma.user.upsert({
      where:  { username: doc.username },
      update: {},
      create: {
        name:              doc.name,
        username:          doc.username,
        password:          await bcrypt.hash("password123", 10),
        role:              "PHYSICIAN",
        isPRN:             true,
        prefersTwelveHour: doc.prefersTwelveHour,
      },
    })
  }

  console.log("✅ Seeded successfully!")
  console.log("   Admin login: admin / admin123")
  console.log("   Physician logins: <username> / password123")
  console.log("   Full-time: acarter, breyes, ckim, dnguyen")
  console.log("   PRN: emorales, fokafor, glin, hwalsh")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
