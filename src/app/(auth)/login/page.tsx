"use client";

import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Loader2, Mail, MailCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ─── Brand icons ──────────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email:    z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = z
  .object({
    name:            z.string().min(2, "Name must be at least 2 characters").max(60),
    email:           z.string().email("Enter a valid email address"),
    password:        z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type LoginForm    = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;

type Mode = "login" | "register" | "verify";
interface PendingCreds { email: string; password: string }

// ─── Password input with visibility toggle ────────────────────────────────────

function PasswordField({
  id, placeholder = "Password", error, disabled, registration,
}: {
  id: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  registration: ReturnType<ReturnType<typeof useForm>["register"]>;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          placeholder={placeholder}
          disabled={disabled}
          {...registration}
          className="pr-10"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ─── OTP input (6 individual digit boxes) ────────────────────────────────────

function OtpInput({ value, onChange, disabled }: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  function handleChange(idx: number, char: string) {
    const digit = char.replace(/\D/g, "").slice(-1);
    const arr = value.split("").concat(Array(6).fill("")).slice(0, 6);
    arr[idx] = digit;
    const next = arr.join("");
    onChange(next);
    if (digit && idx < 5) inputs.current[idx + 1]?.focus();
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !value[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length > 0) { onChange(pasted.padEnd(6, "").slice(0, 6)); inputs.current[Math.min(pasted.length, 5)]?.focus(); }
    e.preventDefault();
  }

  return (
    <div className="flex justify-center gap-2" onPaste={handlePaste}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { inputs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] ?? ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          disabled={disabled}
          className={cn(
            "h-12 w-10 rounded-lg border text-center text-xl font-bold font-mono transition-colors",
            "border-border bg-background text-foreground",
            "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
            "disabled:opacity-40",
            value[i] ? "border-primary" : "",
          )}
        />
      ))}
    </div>
  );
}

// ─── Verify form ──────────────────────────────────────────────────────────────

function VerifyForm({
  pending,
  onBack,
}: {
  pending: PendingCreds;
  onBack: () => void;
}) {
  const router  = useRouter();
  const [code, setCode]       = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown]   = useState(0);

  // Countdown timer for resend button
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  async function handleVerify() {
    if (code.length < 6) return;
    setError(""); setLoading(true);
    try {
      const res  = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pending.email, code }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error ?? "Verification failed."); setLoading(false); return; }

      toast.success("Email verified! Signing you in…");

      const result = await signIn("credentials", {
        email:    pending.email,
        password: pending.password,
        redirect: false,
      });
      if (result?.ok) {
        router.push("/settings?onboarding=true");
        router.refresh();
      } else {
        toast.info("Email verified. Please sign in.");
        onBack();
      }
    } catch {
      setError("Network error — try again."); setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    try {
      await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pending.email }),
      });
      toast.success("New code sent — check your inbox.");
      setCode(""); setError(""); setCooldown(60);
    } catch {
      toast.error("Could not resend code.");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="space-y-2 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-950/40">
          <MailCheck className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <p className="font-semibold">Check your email</p>
        <p className="text-xs text-muted-foreground">
          We sent a 6-digit code to{" "}
          <span className="font-medium text-foreground">{pending.email}</span>.
          <br />It expires in 15 minutes.
        </p>
      </div>

      {/* OTP boxes */}
      <OtpInput value={code} onChange={setCode} disabled={loading} />

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-center text-xs text-destructive">{error}</p>
      )}

      <Button
        className="w-full"
        disabled={code.length < 6 || loading}
        onClick={handleVerify}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify email"}
      </Button>

      {/* Resend */}
      <div className="flex items-center justify-center gap-1.5">
        <button
          type="button"
          onClick={handleResend}
          disabled={resending || cooldown > 0}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", resending && "animate-spin")} />
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
        </button>
      </div>

      <button
        type="button"
        onClick={onBack}
        className="w-full text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
      >
        ← Back to sign in
      </button>
    </div>
  );
}

// ─── Login form (with 2FA + email-not-verified steps) ────────────────────────

function LoginForm({
  onSwitch,
  onNeedsVerify,
}: {
  onSwitch: () => void;
  onNeedsVerify: (email: string, password: string) => void;
}) {
  const router = useRouter();
  const [authError,  setAuthError]  = useState("");
  const [magicSent,  setMagicSent]  = useState(false);
  const [checking,   setChecking]   = useState(false);
  const [needs2FA,   setNeeds2FA]   = useState(false);
  const [totpCode,   setTotpCode]   = useState("");
  const [savedCreds, setSavedCreds] = useState<PendingCreds | null>(null);

  const { register, handleSubmit, getValues, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginForm) {
    setAuthError(""); setChecking(true);

    // Pre-flight: detect 2FA requirement and email-not-verified state
    let checkResult: { valid: boolean; reason?: string; requires2FA?: boolean };
    try {
      const res = await fetch("/api/auth/credentials/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email, password: data.password }),
      });
      checkResult = await res.json();
    } catch {
      setAuthError("Network error — try again."); setChecking(false); return;
    }

    if (!checkResult.valid) {
      if (checkResult.reason === "email_not_verified") {
        // Password correct but email not confirmed — send them to OTP step
        toast.info("Please verify your email first.");
        onNeedsVerify(data.email, data.password);
        setChecking(false);
        return;
      }
      setAuthError("Incorrect email or password."); setChecking(false); return;
    }

    if (checkResult.requires2FA) {
      setSavedCreds({ email: data.email, password: data.password });
      setNeeds2FA(true); setChecking(false); return;
    }

    // Normal sign-in
    const result = await signIn("credentials", {
      email: data.email, password: data.password, redirect: false,
    });
    setChecking(false);
    if (result?.ok) { router.push("/"); router.refresh(); }
    else setAuthError("Incorrect email or password.");
  }

  async function submitWithTotp() {
    if (!savedCreds || !totpCode.trim()) return;
    setAuthError(""); setChecking(true);
    const result = await signIn("credentials", {
      email: savedCreds.email, password: savedCreds.password, totp: totpCode.trim(), redirect: false,
    });
    setChecking(false);
    if (result?.ok) { router.push("/"); router.refresh(); }
    else setAuthError("Invalid 2FA code. Please try again.");
  }

  async function sendMagicLink() {
    const email = getValues("email");
    if (!email) { setAuthError("Enter your email first."); return; }
    await signIn("email", { email, callbackUrl: "/", redirect: false });
    setMagicSent(true);
    toast.success("Magic link sent — check your inbox.");
  }

  // ── 2FA step ───────────────────────────────────────────────────────────────
  if (needs2FA) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-muted/50 px-4 py-3 text-center">
          <p className="text-sm font-medium">Two-factor authentication</p>
          <p className="mt-1 text-xs text-muted-foreground">Enter the 6-digit code from your authenticator app.</p>
        </div>
        <OtpInput value={totpCode} onChange={setTotpCode} disabled={checking} />
        {authError && <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive text-center">{authError}</p>}
        <Button className="w-full" disabled={totpCode.length < 6 || checking} onClick={submitWithTotp}>
          {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & sign in"}
        </Button>
        <button
          type="button"
          onClick={() => { setNeeds2FA(false); setTotpCode(""); setAuthError(""); setSavedCreds(null); }}
          className="w-full text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
        >
          ← Back
        </button>
      </div>
    );
  }

  // ── Credentials step ────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div>
        <Input placeholder="you@company.com" type="email" disabled={isSubmitting || checking} {...register("email")} />
        {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
      </div>
      <PasswordField id="login-password" placeholder="Password" error={errors.password?.message} disabled={isSubmitting || checking} registration={register("password")} />
      {authError && <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{authError}</p>}
      <Button type="submit" className="w-full" disabled={isSubmitting || checking}>
        {(isSubmitting || checking) ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
      </Button>
      <button type="button" onClick={sendMagicLink} disabled={magicSent} className="flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-60">
        <Mail className="h-3.5 w-3.5" />
        {magicSent ? "Magic link sent!" : "Send a magic link instead"}
      </button>
      <p className="text-center text-xs text-muted-foreground">
        No account?{" "}
        <button type="button" onClick={onSwitch} className="font-medium text-foreground underline underline-offset-2">Create one</button>
      </p>
    </form>
  );
}

// ─── Register form ────────────────────────────────────────────────────────────

function RegisterForm({
  onSwitch,
  onVerify,
}: {
  onSwitch: () => void;
  onVerify: (email: string, password: string) => void;
}) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  async function onSubmit(data: RegisterForm) {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: data.name, email: data.email, password: data.password }),
    });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      toast.error((body as { error?: string }).error ?? "Registration failed.");
      return;
    }

    // API always returns requiresEmailVerification: true now
    toast.success("Account created! Check your email for a verification code.");
    onVerify(data.email, data.password);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div>
        <Input placeholder="Your name" disabled={isSubmitting} {...register("name")} />
        {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>}
      </div>
      <div>
        <Input placeholder="you@company.com" type="email" disabled={isSubmitting} {...register("email")} />
        {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
      </div>
      <PasswordField id="reg-password" placeholder="Password (min. 8 characters)" error={errors.password?.message} disabled={isSubmitting} registration={register("password")} />
      <PasswordField id="reg-confirm" placeholder="Confirm password" error={errors.confirmPassword?.message} disabled={isSubmitting} registration={register("confirmPassword")} />
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Already have an account?{" "}
        <button type="button" onClick={onSwitch} className="font-medium text-foreground underline underline-offset-2">Sign in</button>
      </p>
    </form>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode]               = useState<Mode>("login");
  const [pendingCreds, setPendingCreds] = useState<PendingCreds | null>(null);

  function enterVerify(email: string, password: string) {
    setPendingCreds({ email, password });
    setMode("verify");
  }

  function handleGuest() {
    document.cookie = "sierra-guest=1; path=/; max-age=86400";
    router.push("/");
  }

  const isVerify = mode === "verify";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="space-y-4 pb-0">
          {/* Brand */}
          <div className="flex items-center justify-center gap-2">
            <span className="text-xl font-bold tracking-tight">SierraLogic</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              AI
            </span>
          </div>

          {/* Mode toggle — hidden during email verification */}
          {!isVerify && (
            <div className="flex rounded-lg border border-border bg-muted/40 p-1">
              {(["Sign in", "Create account"] as const).map((label, i) => {
                const active = mode === (i === 0 ? "login" : "register");
                return (
                  <button
                    key={label}
                    onClick={() => setMode(i === 0 ? "login" : "register")}
                    className={cn(
                      "flex-1 rounded-md py-1.5 text-sm font-medium transition-all",
                      active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          {/* Animated form swap */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {mode === "login" && (
                <LoginForm
                  onSwitch={() => setMode("register")}
                  onNeedsVerify={enterVerify}
                />
              )}
              {mode === "register" && (
                <RegisterForm
                  onSwitch={() => setMode("login")}
                  onVerify={enterVerify}
                />
              )}
              {mode === "verify" && pendingCreds && (
                <VerifyForm
                  pending={pendingCreds}
                  onBack={() => { setMode("login"); setPendingCreds(null); }}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {/* OR divider + OAuth + Guest — hidden during verification */}
          {!isVerify && (
            <>
              <div className="relative">
                <Separator />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">OR</span>
              </div>

              <div className="space-y-2">
                <Button variant="outline" className="w-full gap-2" onClick={() => signIn("google", { callbackUrl: "/" })}>
                  <GoogleIcon />Continue with Google
                </Button>
                <Button variant="outline" className="w-full gap-2" onClick={() => signIn("apple", { callbackUrl: "/" })}>
                  <AppleIcon />Continue with Apple
                </Button>
              </div>

              <Separator />

              <Button variant="ghost" className="w-full text-muted-foreground hover:text-foreground" onClick={handleGuest}>
                Continue without account
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                By continuing, you agree to our{" "}
                <span className="cursor-pointer underline underline-offset-2">Terms of Service</span>.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
