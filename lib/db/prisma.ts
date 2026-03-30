import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@/lib/generated/prisma/client"

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error("DATABASE_URL is required for Prisma client")
}

const adapter = new PrismaPg({ connectionString })
const prisma = global.__prisma ?? new PrismaClient({ adapter })

// Prevent exhausting connections in dev with hot reload.
if (process.env.NODE_ENV !== "production") global.__prisma = prisma

export default prisma

