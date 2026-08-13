"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User, Phone, Lock, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { ApiError } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register({ mobile, password, customer_name: name });
      router.push("/account");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create account");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16 sm:px-6">
      <h1 className="mb-1 font-display text-2xl font-bold text-[var(--ink)]">Create your account</h1>
      <p className="mb-8 text-sm text-[var(--ink-soft)]">Sign up to order medicines, track deliveries and save your prescriptions.</p>

      {error && (
        <div className="mb-4 rounded-[var(--radius-sm)] border border-[#FCC7BE] bg-[#FFF1EE] px-4 py-3 text-sm text-[var(--coral-500)]">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Full name</span>
          <div className="flex h-12 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--line)] px-4">
            <User size={16} className="text-[var(--ink-soft)]" />
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="w-full bg-transparent text-sm outline-none" />
          </div>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Mobile number</span>
          <div className="flex h-12 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--line)] px-4">
            <Phone size={16} className="text-[var(--ink-soft)]" />
            <input required type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="10-digit mobile number" className="w-full bg-transparent text-sm outline-none" />
          </div>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Password</span>
          <div className="flex h-12 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--line)] px-4">
            <Lock size={16} className="text-[var(--ink-soft)]" />
            <input required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" className="w-full bg-transparent text-sm outline-none" />
          </div>
        </label>
        <Button type="submit" size="lg" className="w-full" disabled={loading} icon={loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}>
          {loading ? "Creating account…" : "Create Account"}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-[var(--ink-soft)]">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-[var(--blue-600)]">Login</Link>
      </p>
    </div>
  );
}
