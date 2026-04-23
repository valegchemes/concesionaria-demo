import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { verifyCredentials } from '@/lib/auth'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        companySlug: { label: 'Company', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await verifyCredentials(
          credentials.email,
          credentials.password,
          credentials.companySlug
        )

        if (!user) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          companyId: user.companyId,
          companyName: user.company.name,
          companySlug: user.company.slug,
          avatarUrl: user.avatarUrl,
          logoUrl: user.company.logoUrl,
        } as any
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.companyId = user.companyId
        token.companyName = user.companyName
        token.companySlug = (user as any).companySlug
        // Do NOT store avatarUrl/logoUrl in the JWT — they can be large base64
        // strings that overflow the cookie size limit (HTTP 431).
        // They are fetched fresh from the DB in the layout server component.
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.companyId = token.companyId as string
        session.user.companyName = token.companyName as string
        session.user.companySlug = token.companySlug as string
        // avatarUrl and logoUrl are NOT in the token — see layout.tsx
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
}
