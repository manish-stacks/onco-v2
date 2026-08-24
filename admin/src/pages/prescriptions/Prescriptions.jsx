import { useState } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { FileText, Check, X, Pill, Plus, Trash2, ExternalLink } from 'lucide-react';
import { useList, useResource, useMutation, useDebounced } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { api, mediaUrl } from '@/lib/api';
import { PERMISSIONS as P, PRESCRIPTION_STATUSES, toneOf } from '@/lib/constants';
import { dateTime, ago } from '@/lib/format';
import { PageHeader } from '@/components/layout/Layout';
import {
  Card, Button, StatusPill, SourceTag, Code, Field, Input, Select, Textarea,
  PageLoader, EmptyState, Tabs, cx,
} from '@/components/ui';
import { DataTable, Pagination, FilterBar, SearchInput, FilterSelect } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';

/* =========================================================================
 * LIST
 * ======================================================================= */
const SOURCE_TABS = [
  { value: '', label: 'All' },
  { value: 'web', label: 'Website' },
  { value: 'app', label: 'Mobile app' },
];

export function PrescriptionList() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const toast = useToast();
  const [params] = useSearchParams();
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);

  const { rows, pagination, filters, setFilter, resetFilters, loading, reload } = useList(
    '/admin/prescriptions',
    { status: params.get('status') || '' }
  );
  if (filters.search !== debounced) setFilter('search', debounced);

  const canManage = can(P.PRESCRIPTIONS_MANAGE);

  const deleteRx = async (p) => {
    if (!window.confirm(`Delete ${p.reference_code || `#${p.prescription_id}`}? Images will also be removed from storage. This cannot be undone.`)) return;
    try {
      await api.del(`/admin/prescriptions/${p.prescription_id}`);
      toast.success('Prescription deleted');
      reload();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const columns = [
    {
      key: 'reference_code', label: 'Reference',
      render: (p) => (
        <div>
          <div className="flex items-center gap-1.5">
            <Code>{p.reference_code || `#${p.prescription_id}`}</Code>
            <SourceTag source={p.source} />
          </div>
          <p className="text-2xs text-ink-500 mt-0.5">{ago(p.created_at)}</p>
        </div>
      ),
    },
    {
      key: 'images', label: 'Images',
      render: (p) => {
        const imgs = Array.isArray(p.images) ? p.images : [];
        return (
          <div className="flex items-center gap-1">
            {imgs.slice(0, 3).map((img) => (
              <img key={img} src={mediaUrl(img)} alt=""
                className="w-8 h-8 rounded object-cover border border-line bg-paper-sunk"
                onError={(e) => { e.target.style.visibility = 'hidden'; }} />
            ))}
            {imgs.length > 3 && (
              <span className="text-2xs text-ink-500 tabular-nums ml-0.5">+{imgs.length - 3}</span>
            )}
            {!imgs.length && <span className="text-2xs text-ink-300">no images</span>}
          </div>
        );
      },
    },
    {
      key: 'customer_name', label: 'Customer',
      render: (p) => (
        <div className="min-w-0">
          <p className="text-[0.8125rem] text-ink truncate max-w-[160px]">{p.customer_name || '—'}</p>
          <Code className="text-2xs">{p.customer_mobile || p.contact_number}</Code>
        </div>
      ),
    },
    {
      key: 'patient_name', label: 'Patient / doctor',
      render: (p) => (
        <div className="text-2xs text-ink-500">
          {p.patient_name && <p className="text-ink-700">{p.patient_name}</p>}
          {p.doctor_name && <p>Dr. {p.doctor_name}</p>}
          {!p.patient_name && !p.doctor_name && '—'}
        </div>
      ),
    },
    { key: 'status', label: 'Status', render: (p) => <StatusPill status={p.status} /> },
    {
      key: 'reviewed_at', label: 'Reviewed',
      render: (p) => (p.reviewed_at
        ? <span className="text-2xs tabular-nums text-ink-500">{dateTime(p.reviewed_at)}</span>
        : <span className="text-2xs text-ink-300">pending</span>),
    },
    {
      key: '_actions', label: '', align: 'right',
      render: (p) => (canManage
        ? (
          <button
            onClick={(e) => { e.stopPropagation(); deleteRx(p); }}
            className="text-coral-500 hover:text-coral-600 p-1"
            title="Delete prescription"
          >
            <Trash2 size={15} />
          </button>
        )
        : null),
    },
  ];

  return (
    <>
      <PageHeader
        title="Prescriptions"
        subtitle="Prescriptions from both the web and app — all in one list."
      />

      <Card dense>
        <Tabs tabs={SOURCE_TABS} value={filters.source || ''}
          onChange={(v) => setFilter('source', v)} className="px-4 pt-1" />

        <FilterBar
          hasFilters={!!(filters.search || filters.status || filters.from_date)}
          onReset={() => { setSearch(''); resetFilters(); }}
        >
          <SearchInput value={search} onChange={setSearch}
            placeholder="Reference, patient, doctor, phone…" className="w-full sm:w-64" />
          <FilterSelect label="Status" value={filters.status} placeholder="All"
            options={PRESCRIPTION_STATUSES} onChange={(v) => setFilter('status', v)} />
          <div>
            <span className="label">From</span>
            <Input type="date" value={filters.from_date || ''} className="py-1.5 text-[0.8125rem]"
              onChange={(e) => setFilter('from_date', e.target.value)} />
          </div>
        </FilterBar>

        <DataTable
          columns={columns} rows={rows} loading={loading} rowKey="prescription_id"
          rowTone={(p) => toneOf(p.status)}
          onRowClick={(p) => navigate(`/prescriptions/${p.prescription_id}`)}
          emptyIcon={FileText}
          emptyTitle="No prescriptions found"
          emptyDescription="These will appear here once customers upload them."
        />
        <Pagination pagination={pagination} onPage={(p) => setFilter('page', p)} />
      </Card>
    </>
  );
}

/* =========================================================================
 * DETAIL
 * ======================================================================= */
export function PrescriptionDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const navigate = useNavigate();
  const { data: presc, loading, reload } = useResource(`/admin/prescriptions/${id}`);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [medOpen, setMedOpen] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  const remove = useMutation(
    () => api.del(`/admin/prescriptions/${id}`),
    {
      success: 'Prescription deleted',
      onSuccess: () => navigate('/prescriptions'),
    }
  );

  const confirmDelete = () => {
    if (window.confirm('Delete this prescription permanently? This cannot be undone.')) {
      remove.run();
    }
  };

  if (loading && !presc) return <PageLoader />;
  if (!presc) return <EmptyState icon={FileText} title="Prescription not found" />;

  const images = Array.isArray(presc.images) ? presc.images : [];
  const canManage = can(P.PRESCRIPTIONS_MANAGE);

  return (
    <>
      <PageHeader
        back="/prescriptions" backLabel="Prescriptions"
        title={
          <span className="flex items-center gap-2.5 flex-wrap">
            <span className="font-mono">{presc.reference_code || `#${presc.prescription_id}`}</span>
            <StatusPill status={presc.status} />
            <SourceTag source={presc.source} />
          </span>
        }
        subtitle={`${images.length} image${images.length === 1 ? '' : 's'} · uploaded ${dateTime(presc.created_at)}`}
        actions={canManage && (
          <>
            <Button icon={Pill} onClick={() => setMedOpen(true)}>Suggest medicines</Button>
            <Button variant="primary" icon={Check} onClick={() => setReviewOpen(true)}>Review</Button>
            <Button variant="dangerGhost" icon={Trash2} loading={remove.loading} onClick={confirmDelete}>
              Delete
            </Button>
          </>
        )}
      />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card
            title="Uploaded images"
            subtitle="Images are stored in a JSON array — as many as you need"
            dense
          >
            {images.length ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-4">
                {images.map((img, i) => (
                  <button
                    key={img} onClick={() => setLightbox(img)}
                    className="group relative aspect-[3/4] rounded border border-line overflow-hidden bg-paper-sunk hover:border-teal transition-colors"
                  >
                    <img src={mediaUrl(img)} alt={`Prescription page ${i + 1}`}
                      className="w-full h-full object-cover" />
                    <span className="absolute top-1.5 left-1.5 code-chip bg-ink/80 text-white border-transparent">
                      {i + 1}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState icon={FileText} title="No images" />
            )}
          </Card>

          <Card
            title="Suggested medicines"
            subtitle="Customers can add these straight to the cart"
            action={canManage && (
              <Button size="xs" icon={Plus} onClick={() => setMedOpen(true)}>Edit</Button>
            )}
            dense
          >
            {presc.medicines?.length ? (
              <ul className="divide-y divide-line">
                {presc.medicines.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                    {m.image_1 && (
                      <img src={mediaUrl(m.image_1)} alt=""
                        className="w-9 h-9 rounded object-cover border border-line shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.8125rem] text-ink truncate">{m.medicine_name}</p>
                      {m.product_id && <Code className="text-2xs">product #{m.product_id}</Code>}
                    </div>
                    <span className="text-2xs tabular-nums text-ink-500 shrink-0">×{m.quantity}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={Pill} title="No medicines suggested yet"
                description="Read the prescription and add medicines, so ordering is easier for the customer."
              />
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Details" dense>
            <dl className="p-4 space-y-2 text-[0.8125rem]">
              <DRow label="Patient" value={presc.patient_name} />
              <DRow label="Doctor" value={presc.doctor_name} />
              <DRow label="Hospital" value={presc.hospital_name} />
              <DRow label="Contact" value={presc.contact_number} mono />
              <DRow label="Type" value={presc.direct_upload ? 'Direct upload' : 'With an order'} />
              {presc.customer_id && (
                <div className="pt-2 border-t border-line">
                  <Link to={`/customers/${presc.customer_id}`}
                    className="inline-flex items-center gap-1 text-2xs text-teal hover:underline">
                    Customer profile <ExternalLink size={11} />
                  </Link>
                </div>
              )}
            </dl>
          </Card>

          {presc.notes && (
            <Card title="Notes" dense>
              <p className="p-4 text-[0.8125rem] text-ink-700 leading-relaxed whitespace-pre-wrap">{presc.notes}</p>
            </Card>
          )}

          {presc.rejection_reason && (
            <Card title="Rejection reason" dense>
              <p className="p-4 text-[0.8125rem] text-signal-danger leading-relaxed">{presc.rejection_reason}</p>
            </Card>
          )}

          {presc.reviewed_at && (
            <Card title="Review" dense>
              <div className="p-4 text-2xs text-ink-500 space-y-1">
                <p>Reviewed {dateTime(presc.reviewed_at)}</p>
                {presc.reviewed_by && <p>by admin #{presc.reviewed_by}</p>}
              </div>
            </Card>
          )}
        </div>
      </div>

      <ReviewModal
        open={reviewOpen} onClose={() => setReviewOpen(false)}
        presc={presc} onDone={reload}
      />
      <MedicinesModal
        open={medOpen} onClose={() => setMedOpen(false)}
        presc={presc} onDone={reload}
      />

      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-ink/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button className="absolute top-4 right-4 text-white/60 hover:text-white p-2" aria-label="Close">
            <X size={22} />
          </button>
          <img src={mediaUrl(lightbox)} alt="Prescription"
            className="max-w-full max-h-full object-contain rounded" />
        </div>
      )}
    </>
  );
}

function DRow({ label, value, mono }) {
  return (
    <div className="flex gap-3">
      <dt className="text-ink-500 w-20 shrink-0 text-2xs pt-0.5">{label}</dt>
      <dd className={cx('min-w-0 flex-1', mono ? 'code' : 'text-ink-700')}>
        {value || <span className="text-ink-300">—</span>}
      </dd>
    </div>
  );
}

export function ReviewModal({ open, onClose, presc, onDone }) {
  const [status, setStatus] = useState(presc.status);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  const save = useMutation(
    () => api.patch(`/admin/prescriptions/${presc.prescription_id}/status`, {
      status, rejection_reason: reason, notes,
    }),
    { success: 'Status updated', onSuccess: () => { onClose(); onDone(); } }
  );

  return (
    <Modal
      open={open} onClose={onClose} title="Review prescription"
      subtitle={presc.reference_code}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save.run} loading={save.loading}>Save review</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Decision" required>
          <div className="grid grid-cols-2 gap-2">
            {PRESCRIPTION_STATUSES.map((s) => (
              <button
                key={s} type="button" onClick={() => setStatus(s)}
                className={cx(
                  'px-3 py-2 rounded border text-[0.8125rem] text-left transition-colors',
                  status === s ? 'border-teal bg-teal-light text-teal-dark font-medium'
                    : 'border-line hover:border-line-strong text-ink-700'
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </Field>

        {status === 'Rejected' && (
          <Field label="Rejection reason" required hint="This message is shown to the customer">
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Image is unclear / doctor's signature missing / it is 6 months old" />
          </Field>
        )}

        <Field label="Internal note">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="For the team — not shown to the customer" />
        </Field>
      </div>
    </Modal>
  );
}

export function MedicinesModal({ open, onClose, presc, onDone }) {
  const [meds, setMeds] = useState(presc.medicines?.length
    ? presc.medicines.map((m) => ({
      product_id: m.product_id || '', medicine_name: m.medicine_name || '',
      medicine_link: m.medicine_link || '', quantity: m.quantity || 1,
    }))
    : [{ product_id: '', medicine_name: '', medicine_link: '', quantity: 1 }]);

  const save = useMutation(
    () => api.put(`/admin/prescriptions/${presc.prescription_id}/medicines`, {
      medicines: meds.filter((m) => m.medicine_name || m.product_id),
    }),
    { success: 'Medicines saved', onSuccess: () => { onClose(); onDone(); } }
  );

  const update = (i, k, v) => setMeds((m) => m.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  return (
    <Modal
      open={open} onClose={onClose} title="Suggest medicines" size="lg"
      subtitle="Read the prescription and list the medicines needed"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save.run} loading={save.loading}>Save medicines</Button>
        </>
      }
    >
      <div className="space-y-2">
        {meds.map((m, i) => (
          <div key={i} className="flex items-end gap-2 p-2.5 border border-line rounded bg-paper">
            <Field label={i === 0 ? 'Medicine name' : undefined} className="flex-1 min-w-0">
              <Input value={m.medicine_name} placeholder="Tab. Imatinib 400mg"
                onChange={(e) => update(i, 'medicine_name', e.target.value)} />
            </Field>
            <Field label={i === 0 ? 'Product ID' : undefined} className="w-24 shrink-0">
              <Input mono type="number" value={m.product_id} placeholder="—"
                onChange={(e) => update(i, 'product_id', e.target.value)} />
            </Field>
            <Field label={i === 0 ? 'Qty' : undefined} className="w-16 shrink-0">
              <Input type="number" min="1" value={m.quantity}
                onChange={(e) => update(i, 'quantity', e.target.value)} />
            </Field>
            <Button size="sm" variant="dangerGhost" onClick={() => setMeds(meds.filter((_, j) => j !== i))}
              disabled={meds.length === 1} title="Remove">
              <Trash2 size={13} />
            </Button>
          </div>
        ))}

        <Button size="sm" icon={Plus}
          onClick={() => setMeds([...meds, { product_id: '', medicine_name: '', medicine_link: '', quantity: 1 }])}>
          Add medicine
        </Button>
      </div>
    </Modal>
  );
}
