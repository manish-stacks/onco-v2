"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { User, Phone, Mail, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InlineToast, type InlineToastState } from "@/components/ui/inline-toast";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";
  const { register } = useAuth();

  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<InlineToastState | null>(null);

  function notify(message: string, tone: "success" | "error" = "error") {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !mobile.trim() || !password) return notify("Fill in name, mobile and password");
    if (password.length < 6) return notify("Password should be at least 6 characters");
    if (password !== confirmPassword) return notify("Passwords do not match");

    setLoading(true);
    try {
      await register({
        mobile: mobile.trim(),
        password,
        customer_name: name.trim(),
        ...(email.trim() ? { email: email.trim() } : {}),
      });
      notify("Account created", "success");
      router.push(redirectTo);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not create account");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16 sm:px-6">
      <h1 className="mb-2 font-display text-2xl font-bold text-[var(--ink)]">Create your account</h1>
      <p className="mb-8 text-sm text-[var(--ink-soft)]">Sign up to shop, save a wishlist and track orders.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field icon={<User size={16} />} label="Full name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Aditi Sharma"
            className="w-full bg-transparent text-sm outline-none"
          />
        </Field>
        <Field icon={<Phone size={16} />} label="Mobile number">
          <input
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder="9876543210"
            className="w-full bg-transparent text-sm outline-none"
          />
        </Field>
        <Field icon={<Mail size={16} />} label="Email (optional)">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full bg-transparent text-sm outline-none"
          />
        </Field>
        <Field icon={<Lock size={16} />} label="Password">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full bg-transparent text-sm outline-none"
          />
        </Field>
        <Field icon={<Lock size={16} />} label="Confirm password">
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full bg-transparent text-sm outline-none"
          />
        </Field>

        <Button type="submit" size="lg" className="w-full" disabled={loading} icon={loading ? <Loader2 size={16} className="animate-spin" /> : undefined}>
          Create Account
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-[var(--ink-soft)]">
        Already have an account?{" "}
        <Link href={`/login?redirect=${encodeURIComponent(redirectTo)}`} className="font-semibold text-[var(--blue-600)]">
          Log in
        </Link>
      </p>

      <InlineToast toast={toast} />
    </div>
  );
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-[var(--ink-soft)]">{label}</span>
      <div className="flex h-12 items-center gap-2 rounded-full border border-[var(--line)] px-4">
        <span className="text-[var(--ink-soft)]">{icon}</span>
        {children}
      </div>
    </label>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
