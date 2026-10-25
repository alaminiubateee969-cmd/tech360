import { NextRequest, NextResponse } from "next/server";
import { getServerSession as nextAuthGetServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

const SECRET = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || "dev-only-not-for-production";

declare module "next-auth" {
  interface Session { user: { id: string; email: string; name?: string | null; role: string } }
  interface User { id: string; email: string; name?: string | null; role: string }
}
declare module "next-auth/jwt" { interface JWT { id?: string; role?: string } }

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  secret: SECRET,
  pages: { signIn: "/" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" } },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await db.user.findUnique({ where: { email: credentials.email } });
        if (!user || !user.password) return null;
        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) return null;
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) { if (user) { token.id = user.id; token.role = user.role; } return token; },
    async session({ session, token }) { if (session.user) { session.user.id = token.id as string; session.user.role = token.role as string; } return session; },
  },
};

export async function getCurrentUser(req: NextRequest) {
  const session = await nextAuthGetServerSession(authOptions as any) as any;
  if (!session?.user) return null;
  return { id: session.user.id, email: session.user.email, name: session.user.name, role: session.user.role };
}

type AuthResult = { ok: true; session: { user: { id: string; email: string; name?: string | null; role: string } } } | { ok: false; response: NextResponse };

export async function requireAuth(req: NextRequest): Promise<AuthResult> {
  const user = await getCurrentUser(req);
  if (!user) return { ok: false, response: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
  return { ok: true, session: { user } };
}

export async function requireRole(roles: string[], req: NextRequest): Promise<AuthResult> {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth;
  if (!roles.includes(auth.session.user.role)) return { ok: false, response: NextResponse.json({ error: "Insufficient role" }, { status: 403 }) };
  return auth;
}
