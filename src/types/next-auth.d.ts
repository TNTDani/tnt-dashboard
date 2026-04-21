import NextAuth from "next-auth";

declare module "next-auth" {
  interface User {
    agencyId: string;
    role: string;
    remember?: boolean;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      agencyId: string;
      role: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    agencyId: string;
    role: string;
    remember?: boolean;
  }
}
