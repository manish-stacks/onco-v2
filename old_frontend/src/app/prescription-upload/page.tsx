"use client";

import { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, FileText, CheckCircle2, X, ShieldCheck, Clock, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";

const GUIDELINES = [
  "Prescription must be issued by a registered medical practitioner.",
  "Ensure the doctor's name, registration number and date are clearly visible.",
  "Upload JPG, PNG or PDF files, up to 10MB each.",
  "Prescriptions older than 6 months may not be accepted for certain medicines.",
];

type FakeFile = { name: string; size: string };

export default function PrescriptionUploadPage() {
  const [files, setFiles] = useState<FakeFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "uploading" | "success">("idle");

  const handleFiles = useCallback((list: FileList | null) => {
    if (!list || list.length === 0) return;
    const next = Array.from(list).map((f) => ({
      name: f.name,
      size: `${(f.size / 1024).toFixed(0)} KB`,
    }));
    setFiles((prev) => [...prev, ...next]);
  }, []);

  function submit() {
    if (files.length === 0) return;
    setStatus("uploading");
    setTimeout(() => setStatus("success"), 1600);
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
            <p className="mb-6 max-w-sm text-sm text-[var(--ink-soft)]">
              We&apos;ve received {files.length} file{files.length > 1 ? "s" : ""}. Our pharmacist team will verify it within 30 minutes and notify you.
            </p>
            <Button href="/category/health-essentials">Continue Shopping</Button>
          </motion.div>
        ) : (
          <motion.div key="form" exit={{ opacity: 0 }}>
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
                      <p className="text-xs text-[var(--ink-soft)]">{f.size}</p>
                    </div>
                    <button onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}>
                      <X size={16} className="text-[var(--ink-soft)]" />
                    </button>
                  </div>
                ))}
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
