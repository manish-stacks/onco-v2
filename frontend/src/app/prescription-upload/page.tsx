"use client";

import { Suspense, useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { UploadCloud, FileText, X, ShieldCheck, Clock, Stethoscope, ArrowRight, AlertCircle } from "lucide-react";
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
  // If they came from checkout this is "/checkout" — after the upload
  // we send them back to the same page with the new prescription_id.
  const redirectTo = params.get("redirect");

  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [patientName, setPatientName] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [hospitalName, setHospitalName] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ files?: string; patient_name?: string; doctor_name?: string; hospital_name?: string }>({});
  const [result, setResult] = useState<Prescription | null>(null);

  const handleFiles = useCallback((list: FileList | null) => {
    if (!list || list.length === 0) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
  }, []);

  async function submit() {
    // Patient, doctor and hospital are mandatory for a prescription order.
    const errs: typeof fieldErrors = {};
    if (files.length === 0) errs.files = "Please choose at least one file";
    if (!patientName.trim()) errs.patient_name = "Patient name is required";
    if (!doctorName.trim()) errs.doctor_name = "Doctor name is required";
    if (!hospitalName.trim()) errs.hospital_name = "Hospital / clinic name is required";
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setStatus("uploading");
    setErrorMsg(null);
    try {
      const data = await prescriptionApi.upload<Prescription>(files, {
        patient_name: patientName.trim(),
        doctor_name: doctorName.trim(),
        hospital_name: hospitalName.trim(),
      });
      setResult(data);
      const qs = new URLSearchParams({ count: String(files.length) });
      if (data.reference_code) qs.set("ref", data.reference_code);
      if (data.prescription_id) qs.set("pid", String(data.prescription_id));
      if (redirectTo) qs.set("redirect", redirectTo);
      router.push(`/prescription-upload/success?${qs.toString()}`);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Could not upload prescription");
      setStatus("error");
    }
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
    <div
      className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8"
    >
      <div className="mb-10 text-center">

        <h1 className="font-display text-3xl font-bold text-[var(--ink)]">Upload Your Prescription</h1>
        <p className="mx-auto mt-2 max-w-md text-[var(--ink-soft)]">
          Our licensed pharmacists will verify your prescription before we ship any restricted medicines.
        </p>
      </div>

      <div>
        {redirectTo && (
          <div className="mb-4 rounded-[var(--radius-sm)] border border-[var(--blue-50)] bg-[var(--blue-50)]/40 px-4 py-3 text-sm text-[var(--blue-600)]">
            After uploading we will take you straight back to checkout.
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
          className={`relative flex flex-col items-center rounded-[var(--radius-lg)] border-2 border-dashed px-6 py-6 text-center transition-colors ${dragging ? "border-[var(--blue-500)] bg-[var(--blue-50)]" : "border-[var(--line)] bg-white"
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
          {fieldErrors.files && (
            <p className="mt-2 flex items-center justify-center gap-1 text-xs text-[var(--coral-500)]"><AlertCircle size={12} /> {fieldErrors.files}</p>
          )}
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
          </div>
        )}

        {!result && isLoggedIn && (
          <div className="mt-6 space-y-3">
            <p className="text-xs font-medium text-[var(--ink-soft)]">
              Patient, doctor and hospital details are mandatory for a prescription order.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--ink)]">Patient name</label>
                <input
                  value={patientName}
                  onChange={(e) => { setPatientName(e.target.value); setFieldErrors((s) => ({ ...s, patient_name: "" })); }}
                  placeholder="Patient name"
                  className={`h-11 w-full rounded-[var(--radius-sm)] border px-4 text-sm outline-none ${fieldErrors.patient_name ? "border-[var(--coral-500)]" : "border-[var(--line)]"}`}
                />
                {fieldErrors.patient_name && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-[var(--coral-500)]"><AlertCircle size={12} /> {fieldErrors.patient_name}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--ink)]">Doctor name</label>
                <input
                  value={doctorName}
                  onChange={(e) => { setDoctorName(e.target.value); setFieldErrors((s) => ({ ...s, doctor_name: "" })); }}
                  placeholder="Doctor name"
                  className={`h-11 w-full rounded-[var(--radius-sm)] border px-4 text-sm outline-none ${fieldErrors.doctor_name ? "border-[var(--coral-500)]" : "border-[var(--line)]"}`}
                />
                {fieldErrors.doctor_name && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-[var(--coral-500)]"><AlertCircle size={12} /> {fieldErrors.doctor_name}</p>
                )}
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-[var(--ink)]">Hospital / clinic name</label>
                <input
                  value={hospitalName}
                  onChange={(e) => { setHospitalName(e.target.value); setFieldErrors((s) => ({ ...s, hospital_name: "" })); }}
                  placeholder="Hospital / clinic name"
                  className={`h-11 w-full rounded-[var(--radius-sm)] border px-4 text-sm outline-none ${fieldErrors.hospital_name ? "border-[var(--coral-500)]" : "border-[var(--line)]"}`}
                />
                {fieldErrors.hospital_name && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-[var(--coral-500)]"><AlertCircle size={12} /> {fieldErrors.hospital_name}</p>
                )}
              </div>
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
      </div>
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