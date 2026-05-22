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

  const physicians = [
    { name: "Dr. Jessica Nelson",  username: "jnelson"   },
    { name: "Dr. Olusola Balogun", username: "obalogun"  },
    { name: "Dr. Rick Colyer",     username: "rcolyer"   },
    { name: "Dr. Daniel Dorton",   username: "ddorton"   },
    { name: "Dr. Kellie Longdon",  username: "klongdon"  },
    { name: "Dr. James Fambro",    username: "jfambro"   },
    { name: "Dr. Sarah Hockaday",  username: "shockaday" },
    { name: "Dr. Camilo Torres",   username: "ctorres"   },
  ]

  for (const doc of physicians) {
    await prisma.user.upsert({
      where:  { username: doc.username },
      update: {},
      create: {
        name:     doc.name,
        username: doc.username,
        password: await bcrypt.hash("password123", 10),
        role:     "PHYSICIAN",
        isPRN:    false,
      },
    })
  }

  console.log("✅ Seeded successfully!")
  console.log("   Admin login: admin / admin123")
  console.log("   Physician logins: <username> / password123")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
