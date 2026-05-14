"use client";

import {
  Suspense, useState, useEffect, useRef, useCallback,
  type ChangeEvent,
} from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  User2, Sliders, Shield, BarChart2,
  Camera, ArrowLeft, Loader2, CheckCircle2,
  Sun, Moon, Monitor, AlertTriangle, Trash2,
  ShieldCheck, ShieldOff, QrCode, KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PricingModal } from "@/components/PricingModal";

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { id: "profile",     label: "Profile",           icon: User2 },
  { id: "preferences", label: "Preferences",       icon: Sliders },
  { id: "security",    label: "Account Security",  icon: Shield },
  { id: "ai-usage",    label: "AI Usage",          icon: BarChart2 },
] as const;

type TabId = (typeof TABS)[number]["id"];

const MAX_FILE_BYTES = 512 * 1024;

const AVATAR_COLORS = [
  "bg-indigo-500", "bg-violet-500", "bg-rose-500",
  "bg-amber-500", "bg-emerald-500", "bg-cyan-500",
];

const PROVIDER_LABELS: Record<string, string> = {
  google:      "Google",
  github:      "GitHub",
  apple:       "Apple",
  email:       "Email (Magic Link)",
  credentials: "Email & Password",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function avatarBg(seed?: string | null) {
  return AVATAR_COLORS[(seed?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
}

function getInitials(name?: string | null, email?: string | null) {
  const src = name?.trim() ?? email ?? "U";
  const parts = src.split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : src[0].toUpperCase();
}

// ─── Avatar upload ────────────────────────────────────────────────────────────

function AvatarUpload({
  preview,
  seed,
  initials,
  onChange,
}: {
  preview: string | null;
  seed?: string | null;
  initials: string;
  onChange: (base64: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      toast.error("Image too large — max 512 KB.");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => onChange(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <div
          className={cn(
            "flex h-20 w-20 items-center justify-center overflow-hidden rounded-full text-2xl font-bold text-white",
            !preview && avatarBg(seed),
          )}
        >
          {preview
            ? <img src={preview} alt="Avatar" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
            : initials}
        </div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-card shadow-sm transition-colors hover:bg-accent"
        >
          <Camera className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
      <p className="text-xs text-muted-foreground">JPG, PNG, WebP · max 512 KB</p>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFile} />
    </div>
  );
}

// ─── Zod schema ───────────────────────────────────────────────────────────────

const profileSchema = z.object({
  name:     z.string().min(1, "Name is required").max(60, "Max 60 characters"),
  jobTitle: z.string().max(80, "Max 80 characters").optional().or(z.literal("")),
  company:  z.string().max(80, "Max 80 characters").optional().or(z.literal("")),
});
type ProfileForm = z.infer<typeof profileSchema>;

// ─── TAB: Profile ─────────────────────────────────────────────────────────────

function ProfileTab({ session, update }: { session: ReturnType<typeof useSession>["data"]; update: ReturnType<typeof useSession>["update"] }) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64]   = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: "", jobTitle: "", company: "" },
  });

  // Populate from server info (includes jobTitle / company)
  const [serverData, setServerData] = useState<{ jobTitle?: string | null; company?: string | null } | null>(null);

  useEffect(() => {
    if (!session?.user) return;
    setImagePreview(session.user.image ?? null);
    // Fetch extended profile
    fetch("/api/user/info")
      .then((r) => r.json())
      .then((d) => {
        const u = d?.data?.user;
        setServerData(u);
        reset({
          name:     session.user?.name ?? "",
          jobTitle: u?.jobTitle ?? "",
          company:  u?.company  ?? "",
        });
      });
  }, [session, reset]);

  const hasChanges = isDirty || imageBase64 !== null;

  async function onSubmit(values: ProfileForm) {
    setSaving(true);
    try {
      const res = await fetch("/api/user/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:     values.name,
          jobTitle: values.jobTitle ?? null,
          company:  values.company  ?? null,
          ...(imageBase64 !== null ? { image: imageBase64 } : {}),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      await update({ name: values.name, ...(imageBase64 !== null ? { image: imageBase64 } : {}) });
      setImageBase64(null);
      reset(values);
      toast.success("Profile saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  const initials = getInitials(session?.user?.name, session?.user?.email);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <AvatarUpload
        preview={imagePreview}
        seed={session?.user?.name ?? session?.user?.email}
        initials={initials}
        onChange={(b64) => { setImagePreview(b64); setImageBase64(b64); }}
      />

      <Separator />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <label className="text-sm font-medium">Display Name <span className="text-destructive">*</span></label>
          <Input placeholder="Your name" {...register("name")} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Job Title</label>
          <Input placeholder="e.g. Product Manager" {...register("jobTitle")} />
          {errors.jobTitle && <p className="text-xs text-destructive">{errors.jobTitle.message}</p>}
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Company</label>
          <Input placeholder="e.g. Acme Corp" {...register("company")} />
          {errors.company && <p className="text-xs text-destructive">{errors.company.message}</p>}
        </div>
        {session?.user?.email && (
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-sm font-medium">Email</label>
            <Input value={session.user.email} disabled className="text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
          </div>
        )}
      </div>

      <Button type="submit" disabled={saving || !hasChanges} className="w-full sm:w-auto">
        {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : "Save changes"}
      </Button>
      {!hasChanges && (
        <p className="text-xs text-muted-foreground inline-flex items-center gap-1 ml-3">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />Up to date
        </p>
      )}
    </form>
  );
}

// ─── TAB: Preferences ─────────────────────────────────────────────────────────

const LANGUAGES = [
  { value: "en", label: "🇬🇧 English" },
  { value: "uk", label: "🇺🇦 Ukrainian" },
  { value: "de", label: "🇩🇪 German" },
  { value: "fr", label: "🇫🇷 French" },
  { value: "pl", label: "🇵🇱 Polish" },
];

const DEPTH_OPTIONS = [
  { value: "standard", label: "Standard Analysis", desc: "Fast, uses gpt-4o-mini · great for most sites." },
  { value: "deep",     label: "Deep Content Audit", desc: "Thorough analysis · more detailed summary & keywords." },
];

function PreferencesTab() {
  const { theme, setTheme } = useTheme();
  const [lang,  setLang]  = useState("en");
  const [depth, setDepth] = useState("standard");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLang(localStorage.getItem("sierralogic-lang")   ?? "en");
    setDepth(localStorage.getItem("sierralogic-depth") ?? "standard");
  }, []);

  function save() {
    localStorage.setItem("sierralogic-lang",  lang);
    localStorage.setItem("sierralogic-depth", depth);
    setSaved(true);
    toast.success("Preferences saved.");
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-6">
      {/* Theme */}
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium">UI Theme</p>
          <p className="text-xs text-muted-foreground">Choose how SierraLogic looks on your device.</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {(["light", "dark", "system"] as const).map((t) => {
            const Icon = t === "light" ? Sun : t === "dark" ? Moon : Monitor;
            return (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors hover:bg-accent",
                  theme === t ? "border-primary bg-accent" : "border-border",
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs font-medium capitalize">{t}</span>
              </button>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* Language */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Application Language</label>
        <p className="text-xs text-muted-foreground">Controls the UI language and the language AI returns results in.</p>
        <Select value={lang} onValueChange={(v) => v && setLang(v)}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((l) => (
              <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Analysis depth */}
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium">Default Analysis Depth</p>
          <p className="text-xs text-muted-foreground">Applied to every new analysis you run.</p>
        </div>
        <div className="space-y-2">
          {DEPTH_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDepth(opt.value)}
              className={cn(
                "flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-accent",
                depth === opt.value ? "border-primary bg-accent" : "border-border",
              )}
            >
              <div className={cn(
                "mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 transition-colors",
                depth === opt.value ? "border-primary bg-primary" : "border-muted-foreground",
              )} />
              <div>
                <p className="text-sm font-medium">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <Button onClick={save} className="w-full sm:w-auto">
        {saved ? <><CheckCircle2 className="mr-2 h-4 w-4" />Saved</> : "Save preferences"}
      </Button>
    </div>
  );
}

// ─── TAB: Account Security ────────────────────────────────────────────────────

function DeleteModal({ onClose, onConfirm, loading }: { onClose: () => void; onConfirm: () => void; loading: boolean }) {
  const [input, setInput] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h3 className="font-semibold">Delete account</h3>
            <p className="text-xs text-muted-foreground">This action cannot be undone.</p>
          </div>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          All your analyses, profile data, and settings will be permanently erased.
          Type <span className="font-mono font-bold text-foreground">DELETE</span> to confirm.
        </p>
        <Input
          placeholder="Type DELETE"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="mb-4"
        />
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            disabled={input !== "DELETE" || loading}
            onClick={onConfirm}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete my account"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── 2FA setup wizard ─────────────────────────────────────────────────────────

type TwoFAStep = "idle" | "scan" | "verify" | "disable";

function TwoFASection({ enabled: initialEnabled }: { enabled: boolean }) {
  const [enabled, setEnabled]   = useState(initialEnabled);
  const [step, setStep]         = useState<TwoFAStep>("idle");
  const [secret, setSecret]     = useState("");
  const [qrCode, setQrCode]     = useState("");
  const [code, setCode]         = useState("");
  const [loading, setLoading]   = useState(false);

  async function startSetup() {
    setLoading(true);
    try {
      const res  = await fetch("/api/auth/2fa/generate");
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setSecret(data.data.secret);
      setQrCode(data.data.qrCode);
      setCode("");
      setStep("scan");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not generate QR code.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyAndEnable() {
    if (code.length < 6) return;
    setLoading(true);
    try {
      const res  = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret, token: code }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setEnabled(true);
      setStep("idle");
      toast.success("Two-factor authentication enabled!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid code.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyAndDisable() {
    if (code.length < 6) return;
    setLoading(true);
    try {
      const res  = await fetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: code }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setEnabled(false);
      setStep("idle");
      toast.success("Two-factor authentication disabled.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid code.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Status row */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Two-factor authentication</p>
          <p className="text-xs text-muted-foreground">Add an extra layer of security to your account.</p>
        </div>
        <Badge
          variant={enabled ? "default" : "secondary"}
          className={cn("shrink-0", enabled && "bg-emerald-500 text-white hover:bg-emerald-500")}
        >
          {enabled ? "Enabled" : "Disabled"}
        </Badge>
      </div>

      {/* Idle state — action buttons */}
      {step === "idle" && !enabled && (
        <Button size="sm" variant="outline" onClick={startSetup} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
          Enable 2FA
        </Button>
      )}
      {step === "idle" && enabled && (
        <Button size="sm" variant="outline" onClick={() => { setCode(""); setStep("disable"); }}>
          <ShieldOff className="mr-2 h-4 w-4" />
          Disable 2FA
        </Button>
      )}

      {/* Scan QR step */}
      {step === "scan" && (
        <div className="space-y-4 rounded-lg border border-border p-4">
          <div className="flex items-start gap-3">
            <QrCode className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="text-sm">
              <p className="font-medium">Scan with your authenticator app</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Use Google Authenticator, Authy, or any TOTP-compatible app.
              </p>
            </div>
          </div>

          {qrCode && (
            <div className="flex justify-center">
              <img src={qrCode} alt="2FA QR Code" className="h-44 w-44 rounded-lg border border-border" />
            </div>
          )}

          <div className="rounded-md bg-muted/50 p-3">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Manual entry key</p>
            <code className="break-all text-xs font-mono select-all">{secret}</code>
          </div>

          <Button size="sm" className="w-full" onClick={() => { setCode(""); setStep("verify"); }}>
            I've scanned it — enter code →
          </Button>
          <button
            type="button"
            onClick={() => setStep("idle")}
            className="w-full text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Verify / Disable step */}
      {(step === "verify" || step === "disable") && (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            {step === "verify" ? "Enter the 6-digit code from your app" : "Enter your current 2FA code to confirm"}
          </div>
          <Input
            placeholder="000000"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="text-center text-xl tracking-[0.5em] font-mono"
            autoFocus
          />
          <Button
            size="sm"
            className="w-full"
            disabled={code.length < 6 || loading}
            onClick={step === "verify" ? verifyAndEnable : verifyAndDisable}
            variant={step === "disable" ? "destructive" : "default"}
          >
            {loading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : step === "verify" ? "Verify & enable" : "Verify & disable"}
          </Button>
          {step === "verify" && (
            <button
              type="button"
              onClick={() => setStep("scan")}
              className="w-full text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              ← Back to QR code
            </button>
          )}
          {step === "disable" && (
            <button
              type="button"
              onClick={() => setStep("idle")}
              className="w-full text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── TAB: Account Security ────────────────────────────────────────────────────

function SecurityTab({ session }: { session: ReturnType<typeof useSession>["data"] }) {
  const router = useRouter();
  const [providers,    setProviders]    = useState<string[]>([]);
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [showDelete,   setShowDelete]   = useState(false);
  const [deleting,     setDeleting]     = useState(false);

  useEffect(() => {
    fetch("/api/user/info")
      .then((r) => r.json())
      .then((d) => {
        setProviders(d?.data?.providers ?? []);
        setTwoFAEnabled(d?.data?.user?.isTwoFactorEnabled ?? false);
      });
  }, []);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch("/api/user/account", { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      await signOut({ callbackUrl: "/login" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete account.");
      setDeleting(false);
      setShowDelete(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Email */}
      <div className="space-y-1.5">
        <p className="text-sm font-medium">Email address</p>
        <Input value={session?.user?.email ?? "—"} disabled className="text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Your login email. Cannot be changed.</p>
      </div>

      <Separator />

      {/* Connected providers */}
      <div className="space-y-3">
        <p className="text-sm font-medium">Connected authentication methods</p>
        {providers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-2">
            {providers.map((p) => (
              <div key={p} className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span className="text-sm font-medium">{PROVIDER_LABELS[p] ?? p}</span>
                <Badge variant="secondary" className="ml-auto text-xs">Active</Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* 2FA */}
      <TwoFASection enabled={twoFAEnabled} />

      <Separator />

      {/* Danger zone */}
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
        <p className="mb-1 text-sm font-semibold text-destructive">Danger Zone</p>
        <p className="mb-4 text-xs text-muted-foreground">
          Permanently delete your account and all associated data. This cannot be reversed.
        </p>
        <Button variant="destructive" size="sm" onClick={() => setShowDelete(true)}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete account
        </Button>
      </div>

      {showDelete && (
        <DeleteModal
          onClose={() => setShowDelete(false)}
          onConfirm={handleDelete}
          loading={deleting}
        />
      )}
    </div>
  );
}

// ─── TAB: AI Usage ────────────────────────────────────────────────────────────

function UsageBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min((value / max) * 100, 100);
  const color = pct >= 90 ? "bg-rose-500" : pct >= 70 ? "bg-amber-500" : "bg-indigo-500";
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn("h-full rounded-full transition-all duration-700", color)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

interface UsageStats {
  usageThisMonth: number;
  totalAnalyses:  number;
  monthlyLimit:   number | null; // null = unlimited (MAX)
  plan:           string;
  planName:       string;
}

function AIUsageTab() {
  const searchParams  = useSearchParams();
  const [stats, setStats]       = useState<UsageStats | null>(null);
  const [loading, setLoading]   = useState(true);
  const [showPricing, setShowPricing] = useState(false);

  useEffect(() => {
    fetch("/api/user/info")
      .then((r) => r.json())
      .then((d) => setStats(d?.data ?? null))
      .finally(() => setLoading(false));
  }, []);

  // Toast for Stripe redirect outcomes
  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast.success("Subscription activated! Your plan has been upgraded.");
    } else if (searchParams.get("canceled") === "true") {
      toast.info("Checkout was cancelled. No changes were made.");
    }
  }, [searchParams]);

  const plan      = stats?.plan     ?? "FREE";
  const planName  = stats?.planName ?? "Free";
  const limit     = stats?.monthlyLimit ?? 50;  // null only when MAX
  const isMax     = limit === null;
  const used      = stats?.usageThisMonth ?? 0;
  const total     = stats?.totalAnalyses  ?? 0;
  const remaining = isMax ? null : Math.max(limit - used, 0);

  return (
    <>
      <div className="space-y-4">
        {/* Monthly usage card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Monthly usage</CardTitle>
            <CardDescription>Resets on the 1st of each month.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="space-y-3">
                <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
                <div className="h-2.5 w-full animate-pulse rounded-full bg-muted" />
              </div>
            ) : isMax ? (
              /* MAX plan — unlimited display */
              <div className="flex items-center gap-4">
                <span className="text-5xl font-extrabold text-indigo-500">∞</span>
                <div>
                  <p className="text-sm font-medium">Unlimited analyses</p>
                  <p className="text-xs text-muted-foreground">{used} used this month</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-end justify-between">
                  <div>
                    <span className="text-3xl font-bold">{used}</span>
                    <span className="text-sm text-muted-foreground"> / {limit} analyses</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{remaining} remaining</span>
                </div>
                <UsageBar value={used} max={limit} />
                <p className="text-xs text-muted-foreground">
                  {used >= limit
                    ? "Monthly limit reached. Upgrade for more analyses."
                    : `${Math.round((used / limit) * 100)}% of monthly allowance used.`}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="pt-5">
              <p className="text-2xl font-bold">{loading ? "—" : total}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Total analyses</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-1.5">
                <p className="text-2xl font-bold">{loading ? "—" : planName}</p>
                {plan === "PRO" && (
                  <Badge className="bg-indigo-600 text-white text-xs hover:bg-indigo-600">Pro</Badge>
                )}
                {plan === "MAX" && (
                  <Badge className="bg-violet-600 text-white text-xs hover:bg-violet-600">Max</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Current plan</p>
            </CardContent>
          </Card>
        </div>

        {/* Upgrade / manage card — hidden on MAX */}
        {plan !== "MAX" && !loading && (
          <Card className="border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20">
            <CardContent className="pt-5">
              {plan === "PRO" ? (
                <>
                  <p className="text-sm font-semibold">You're on Pro</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Upgrade to Max for unlimited analyses and priority support.
                  </p>
                  <Button size="sm" className="mt-3 bg-violet-600 hover:bg-violet-700 text-white" onClick={() => setShowPricing(true)}>
                    Upgrade to Max
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold">Need more analyses?</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Pro plan includes 500 analyses/month, priority processing, and more.
                  </p>
                  <Button size="sm" className="mt-3 bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setShowPricing(true)}>
                    Upgrade to Pro
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <PricingModal
        open={showPricing}
        onClose={() => setShowPricing(false)}
        currentPlan={plan}
      />
    </>
  );
}

// ─── Main settings layout ─────────────────────────────────────────────────────

function SettingsContent() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get("tab") as TabId | null) ?? "profile";

  function setTab(id: TabId) {
    const p = new URLSearchParams(searchParams.toString());
    p.set("tab", id);
    router.replace(`/settings?${p.toString()}`, { scroll: false });
  }

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Top bar */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4">
          <Link href="/" className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium">Settings</span>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-col gap-6 md:flex-row">

          {/* ── Desktop sidebar nav ─────────────── */}
          <nav className="hidden md:flex md:w-52 md:shrink-0 md:flex-col md:gap-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left",
                  activeTab === id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            ))}
          </nav>

          {/* ── Mobile horizontal tabs ──────────── */}
          <div className="flex overflow-x-auto gap-1 pb-1 md:hidden">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap",
                  activeTab === id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          {/* ── Tab panel ───────────────────────── */}
          <div className="flex-1 min-w-0">
            <Card>
              <CardHeader>
                {(() => {
                  const tab = TABS.find((t) => t.id === activeTab)!;
                  return (
                    <>
                      <CardTitle className="flex items-center gap-2">
                        <tab.icon className="h-5 w-5 text-muted-foreground" />
                        {tab.label}
                      </CardTitle>
                      <CardDescription>
                        {activeTab === "profile"     && "Manage your public profile information."}
                        {activeTab === "preferences" && "Customise your SierraLogic experience."}
                        {activeTab === "security"    && "Review your login methods and account safety."}
                        {activeTab === "ai-usage"    && "Track your analysis usage and plan limits."}
                      </CardDescription>
                    </>
                  );
                })()}
              </CardHeader>
              <Separator />
              <CardContent className="pt-6">
                {activeTab === "profile"     && <ProfileTab session={session} update={update} />}
                {activeTab === "preferences" && <PreferencesTab />}
                {activeTab === "security"    && <SecurityTab session={session} />}
                {activeTab === "ai-usage"    && <AIUsageTab />}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    }>
      <SettingsContent />
    </Suspense>
  );
}
