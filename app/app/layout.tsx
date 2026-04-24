import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options'
import { AppSidebar } from '@/components/app-sidebar'
import { AppHeader } from '@/components/app-header'
import { prisma } from '@/lib/shared/prisma'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/login')
  }

  // Fetch avatarUrl and logoUrl fresh from DB (not from JWT to avoid cookie overflow)
  let dbUser: { avatarUrl: string | null; company: { logoUrl: string | null } | null } | null = null
  try {
    dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        avatarUrl: true,
        company: { select: { logoUrl: true } },
      },
    })
  } catch (e) {
    console.error('[AppLayout] Failed to fetch user from DB:', e)
  }

  const user = {
    id: session.user.id,
    name: session.user.name ?? '',
    email: session.user.email ?? '',
    role: session.user.role ?? 'SELLER',
    companyId: session.user.companyId ?? '',
    companyName: session.user.companyName ?? '',
    companySlug: session.user.companySlug ?? '',
    avatarUrl: dbUser?.avatarUrl ?? undefined,
    logoUrl: dbUser?.company?.logoUrl ?? undefined,
  }

  return (
    <div className="min-h-screen flex">
      <AppSidebar user={user} />
      <div className="flex-1 flex flex-col">
        <AppHeader user={user} />
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
