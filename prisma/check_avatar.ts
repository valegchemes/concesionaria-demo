import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const devEmail = process.env.DEVELOPER_EMAILS?.split(',')[0]?.trim() || 'no-dev-configured@example.com'
  const user = await prisma.user.findFirst({
    where: { email: devEmail },
    select: { id: true, name: true, avatarUrl: true }
  })
  console.log('User:', user?.name)
  console.log('AvatarUrl length:', user?.avatarUrl?.length || 0)
  if (user?.avatarUrl) {
    console.log('AvatarUrl starts with:', user.avatarUrl.substring(0, 50))
  }
  await prisma.$disconnect()
}

main()
