import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { z } from 'zod'
import { verifyCredentials } from '@/lib/auth'
import { EmailSchema, SlugSchema } from '@/lib/shared/validation'

const LoginInputSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, 'Password is required'),
  companySlug: SlugSchema.optional(),
})

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        companySlug: { label: 'Company', type: 'text' },
      },
      async authorize(credentials, req) {
        const parseResult = LoginInputSchema.safeParse({
          email: credentials?.email,
          password: credentials?.password,
          companySlug: credentials?.companySlug,
        })

        if (!parseResult.success) {
          return null
        }

        const { email, password, companySlug } = parseResult.data
        const user = await verifyCredentials(email, password, companySlug)

        if (!user) {
          return null
        }

        // Return a plain object that matches the User type expected by NextAuth
        // The 'company' field is required by NextAuth's User type, so we include it
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          companyId: user.companyId,
          companyName: user.company.name,
          companySlug: user.company.slug,
          avatarUrl: user.avatarUrl,
          company: user.company, // Required by NextAuth User type
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
