import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Truck, Search, Loader2, MapPin, Copy, Check, PackageCheck, PackageOpen, ChevronDown, Box,
} from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/layout/Layout';
import { Card, Button, Field, Input, EmptyState, cx } from '@/components/ui';

const STAGES = [
  { key: 'picked_up', label: 'Picked Up', icon: PackageOpen },
  { key: 'in_transit', label: 'In Transit', icon: Truck },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: Box },
  { key: 'delivered', label: 'Delivered', icon: PackageCheck },
];

function stageIndex(stage) {
  const i = STAGES.findIndex((s) => s.key === stage);
  return i === -1 ? -1 : i;
}

/**
 * Standalone "look up any AWB" page — separate from ShippingPanel.jsx (which
 * lives inside an order and handles booking/labels/cancellation for that
 * specific order's shipment). This one is for the quick "customer called
 * asking where their parcel is" case, without needing to find the order first.
 */
export default function TrackShipment() {
  const [params] = useSearchParams();
  const [awb, setAwb] = useState(params.get('awb') || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showAll, setShowAll] = useState(false);

  async function handleTrack(e) {
    e?.preventDefault?.();
    if (!awb.trim()) { setError('Enter an AWB / consignment number.'); return; }
    setError(null);
    setLoading(true);
    setResult(null);
    setShowAll(false);
    try {
      const res = await api.post('/admin/track-shipment', { awb: awb.trim() });
      setResult(res.data);
    } catch (err) {
      setError(err.message || 'Could not fetch tracking right now.');
    } finally {
      setLoading(false);
    }
  }

  // Coming here from an order's "Full tracking" button (?awb=...) — track
  // right away instead of making them press the button again.
  useEffect(() => {
    if (params.get('awb')) handleTrack();
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
    <>
      <PageHeader title="Track a shipment" subtitle="Look up any AWB's live DTDC status — doesn't need to be attached to an order" />

      <Card dense>
        <form onSubmit={handleTrack} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Field label="AWB / consignment number">
              <Input mono value={awb} onChange={(e) => setAwb(e.target.value)} placeholder="e.g. 7X118966375" autoFocus />
            </Field>
          </div>
          <Button type="submit" variant="primary" icon={loading ? Loader2 : Search} loading={loading}>
            Track
          </Button>
        </form>

        {error && (
          <p className="mx-5 mb-5 rounded-md border border-signal-danger/20 bg-signal-dangerBg px-4 py-3 text-sm text-signal-danger">
            {error}
          </p>
        )}

        {result && (
          <div className="border-t border-line">
            {/* header */}
            <div className="flex items-start justify-between gap-3 p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E4002B] text-white">
                  <Truck size={16} />
                </span>
                <div>
                  <p className="text-2xs font-semibold text-ink-500">DTDC</p>
                  <button onClick={copyAwb} className="flex items-center gap-1.5 text-sm text-ink">
                    AWB: <span className="font-semibold">{result.awb}</span>
                    {copied ? <Check size={13} className="text-signal-ok" /> : <Copy size={13} className="text-ink-400" />}
                  </button>
                </div>
              </div>
              {result.ref_no && (
                <div className="text-right">
                  <p className="text-2xs text-ink-500">Ref. No.</p>
                  <p className="text-sm font-semibold text-ink">{result.ref_no}</p>
                </div>
              )}
            </div>

            <div className="border-t border-line px-5 py-3">
              <p className="text-2xs font-semibold uppercase tracking-wide text-signal-info">Estimated Delivery Date</p>
              <p className="mt-0.5 text-sm text-ink-500">
                {result.expected_delivery || 'Will be updated once the shipment enters the DTDC network.'}
              </p>
            </div>

            {/* status banner */}
            <div className="flex items-center gap-3 bg-paper-sunk px-5 py-6">
              <PackageOpen size={24} className="text-ink-400" />
              <h2 className="text-lg font-bold text-ink">{result.current_status}</h2>
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
                        <span className={cx('h-1 flex-1 rounded', i === 0 ? 'opacity-0' : done ? 'bg-teal' : 'bg-line')} />
                      </div>
                      <span className={cx(
                        '-mt-2.5 flex h-7 w-7 items-center justify-center rounded-full border-2 bg-white text-xs',
                        isCurrent ? 'border-teal text-teal' : done ? 'border-teal bg-teal text-white' : 'border-line text-ink-400'
                      )}>
                        <Icon size={13} />
                      </span>
                      <p className={cx('mt-1.5 text-2xs', done ? 'font-semibold text-ink' : 'text-ink-500')}>{s.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {(result.origin || result.destination) && (
              <div className="mx-5 mt-5 flex flex-wrap justify-between gap-2 rounded-md bg-signal-infoBg px-4 py-2.5 text-2xs text-ink">
                {result.origin && <span><span className="text-ink-500">Origin: </span>{result.origin}</span>}
                {result.destination && <span><span className="text-ink-500">Destination: </span>{result.destination}</span>}
              </div>
            )}

            {/* shipment history */}
            <div className="p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-ink">Shipment Progress</h3>
                {stepsDesc.length > 3 && (
                  <button onClick={() => setShowAll((v) => !v)} className="flex items-center gap-1 text-2xs font-semibold text-teal-dark">
                    {showAll ? 'View Less' : 'View More'}
                    <ChevronDown size={13} className={showAll ? 'rotate-180 transition-transform' : 'transition-transform'} />
                  </button>
                )}
              </div>

              {visibleSteps.length > 0 ? (
                <ol className="mt-4 space-y-0">
                  {visibleSteps.map((step, i) => (
                    <li key={i} className="relative flex gap-3 pb-5 last:pb-0">
                      {i !== visibleSteps.length - 1 && (
                        <span className="absolute left-[9px] top-5 h-full w-px bg-line" />
                      )}
                      <span className="relative z-10 mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink">
                        <Check size={11} className="text-white" />
                      </span>
                      <div className="flex-1 pb-1">
                        <p className="flex flex-wrap items-center gap-2 text-[0.8125rem] font-semibold text-ink">
                          {step.status}
                          {i === 0 && <span className="rounded-full bg-signal-infoBg px-2 py-0.5 text-[10px] font-semibold text-signal-info">Current</span>}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-2xs text-ink-500">
                          {step.at && <span>{new Date(step.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>}
                        </div>
                        {step.location && (
                          <p className="mt-0.5 flex items-center gap-1 text-2xs text-ink-500">
                            <MapPin size={11} />{step.location}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-4 text-sm text-ink-500">No scan updates yet — check back after pickup.</p>
              )}
            </div>
          </div>
        )}

        {!result && !error && !loading && (
          <EmptyState icon={Truck} title="Enter an AWB to see its status" description="Works for any DTDC consignment, whether or not it's linked to an order here." />
        )}
      </Card>
    </>
  );
}
