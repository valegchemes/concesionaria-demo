import { PrismaClient } from '@prisma/client'

const PROD_URL = "postgresql://neondb_owner:npg_pwDl1niXeFL9@ep-royal-tree-am9bx843-pooler.c-5.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require"

const prisma = new PrismaClient({
  datasources: {
    db: { url: PROD_URL }
  }
})

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: 'valegchemes@gmail.com' },
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
