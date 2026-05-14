import { withAuth } from "next-auth/middleware";

export default withAuth({
  callbacks: {
    authorized({ token, req }) {
      // Allow through if: valid session token OR guest cookie is set
      const isGuest = req.cookies.get("sierra-guest")?.value === "1";
      return !!token || isGuest;
    },
  },
  pages: { signIn: "/login" },
});

export const config = {
  // Protect everything except auth routes, API endpoints, login page, and Next.js internals
  matcher: [
    "/((?!api/auth|api/analyze|api/history|login|_next/static|_next/image|favicon\\.ico).*)",
  ],
};
