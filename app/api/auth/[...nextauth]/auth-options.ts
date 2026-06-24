import { type NextAuthOptions, type Session } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { type JWT } from 'next-auth/jwt'
import { z } from 'zod'
import { verifyCredentials } from '@/lib/auth'
import { EmailSchema, SlugSchema } from '@/lib/shared/validation'
import { env } from '@/lib/env'
import { prisma } from '@/lib/shared/prisma'

type AuthUser = {
  id: string
  email: string
  name: string
  role: string
  companyId: string
  companyName: string
  companySlug: string
  avatarUrl?: string | null
  company: unknown
}

type AuthToken = JWT & {
  id?: string
  role?: string
  companyId?: string
  companyName?: string
  companySlug?: string
  // Timestamp (ms) de la última vez que los claims se refrescaron desde la DB.
  // Permite refrescar rol/company/estado periódicamente sin consultar en cada request.
  refreshedAt?: number
}

const LoginInputSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, 'Password is required'),
  // SECURITY: companySlug obligatorio para garantizar aislamiento entre tenants
  // en el login (ver verifyCredentials en lib/auth.ts).
  companySlug: SlugSchema,
})

// Intervalo de refresco de claims desde la DB (ms). El callback `jwt` se invoca
// varias veces por request de sesión; con este throttle evitamos consultar la
// DB en cada uno y aun así propagar cambios de rol / isActive / empresa en
// minutos en lugar de esperar a que expire el JWT (24h).
const CLAIM_REFRESH_INTERVAL_MS = 5 * 60 * 1000 // 5 minutos

/**
 * Refresca role / companyId / estado de activación del usuario y su empresa
 * desde la DB. Si el usuario o la empresa fueron desactivados, limpia el token
 * para forzar re-autenticación (revocación efectiva sin sessions en DB).
 * Es defensivo: si la DB falla, conserva el token existente para no bloquear.
 */
async function refreshClaimsIfNeeded(token: AuthToken): Promise<AuthToken> {
  const userId = token.id
  if (!userId) return token

  const now = Date.now()
  if (token.refreshedAt && now - token.refreshedAt < CLAIM_REFRESH_INTERVAL_MS) {
    return token
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        isActive: true,
        companyId: true,
        company: {
          select: { name: true, slug: true, isActive: true },
        },
      },
    })

    // Usuario o empresa desactivados → invalidar token (forzar logout).
    // Construimos un token sin los claims de identidad: los callbacks de sesión
    // y requireAuth() tratan la ausencia de id/companyId como "no autenticado".
    if (!dbUser || !dbUser.isActive || !dbUser.company?.isActive) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, role, companyId, companyName, companySlug, ...rest } = token
      return rest as AuthToken
    }

    return {
      ...token,
      role: dbUser.role,
      companyId: dbUser.companyId,
      companyName: dbUser.company.name,
      companySlug: dbUser.company.slug,
      refreshedAt: now,
    }
  } catch {
    // Si la DB falla, conservar el token para no bloquear al usuario.
    // requireAuth() (auth-helpers.ts) ya re-valida isActive en cada request sensible.
    return token
  }
}

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
        } as AuthUser
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Sign-in inicial: setear claims desde el resultado de authorize().
        token.id = user.id
        token.role = user.role
        token.companyId = user.companyId
        token.companyName = user.companyName
        token.companySlug = user.companySlug
        token.refreshedAt = Date.now()
        // Do NOT store avatarUrl/logoUrl in the JWT — they can be large base64
        // strings that overflow the cookie size limit (HTTP 431).
        // They are fetched fresh from the DB in the layout server component.
      } else {
        // Rotación del token (cualquier acceso con sesión existente).
        // Refrescar claims desde la DB con throttle para que los cambios de
        // rol / desactivación se propaguen en minutos (revocación efectiva).
        token = await refreshClaimsIfNeeded(token as AuthToken)
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
  secret: env.NEXTAUTH_SECRET,
  cookies: {
    sessionToken: {
      name:
        env.NODE_ENV === 'production'
          ? '__Secure-next-auth.session-token'
          : 'next-auth.session-token',
      options: {
        httpOnly: true,
        // 'lax' is required (not 'strict') so the session cookie survives
        // cross-site top-level navigations such as returning from Google OAuth.
        // With 'strict', the browser strips the cookie on the redirect-back from
        // Google, causing getServerSession() to return null → blank /login screen.
        sameSite: 'lax',
        path: '/',
        secure: env.NODE_ENV === 'production',
      },
    },
    callbackUrl: {
      name:
        env.NODE_ENV === 'production'
          ? '__Secure-next-auth.callback-url'
          : 'next-auth.callback-url',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: env.NODE_ENV === 'production',
      },
    },
    csrfToken: {
      name:
        env.NODE_ENV === 'production'
          ? '__Secure-next-auth.csrf-token'
          : 'next-auth.csrf-token',
      options: {
        httpOnly: false,
        sameSite: 'lax',
        path: '/',
        secure: env.NODE_ENV === 'production',
      },
    },
  },
  useSecureCookies: env.NODE_ENV === 'production',
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60 * 24,
    updateAge: 60 * 15,
  },
  pages: {
    signIn: '/login',
  },
}
