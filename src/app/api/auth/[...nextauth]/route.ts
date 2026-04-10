import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

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
        if (!credentials) return null;
        if (
          credentials.email    !== process.env.DASHBOARD_EMAIL ||
          credentials.password !== process.env.DASHBOARD_PASSWORD
        ) return null;

        return {
          id: "1",
          email:    credentials.email as string,
          name:     "Dani",
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
    maxAge: 7 * 24 * 60 * 60, // 7 days max
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        const remember = (user as { remember?: boolean }).remember ?? false;
        token.remember = remember;
        // Set exp based on remember choice: 24h or 7d
        const maxAge = remember ? 7 * 24 * 60 * 60 : 24 * 60 * 60;
        token.exp    = Math.floor(Date.now() / 1000) + maxAge;
      }
      return token;
    },
  },
  secret: process.env.AUTH_SECRET,
});

export { handler as GET, handler as POST };
