"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Truck, Search, Loader2, MapPin, Copy, Check, PackageCheck, PackageOpen, Truck as TruckIcon, Box, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { orderApi, ApiError, type ShipmentTrackResult } from "@/lib/api";

const STAGES = [
  { key: "picked_up", label: "Picked Up", icon: PackageOpen },
  { key: "in_transit", label: "In Transit", icon: TruckIcon },
  { key: "out_for_delivery", label: "Out for Delivery", icon: Box },
  { key: "delivered", label: "Delivered", icon: PackageCheck },
] as const;

function stageIndex(stage: string | null) {
  const i = STAGES.findIndex((s) => s.key === stage);
  return i === -1 ? -1 : i;
}

export default function TrackShipmentPage() {
  return (
    <Suspense fallback={null}>
      <TrackShipmentInner />
    </Suspense>
  );
}

function TrackShipmentInner() {
  const searchParams = useSearchParams();
  const [awb, setAwb] = useState(searchParams.get("awb") || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ShipmentTrackResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [showAll, setShowAll] = useState(false);

  async function handleTrack(e?: React.FormEvent) {
    e?.preventDefault();
    if (!awb.trim()) { setError("Enter an AWB / consignment number."); return; }
    setError(null);
    setLoading(true);
    setResult(null);
    setShowAll(false);
    try {
      const data = await orderApi.trackShipment(awb.trim());
      if (!data) throw new ApiError("Not found", 404);
      setResult(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not fetch tracking right now.");
    } finally {
      setLoading(false);
    }
  }

  // Coming here from the admin panel's "Full tracking" button (?awb=...) —
  // track right away instead of making them press the button again.
  useEffect(() => {
    if (searchParams.get("awb")) handleTrack();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function copyAwb() {
    if (!result) return;
    navigator.clipboard.writeText(result.awb).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const currentIdx = result ? stageIndex(result.stage) : -1;
  const stepsDesc = result ? result.steps.slice().reverse() : [];
  const visibleSteps = showAll ? stepsDesc : stepsDesc.slice(0, 3);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-8">
      {!result && (
        <div className="text-center">
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-[var(--blue-50)]">
            <Truck size={28} className="text-[var(--blue-500)]" />
          </span>
          <h1 className="mt-3 font-display text-3xl font-bold text-[var(--ink)]">Track a shipment</h1>
          <p className="mt-1.5 text-base text-[var(--ink-soft)]">
            Enter the AWB / consignment number from your shipping label to see its live status.
          </p>
        </div>
      )}

      <form onSubmit={handleTrack} className="mt-6 flex flex-col gap-3 sm:flex-row">
        <input
          value={awb}
          onChange={(e) => setAwb(e.target.value)}
          placeholder="e.g. 7X118966375"
          className="h-14 flex-1 rounded-[var(--radius-sm)] border border-[var(--line)] px-5 text-base outline-none focus:border-[var(--blue-500)]"
        />
        <Button type="submit" size="lg" disabled={loading} className="shrink-0">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          Track
        </Button>
      </form>

      {error && (
        <p className="mt-4 rounded-[var(--radius-sm)] border border-[var(--coral-500)]/30 bg-[#FFEDEA] px-4 py-3 text-sm text-[var(--coral-500)]">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-8 overflow-hidden rounded-[var(--radius-md)] border border-[var(--line)]">
          {/* header */}
          <div className="flex items-start justify-between gap-3 p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#E4002B] text-white">
                <Truck size={20} />
              </span>
              <div>
                <p className="text-xs font-semibold text-[var(--ink-soft)]">DTDC</p>
                <button onClick={copyAwb} className="flex items-center gap-2 text-base text-[var(--ink)]">
                  AWB: <span className="font-semibold">{result.awb}</span>
                  {copied ? <Check size={13} className="text-[var(--mint-600)]" /> : <Copy size={13} className="text-[var(--ink-soft)]" />}
                </button>
              </div>
            </div>
            {result.ref_no && (
              <div className="text-right">
                <p className="text-xs text-[var(--ink-soft)]">Ref. No.</p>
                <p className="text-base font-semibold text-[var(--ink)]">{result.ref_no}</p>
              </div>
            )}
          </div>
          <div className="border-t border-[var(--line)] px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--blue-600)]">Estimated Delivery Date</p>
            <p className="mt-1 text-base text-[var(--ink-soft)]">
              {result.expected_delivery || "Will be updated once the shipment enters the DTDC network."}
            </p>
          </div>

          {/* status banner */}
          <div className="flex items-center gap-4 bg-gradient-to-r from-[var(--paper-sunk)] to-[#FFEDEA] px-6 py-8">
            <PackageOpen size={34} className="text-[var(--ink-soft)]" />
            <h2 className="text-2xl font-bold text-[var(--ink)]">{result.current_status}</h2>
          </div>

          {/* 4-stage progress */}
          <div className="px-5 pt-6">
            <div className="grid grid-cols-4 gap-1">
              {STAGES.map((s, i) => {
                const Icon = s.icon;
                const done = currentIdx >= 0 && i <= currentIdx;
                const isCurrent = i === currentIdx;
                return (
                  <div key={s.key} className="flex flex-col items-center text-center">
                    <div className="flex w-full items-center">
                      <span className={`h-1 flex-1 rounded ${i === 0 ? "opacity-0" : done ? "bg-[var(--blue-500)]" : "bg-[var(--line)]"}`} />
                    </div>
                    <span className={`-mt-3.5 flex h-9 w-9 items-center justify-center rounded-full border-2 bg-white text-sm
                      ${isCurrent ? "border-[var(--blue-500)] text-[var(--blue-500)]" : done ? "border-[var(--blue-500)] bg-[var(--blue-500)] text-white" : "border-[var(--line)] text-[var(--ink-soft)]"}`}>
                      <Icon size={16} />
                    </span>
                    <p className={`mt-2 flex items-center gap-1 text-sm ${done ? "font-semibold text-[var(--ink)]" : "text-[var(--ink-soft)]"}`}>
                      {s.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {(result.origin || result.destination) && (
            <div className="mx-6 mt-6 flex flex-wrap justify-between gap-2 rounded-[var(--radius-sm)] bg-[var(--blue-50)] px-5 py-3 text-sm text-[var(--ink)]">
              {result.origin && <span><span className="text-[var(--ink-soft)]">Origin: </span>{result.origin}</span>}
              {result.destination && <span><span className="text-[var(--ink-soft)]">Destination: </span>{result.destination}</span>}
            </div>
          )}

          {/* shipment history */}
          <div className="p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[var(--ink)]">Shipment Progress</h3>
              {stepsDesc.length > 3 && (
                <button onClick={() => setShowAll((v) => !v)} className="flex items-center gap-1 text-xs font-semibold text-[var(--blue-600)]">
                  {showAll ? "View Less" : "View More"}
                  <ChevronDown size={13} className={showAll ? "rotate-180 transition-transform" : "transition-transform"} />
                </button>
              )}
            </div>

            {visibleSteps.length > 0 ? (
              <ol className="mt-4 space-y-0">
                {visibleSteps.map((step, i) => (
                  <li key={i} className="relative flex gap-3 pb-5 last:pb-0">
                    {i !== visibleSteps.length - 1 && (
                      <span className="absolute left-[11px] top-6 h-full w-px bg-[var(--line)]" />
                    )}
                    <span className="relative z-10 mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--ink)]">
                      <Check size={13} className="text-white" />
                    </span>
                    <div className="flex-1 pb-1">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-semibold text-[var(--ink)]">
                        {step.status}
                        {step.at && (
                          <span className="font-normal text-[var(--ink-soft)]">
                            | {new Date(step.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                          </span>
                        )}
                        {i === 0 && (
                          <span className="rounded-full bg-[var(--blue-50)] px-2 py-0.5 text-[10px] font-semibold text-[var(--blue-600)]">Current</span>
                        )}
                      </p>
                      {step.detail && <p className="mt-0.5 text-xs text-[var(--ink-soft)]">{step.detail}</p>}
                      {step.location && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--ink-soft)]">
                          <MapPin size={11} />{step.location}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 text-sm text-[var(--ink-soft)]">No scan updates yet — check back after pickup.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
