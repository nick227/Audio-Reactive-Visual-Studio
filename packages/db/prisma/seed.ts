import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient() // use standalone client in seed, not the singleton
const BCRYPT_ROUNDS = 12

async function main() {
  const email = process.env.ADMIN_EMAIL
  if (!email) {
    console.log('ADMIN_EMAIL not set — skipping seed.')
    return
  }

  const password = process.env.ADMIN_PASSWORD
  if (!password) {
    throw new Error('ADMIN_PASSWORD is required when ADMIN_EMAIL is set.')
  }

  const displayName = process.env.ADMIN_DISPLAY_NAME ?? 'Admin'
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)

  const admin = await db.user.upsert({
    where: { email },
    update: { role: UserRole.ADMIN, displayName, passwordHash },
    create: {
      email,
      displayName,
      role: UserRole.ADMIN,
      passwordHash,
      // googleId is intentionally null — populated on first Google sign-in
      // when GoogleAuthService matches by email and attaches the googleId.
    },
  })

  console.log(`Admin user ready: ${admin.email} (id: ${admin.id})`)
  console.log('Admin password hash updated from ADMIN_PASSWORD.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
