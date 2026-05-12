import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options'
import { AppSidebar } from '@/components/app-sidebar'
import { AppHeader } from '@/components/app-header'
import { GlobalBackground } from '@/components/global-background'
import { prisma } from '@/lib/shared/prisma'

export const dynamic = 'force-dynamic'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const requestHeaders = await headers()
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/login')
  }

  // Fetch avatarUrl and logoUrl fresh from DB (not from JWT to avoid cookie overflow)
  // Also fetch company name to avoid staleness if user changed it in settings
  let dbUser: { avatarUrl: string | null; company: { name: string; logoUrl: string | null } | null } | null = null
  try {
    dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        avatarUrl: true,
        company: { select: { name: true, logoUrl: true } },
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
    companyName: dbUser?.company?.name ?? session.user.companyName ?? '',
    companySlug: session.user.companySlug ?? '',
    avatarUrl: dbUser?.avatarUrl ?? undefined,
    logoUrl: dbUser?.company?.logoUrl ?? undefined,
  }

  return (
    <>
      <GlobalBackground avatarUrl={user.avatarUrl || user.logoUrl} />
      <div className="min-h-screen flex bg-transparent">
        <AppSidebar user={user} />
        <div className="flex-1 flex flex-col bg-transparent">
          <AppHeader user={user} />
          <main className="flex-1 p-6 overflow-auto bg-transparent">
            {children}
          </main>
        </div>
      </div>
    </>
  )
}
