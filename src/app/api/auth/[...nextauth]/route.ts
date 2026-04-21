import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase";

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email:    { label: "Email",    type: "email" },
        password: { label: "Password", type: "password" },
        remember: { label: "Remember", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // Look up user in agency_users table
        const { data: agencyUser, error } = await supabaseAdmin
          .from("agency_users")
          .select("id, agency_id, email, password_hash, name, role")
          .eq("email", credentials.email)
          .single();

        if (error || !agencyUser) return null;

        const passwordOk = await bcrypt.compare(
          credentials.password,
          agencyUser.password_hash,
        );
        if (!passwordOk) return null;

        return {
          id:       agencyUser.id,
          email:    agencyUser.email,
          name:     agencyUser.name,
          agencyId: agencyUser.agency_id,
          role:     agencyUser.role,
          remember: credentials.remember === "true",
        };
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60,
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.agencyId = user.agencyId;
        token.role     = user.role;
        token.remember = (user as { remember?: boolean }).remember ?? false;
        const maxAge = token.remember ? 7 * 24 * 60 * 60 : 24 * 60 * 60;
        token.exp = Math.floor(Date.now() / 1000) + maxAge;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.agencyId = token.agencyId as string;
        // NOTE: role is baked into the JWT at login and goes stale if the DB role
        // is changed. This is a known limitation — the user must re-login for a
        // role change to appear in session.user.role. All API routes re-check role
        // directly from agency_users on every request, so enforcement is not affected.
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  secret: process.env.AUTH_SECRET,
});

export { handler as GET, handler as POST };
