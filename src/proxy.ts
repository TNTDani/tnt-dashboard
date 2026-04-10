import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function proxy(req) {
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized({ token, req }) {
        const { pathname } = req.nextUrl;

        // Public routes — always accessible
        if (
          pathname.startsWith("/login") ||
          pathname === "/intake" ||
          pathname.startsWith("/api/intake") ||
          pathname.startsWith("/api/auth")
        ) {
          return true;
        }

        return !!token;
      },
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
