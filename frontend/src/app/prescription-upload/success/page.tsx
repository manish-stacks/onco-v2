"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

function PrescriptionSuccessInner() {
  const router = useRouter();
  const params = useSearchParams();

  const reference = params.get("ref");
  const prescriptionId = params.get("pid");
  const redirectTo = params.get("redirect");
  const count = Number(params.get("count") || 1);

  function continueToRedirect() {
    if (!redirectTo || !prescriptionId) return;
    const separator = redirectTo.includes("?") ? "&" : "?";
    router.push(`${redirectTo}${separator}prescription_id=${prescriptionId}`);
  }

  return (
    <div className="mx-auto flex min-h-[75vh] max-w-2xl flex-col items-center justify-center px-4 py-14 text-center sm:px-6">
      <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--mint-50)] text-[var(--mint-500)]">
        <CheckCircle2 size={32} />
      </span>
      <h1 className="mb-2 font-display text-2xl font-bold text-[var(--ink)]">Prescription Uploaded!</h1>
      <p className="mb-2 max-w-sm text-sm text-[var(--ink-soft)]">
        We&apos;ve received {count} file{count > 1 ? "s" : ""}. Our pharmacist team will verify it and notify you.
      </p>
      {reference && (
        <p className="mb-6 text-xs font-mono-nums text-[var(--ink-soft)]">Reference: {reference}</p>
      )}

      {redirectTo ? (
        <div className="flex flex-col items-center gap-3">
          <Button size="lg" onClick={continueToRedirect} icon={<ArrowRight size={16} />}>
            Continue to Checkout
          </Button>
          <p className="max-w-xs text-xs text-[var(--ink-soft)]">
            A pharmacist will verify this prescription — the order can be placed even before verification is complete,
            and the status will stay &quot;Prescription Pending&quot; until it is approved.
          </p>
        </div>
      ) : (
        <div className="flex gap-3">
          <Button href="/account?tab=prescriptions" variant="outline">View My Prescriptions</Button>
          <Button href="/shop">Continue Shopping</Button>
        </div>
      )}
    </div>
  );
}

export default function PrescriptionSuccessPage() {
  return (
    <Suspense>
      <PrescriptionSuccessInner />
    </Suspense>
  );
}
