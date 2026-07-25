import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@labdoc.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "Admin",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "admin@labdoc.com" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        if (
          credentials.email.trim().toLowerCase() === ADMIN_EMAIL.trim().toLowerCase() &&
          credentials.password === ADMIN_PASSWORD
        ) {
          return { id: "admin", email: ADMIN_EMAIL, name: "Admin" };
        }
        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = "admin";
        token.email = user.email ?? token.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    // We use a custom in-page login dialog instead of a dedicated page
    signIn: "/",
  },
};

// Helper for API routes to check admin session
export async function requireAdmin(): Promise<boolean> {
  const { getServerSession } = await import("next-auth");
  const session = await getServerSession(authOptions);
  return !!session?.user;
}
