"use client";

import { useEffect, useRef } from "react";
import { SessionProvider, useSession } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

// Redirects email-login users (name === null) to the settings/onboarding page.
// Fires at most once per session via a ref guard.
function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const didRedirect = useRef(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (didRedirect.current) return;
    if (pathname.startsWith("/settings") || pathname.startsWith("/login")) return;

    if (session?.user && !session.user.name) {
      didRedirect.current = true;
      toast.info("Please complete your profile", {
        description: "Add your name to personalise your SierraLogic experience.",
      });
      router.push("/settings?onboarding=true");
    }
  }, [status, session, pathname, router]);

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <OnboardingGuard>{children}</OnboardingGuard>
        <Toaster richColors position="top-right" />
      </ThemeProvider>
    </SessionProvider>
  );
}
