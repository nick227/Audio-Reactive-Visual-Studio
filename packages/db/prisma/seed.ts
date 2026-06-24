import { PrismaClient, UserRole } from '@prisma/client'

const db = new PrismaClient() // use standalone client in seed, not the singleton

async function main() {
  const email = process.env.ADMIN_EMAIL
  if (!email) {
    console.log('ADMIN_EMAIL not set — skipping seed.')
    return
  }

  const displayName = process.env.ADMIN_DISPLAY_NAME ?? 'Admin'

  const admin = await db.user.upsert({
    where: { email },
    update: { role: UserRole.ADMIN, displayName },
    create: {
      email,
      displayName,
      role: UserRole.ADMIN,
      // googleId is intentionally null — populated on first Google sign-in
      // when GoogleAuthService matches by email and attaches the googleId.
    },
  })

  console.log(`Admin user ready: ${admin.email} (id: ${admin.id})`)
}

main().catch(console.error).finally(() => db.$disconnect())
