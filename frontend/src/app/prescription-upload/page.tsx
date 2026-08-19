"use client";

import { Suspense, useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, FileText, CheckCircle2, X, ShieldCheck, Clock, Stethoscope, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { prescriptionApi, ApiError } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import type { Prescription } from "@/types";

const GUIDELINES = [
  "Prescription must be issued by a registered medical practitioner.",
  "Ensure the doctor's name, registration number and date are clearly visible.",
  "Upload JPG, PNG or PDF files, up to 10MB each.",
  "Prescriptions older than 6 months may not be accepted for certain medicines.",
];

function PrescriptionUploadInner() {
  const { isLoggedIn } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  // Checkout se aaya ho to yahan "/checkout" hota hai — upload ke baad
  // wapas usi page pe, naye prescription_id ke saath bhej dete hain.
  const redirectTo = params.get("redirect");

  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [patientName, setPatientName] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [result, setResult] = useState<Prescription | null>(null);

  const handleFiles = useCallback((list: FileList | null) => {
    if (!list || list.length === 0) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
  }, []);

  async function submit() {
    if (files.length === 0) return;
    setStatus("uploading");
    setErrorMsg(null);
    try {
      const data = await prescriptionApi.upload<Prescription>(files, {
        patient_name: patientName || undefined,
        doctor_name: doctorName || undefined,
      });
      setResult(data);
      setStatus("success");
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Could not upload prescription");
      setStatus("error");
    }
  }

  function continueToRedirect() {
    if (!redirectTo || !result?.prescription_id) return;
    const separator = redirectTo.includes("?") ? "&" : "?";
    router.push(`${redirectTo}${separator}prescription_id=${result.prescription_id}`);
  }

  if (!isLoggedIn) {
    const loginRedirect = redirectTo
      ? `/login?redirect=${encodeURIComponent(`/prescription-upload?redirect=${redirectTo}`)}`
      : "/login?redirect=/prescription-upload";
    return (
      <div className="mx-auto flex max-w-4xl flex-col items-center px-4 py-24 text-center sm:px-6">
        <span className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--blue-50)] text-[var(--blue-500)]">
          <Stethoscope size={32} />
        </span>
        <h1 className="mb-2 font-display text-2xl font-bold text-[var(--ink)]">Login to upload a prescription</h1>
        <p className="mb-6 max-w-sm text-[var(--ink-soft)]">We keep your prescriptions linked to your account so our pharmacists can verify them.</p>
        <Button href={loginRedirect} icon={<ArrowRight size={16} />}>Login</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="mb-10 text-center">
        <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--blue-50)] text-[var(--blue-500)]">
          <Stethoscope size={26} />
        </span>
        <h1 className="font-display text-3xl font-bold text-[var(--ink)]">Upload Your Prescription</h1>
        <p className="mx-auto mt-2 max-w-md text-[var(--ink-soft)]">
          Our licensed pharmacists will verify your prescription before we ship any restricted medicines.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {status === "success" ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center rounded-[var(--radius-lg)] border border-[var(--line)] bg-white px-6 py-16 text-center"
          >
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.1 }}
              className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--mint-50)] text-[var(--mint-500)]"
            >
              <CheckCircle2 size={32} />
            </motion.span>
            <h2 className="mb-2 font-display text-xl font-bold text-[var(--ink)]">Prescription Uploaded!</h2>
            <p className="mb-2 max-w-sm text-sm text-[var(--ink-soft)]">
              We&apos;ve received {files.length} file{files.length > 1 ? "s" : ""}. Our pharmacist team will verify it and notify you.
            </p>
            {result?.reference_code && (
              <p className="mb-6 text-xs font-mono-nums text-[var(--ink-soft)]">Reference: {result.reference_code}</p>
            )}

            {redirectTo ? (
              <div className="flex flex-col items-center gap-3">
                <Button size="lg" onClick={continueToRedirect} icon={<ArrowRight size={16} />}>
                  Continue to Checkout
                </Button>
                <p className="max-w-xs text-xs text-[var(--ink-soft)]">
                  Ye prescription pharmacist verify karega — verification hone tak bhi is order ko place kiya ja sakta
                  hai, status &quot;Prescription Pending&quot; rahega jab tak approve na ho.
                </p>
              </div>
            ) : (
              <div className="flex gap-3">
                <Button href="/account?tab=prescriptions" variant="outline">View My Prescriptions</Button>
                <Button href="/shop">Continue Shopping</Button>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key="form" exit={{ opacity: 0 }}>
            {redirectTo && (
              <div className="mb-4 rounded-[var(--radius-sm)] border border-[var(--blue-50)] bg-[var(--blue-50)]/40 px-4 py-3 text-sm text-[var(--blue-600)]">
                Upload karne ke baad hum aapko seedha checkout par wapas le jaayenge.
              </div>
            )}
            {errorMsg && (
              <div className="mb-4 rounded-[var(--radius-sm)] border border-[#FCC7BE] bg-[#FFF1EE] px-4 py-3 text-sm text-[var(--coral-500)]">
                {errorMsg}
              </div>
            )}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                handleFiles(e.dataTransfer.files);
              }}
              className={`relative flex flex-col items-center rounded-[var(--radius-lg)] border-2 border-dashed px-6 py-16 text-center transition-colors ${
                dragging ? "border-[var(--blue-500)] bg-[var(--blue-50)]" : "border-[var(--line)] bg-white"
              }`}
            >
              <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--blue-50)] text-[var(--blue-500)]">
                <UploadCloud size={28} />
              </span>
              <p className="mb-1 font-semibold text-[var(--ink)]">Drag & drop your prescription here</p>
              <p className="mb-5 text-sm text-[var(--ink-soft)]">or click below to browse files</p>
              <label className="cursor-pointer rounded-full bg-[var(--blue-500)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--blue-600)]">
                Choose Files
                <input type="file" multiple accept="image/*,.pdf" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
              </label>
              <p className="mt-5 text-xs text-[var(--ink-soft)]">Supported: JPG, PNG, PDF — up to 10MB each</p>
            </div>

            {files.length > 0 && (
              <div className="mt-6 space-y-3">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--line)] bg-white p-3">
                    <FileText size={18} className="text-[var(--blue-500)]" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[var(--ink)]">{f.name}</p>
                      <p className="text-xs text-[var(--ink-soft)]">{(f.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <button onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}>
                      <X size={16} className="text-[var(--ink-soft)]" />
                    </button>
                  </div>
                ))}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    placeholder="Patient name (optional)"
                    className="h-11 rounded-[var(--radius-sm)] border border-[var(--line)] px-4 text-sm outline-none"
                  />
                  <input
                    value={doctorName}
                    onChange={(e) => setDoctorName(e.target.value)}
                    placeholder="Doctor name (optional)"
                    className="h-11 rounded-[var(--radius-sm)] border border-[var(--line)] px-4 text-sm outline-none"
                  />
                </div>

                <Button
                  size="lg"
                  className="w-full"
                  disabled={status === "uploading"}
                  onClick={submit}
                  icon={status === "uploading" ? <Clock size={16} className="animate-spin" /> : undefined}
                >
                  {status === "uploading" ? "Uploading..." : "Submit Prescription"}
                </Button>
              </div>
            )}

            <div className="mt-10 rounded-[var(--radius-md)] border border-[var(--line)] bg-white p-6">
              <p className="mb-4 flex items-center gap-2 font-semibold text-[var(--ink)]">
                <ShieldCheck size={17} className="text-[var(--mint-500)]" /> Prescription Guidelines
              </p>
              <ul className="space-y-2 text-sm text-[var(--ink-soft)]">
                {GUIDELINES.map((g) => (
                  <li key={g} className="flex gap-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--ink-soft)]" />
                    {g}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function PrescriptionUploadPage() {
  return (
    <Suspense>
      <PrescriptionUploadInner />
    </Suspense>
  );
}