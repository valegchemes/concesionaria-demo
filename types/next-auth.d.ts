import NextAuth from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: string
      companyId: string
      companyName: string
      companySlug: string
      avatarUrl?: string
      logoUrl?: string
    }
  }

  interface User {
    id: string
    role: string
    companyId: string
    companyName: string
    companySlug: string
    avatarUrl?: string | null
    company: any // Added to allow user.company to pass through
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: string
    companyId: string
    companyName: string
    companySlug: string
    avatarUrl?: string
    logoUrl?: string
  }
}
