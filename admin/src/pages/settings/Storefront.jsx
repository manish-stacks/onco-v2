import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Plus, Pencil, Trash2, Image, Tag, MapPin, Save } from 'lucide-react';
import { useResource, useMutation } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api, mediaUrl } from '@/lib/api';
import { PERMISSIONS as P } from '@/lib/constants';
import { inr } from '@/lib/format';
import { PageHeader } from '@/components/layout/Layout';
import {
  Card, Button, StatusPill, Code, Field, Input, Select, Textarea, Checkbox, Tabs, EmptyState, cx,
} from '@/components/ui';
import { DataTable } from '@/components/ui/DataTable';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';

const TABS = [
  { value: 'general', label: 'General' },
  { value: 'banners', label: 'Banners' },
  { value: 'deals', label: 'Deals' },
  { value: 'offers', label: 'Offer cards' },
  { value: 'cities', label: 'Delivery cities' },
];

export default function Storefront() {
  const [tab, setTab] = useState('general');

  return (
    <>
      <PageHeader title="Storefront" subtitle="Site settings, homepage content aur delivery config" />
      <Card dense>
        <Tabs tabs={TABS} value={tab} onChange={setTab} className="px-4 pt-1" />
        {tab === 'general' && <General />}
        {tab === 'banners' && <Banners />}
        {tab === 'deals' && <Deals />}
        {tab === 'offers' && <Offers />}
        {tab === 'cities' && <Cities />}
      </Card>
    </>
  );
}

/* ========================================================================= */
function General() {
  const { can } = useAuth();
  const { data, loading, reload } = useResource('/admin/settings');
  const [form, setForm] = useState({});
  const [logo, setLogo] = useState(null);

  useEffect(() => { if (data) setForm(data); }, [data]);

  const save = useMutation(
    async () => {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (k === 'id' || k === 'logo' || v === null || v === undefined) return;
        fd.append(k, v);
      });
      if (logo) fd.append('logo', logo);
      return api.form(`/admin/settings/${data.id}`, fd, 'PUT');
    },
    { success: 'Settings save ho gayi', onSuccess: reload }
  );

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const canManage = can(P.SETTINGS_MANAGE);

  if (loading) return <div className="p-6 text-sm text-ink-500">Loading…</div>;
  if (!data) return <EmptyState icon={SettingsIcon} title="Settings row nahi mili" />;

  return (
    <div className="p-4">
      <div className="grid lg:grid-cols-2 gap-6 max-w-4xl">
        <section>
          <h3 className="text-sm font-semibold text-ink mb-3">Business details</h3>
          <div className="space-y-3">
            <Field label="Organisation name">
              <Input value={form.organization || ''} onChange={(e) => set('organization', e.target.value)} />
            </Field>
            <Field label="Address">
              <Textarea rows={2} value={form.contact_address || ''} onChange={(e) => set('contact_address', e.target.value)} />
            </Field>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Phone">
                <Input mono value={form.contact_phone || ''} onChange={(e) => set('contact_phone', e.target.value)} />
              </Field>
              <Field label="Email">
                <Input type="email" value={form.contact_email || ''} onChange={(e) => set('contact_email', e.target.value)} />
              </Field>
            </div>
            <Field label="Logo">
              <div className="flex items-center gap-3">
                {(logo || form.logo) && (
                  <img src={logo ? URL.createObjectURL(logo) : mediaUrl(form.logo)} alt=""
                    className="w-14 h-14 rounded border border-line object-contain bg-white p-1" />
                )}
                <Input type="file" accept="image/*" onChange={(e) => setLogo(e.target.files?.[0])}
                  className="py-1.5 text-2xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-paper-sunk file:text-2xs" />
              </div>
            </Field>
            <Field label="Copyright line">
              <Input value={form.copyright || ''} onChange={(e) => set('copyright', e.target.value)} />
            </Field>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-ink mb-3">Orders & delivery</h3>
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Shipping charge (₹)" hint="Flat charge">
                <Input type="number" value={form.shipping_charge || ''} onChange={(e) => set('shipping_charge', e.target.value)} />
              </Field>
              <Field label="Free shipping above (₹)" hint="Isse upar shipping free">
                <Input type="number" value={form.shipping_threshold || ''} onChange={(e) => set('shipping_threshold', e.target.value)} />
              </Field>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="COD">
                <div className="pt-2">
                  <Checkbox label="Cash on delivery allowed" checked={!!Number(form.is_cod)}
                    onChange={(e) => set('is_cod', e.target.checked ? 1 : 0)} />
                </div>
              </Field>
              <Field label="COD fee (₹)">
                <Input type="number" value={form.cod_fee || ''} onChange={(e) => set('cod_fee', e.target.value)} />
              </Field>
            </div>

            <h3 className="text-sm font-semibold text-ink pt-3 mb-1">Social links</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Facebook">
                <Input value={form.facebook_link || ''} onChange={(e) => set('facebook_link', e.target.value)} />
              </Field>
              <Field label="Instagram">
                <Input value={form.instagram_link || ''} onChange={(e) => set('instagram_link', e.target.value)} />
              </Field>
              <Field label="Twitter / X">
                <Input value={form.twitter_link || ''} onChange={(e) => set('twitter_link', e.target.value)} />
              </Field>
              <Field label="Pinterest">
                <Input value={form.printinterest_link || ''} onChange={(e) => set('printinterest_link', e.target.value)} />
              </Field>
            </div>
          </div>
        </section>
      </div>

      {canManage && (
        <div className="mt-6 pt-4 border-t border-line">
          <Button variant="primary" icon={Save} onClick={save.run} loading={save.loading}>Save settings</Button>
        </div>
      )}
    </div>
  );
}

/* ========================================================================= */
function Banners() {
  const { can } = useAuth();
  const { data: rows, loading, reload } = useResource('/admin/banners');
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const del = useMutation((id) => api.del(`/admin/banners/${id}`),
    { success: 'Banner delete ho gaya', onSuccess: () => { setToDelete(null); reload(); } });

  const canManage = can(P.SETTINGS_MANAGE);

  return (
    <div className="p-4">
      {canManage && (
        <div className="mb-4">
          <Button variant="primary" size="sm" icon={Plus} onClick={() => setEditing({})}>Add banner</Button>
        </div>
      )}

      {rows?.length ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map((b) => (
            <div key={b.banner_id} className="border border-line rounded-lg overflow-hidden bg-white">
              <div className="aspect-[16/7] bg-paper-sunk">
                {b.banner_image && (
                  <img src={mediaUrl(b.banner_image)} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <StatusPill status={b.status} size="xs" />
                  {b.banner_link && (
                    <p className="text-2xs text-ink-500 truncate mt-1">{b.banner_link}</p>
                  )}
                </div>
                {canManage && (
                  <div className="flex gap-0.5 shrink-0">
                    <Button size="xs" variant="ghost" onClick={() => setEditing(b)}><Pencil size={13} /></Button>
                    <Button size="xs" variant="dangerGhost" onClick={() => setToDelete(b)}><Trash2 size={13} /></Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={Image} title="Koi banner nahi"
          description="Homepage carousel ke liye banner add karo."
          action={canManage && <Button variant="primary" icon={Plus} onClick={() => setEditing({})}>Add banner</Button>} />
      )}

      <SimpleFormModal
        open={!!editing} onClose={() => setEditing(null)} record={editing}
        idKey="banner_id" path="/admin/banners" title="banner" onDone={reload}
        fileField="banner_image"
        fields={[
          { key: 'banner_link', label: 'Link URL', hint: 'Click karne pe kahan jaaye' },
          { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'], default: 'Active' },
        ]}
      />
      <ConfirmDialog
        open={!!toDelete} onClose={() => setToDelete(null)}
        onConfirm={() => del.run(toDelete.banner_id)} loading={del.loading}
        title="Delete banner" confirmLabel="Delete" message="Ye banner homepage se hat jaayega." />
    </div>
  );
}

/* ========================================================================= */
function Deals() {
  const { can } = useAuth();
  const { data: rows, loading, reload } = useResource('/admin/deals');
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const del = useMutation((id) => api.del(`/admin/deals/${id}`),
    { success: 'Deal delete ho gaya', onSuccess: () => { setToDelete(null); reload(); } });

  const canManage = can(P.SETTINGS_MANAGE);

  return (
    <>
      {canManage && (
        <div className="px-4 py-3 border-b border-line bg-paper">
          <Button variant="primary" size="sm" icon={Plus} onClick={() => setEditing({})}>Add deal</Button>
        </div>
      )}

      <DataTable
        rowKey="id" rows={rows || []} loading={loading}
        rowTone={(d) => (Number(d.active_status) ? 'ok' : 'idle')}
        columns={[
          { key: 'title', label: 'Deal',
            render: (d) => (
              <div className="flex items-center gap-2.5">
                {d.image && <img src={mediaUrl(d.image)} alt="" className="w-10 h-10 rounded object-cover border border-line" />}
                <div>
                  <p className="text-[0.8125rem] text-ink">{d.title}</p>
                  <p className="text-2xs text-ink-500 line-clamp-1 max-w-[220px]">{d.description}</p>
                </div>
              </div>
            ) },
          { key: 'position', label: 'Position', align: 'center',
            render: (d) => <span className="text-2xs tabular-nums text-ink-500">{d.position ?? '—'}</span> },
          { key: 'active_status', label: 'Status',
            render: (d) => <StatusPill status={Number(d.active_status) ? 'Active' : 'Inactive'} size="xs" /> },
          { key: 'actions', label: '', align: 'right',
            render: (d) => canManage && (
              <div className="flex justify-end gap-0.5">
                <Button size="xs" variant="ghost" onClick={() => setEditing(d)}><Pencil size={13} /></Button>
                <Button size="xs" variant="dangerGhost" onClick={() => setToDelete(d)}><Trash2 size={13} /></Button>
              </div>
            ) },
        ]}
        emptyIcon={Tag} emptyTitle="Koi deal nahi"
      />

      <SimpleFormModal
        open={!!editing} onClose={() => setEditing(null)} record={editing}
        idKey="id" path="/admin/deals" title="deal" onDone={reload} fileField="image"
        fields={[
          { key: 'title', label: 'Title', required: true },
          { key: 'description', label: 'Description', type: 'textarea' },
          { key: 'position', label: 'Sort position', type: 'number' },
          { key: 'bgColor', label: 'Background colour', hint: '#RRGGBB' },
          { key: 'textColor', label: 'Text colour', hint: '#RRGGBB' },
          { key: 'active_status', label: 'Active', type: 'select', options: [{ value: '1', label: 'Active' }, { value: '0', label: 'Inactive' }], default: '1' },
        ]}
      />
      <ConfirmDialog
        open={!!toDelete} onClose={() => setToDelete(null)}
        onConfirm={() => del.run(toDelete.id)} loading={del.loading}
        title="Delete deal" confirmLabel="Delete" message={`"${toDelete?.title}" hat jaayega.`} />
    </>
  );
}

/* ========================================================================= */
function Offers() {
  const { can } = useAuth();
  const { data: rows, loading, reload } = useResource('/admin/offers');
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const del = useMutation((id) => api.del(`/admin/offers/${id}`),
    { success: 'Offer delete ho gaya', onSuccess: () => { setToDelete(null); reload(); } });

  const canManage = can(P.SETTINGS_MANAGE);

  return (
    <>
      {canManage && (
        <div className="px-4 py-3 border-b border-line bg-paper">
          <Button variant="primary" size="sm" icon={Plus} onClick={() => setEditing({})}>Add offer card</Button>
        </div>
      )}

      <DataTable
        rowKey="id" rows={rows || []} loading={loading}
        rowTone={(o) => (Number(o.status) ? 'ok' : 'idle')}
        columns={[
          { key: 'title', label: 'Offer',
            render: (o) => (
              <div>
                <p className="text-[0.8125rem] text-ink">{o.title}</p>
                <p className="text-2xs text-ink-500">{o.desc_code}</p>
              </div>
            ) },
          { key: 'CODE', label: 'Code', render: (o) => <Code>{o.CODE}</Code> },
          { key: 'percenatge_off', label: 'Discount', align: 'right',
            render: (o) => (
              <span className="text-[0.8125rem] tabular-nums text-ink-700">
                {o.discount_type === 'Percentage' ? `${o.percenatge_off}%` : inr(o.percenatge_off)}
              </span>
            ) },
          { key: 'min_order_value', label: 'Min order', align: 'right',
            render: (o) => <span className="text-2xs tabular-nums text-ink-500">{o.min_order_value ? inr(o.min_order_value) : '—'}</span> },
          { key: 'status', label: 'Status',
            render: (o) => <StatusPill status={Number(o.status) ? 'Active' : 'Inactive'} size="xs" /> },
          { key: 'actions', label: '', align: 'right',
            render: (o) => canManage && (
              <div className="flex justify-end gap-0.5">
                <Button size="xs" variant="ghost" onClick={() => setEditing(o)}><Pencil size={13} /></Button>
                <Button size="xs" variant="dangerGhost" onClick={() => setToDelete(o)}><Trash2 size={13} /></Button>
              </div>
            ) },
        ]}
        emptyIcon={Tag} emptyTitle="Koi offer card nahi"
        emptyDescription="App me jo offer cards dikhte hain wo yahan se bante hain."
      />

      <SimpleFormModal
        open={!!editing} onClose={() => setEditing(null)} record={editing}
        idKey="id" path="/admin/offers" title="offer" onDone={reload} json
        fields={[
          { key: 'title', label: 'Title', required: true },
          { key: 'CODE', label: 'Coupon code', mono: true },
          { key: 'desc_code', label: 'Description' },
          { key: 'discount_type', label: 'Discount type', type: 'select', options: ['Percentage', 'Fixed'], default: 'Percentage' },
          { key: 'percenatge_off', label: 'Discount value', type: 'number' },
          { key: 'maxDiscount', label: 'Max discount (₹)', type: 'number' },
          { key: 'min_order_value', label: 'Min order (₹)', type: 'number' },
          { key: 'theme', label: 'Theme colour', hint: '#RRGGBB' },
          { key: 'status', label: 'Active', type: 'select', options: [{ value: '1', label: 'Active' }, { value: '0', label: 'Inactive' }], default: '1' },
        ]}
      />
      <ConfirmDialog
        open={!!toDelete} onClose={() => setToDelete(null)}
        onConfirm={() => del.run(toDelete.id)} loading={del.loading}
        title="Delete offer" confirmLabel="Delete" message={`"${toDelete?.title}" hat jaayega.`} />
    </>
  );
}

/* ========================================================================= */
function Cities() {
  const { can } = useAuth();
  const { data: rows, loading, reload } = useResource('/admin/cities');
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const del = useMutation((id) => api.del(`/admin/cities/${id}`),
    { success: 'City hata di', onSuccess: () => { setToDelete(null); reload(); } });

  const canManage = can(P.SETTINGS_MANAGE);

  return (
    <>
      {canManage && (
        <div className="px-4 py-3 border-b border-line bg-paper">
          <Button variant="primary" size="sm" icon={Plus} onClick={() => setEditing({})}>Add city</Button>
        </div>
      )}

      <DataTable
        rowKey="id" rows={rows || []} loading={loading}
        rowTone={(c) => (Number(c.status) ? 'ok' : 'idle')}
        columns={[
          { key: 'city', label: 'City', render: (c) => <span className="text-[0.8125rem] text-ink">{c.city}</span> },
          { key: 'E_T_D', label: 'Delivery time',
            render: (c) => <span className="text-2xs text-ink-500">{c.E_T_D || '—'}</span> },
          { key: 'status', label: 'Status',
            render: (c) => <StatusPill status={Number(c.status) ? 'Active' : 'Inactive'} size="xs" /> },
          { key: 'actions', label: '', align: 'right',
            render: (c) => canManage && (
              <div className="flex justify-end gap-0.5">
                <Button size="xs" variant="ghost" onClick={() => setEditing(c)}><Pencil size={13} /></Button>
                <Button size="xs" variant="dangerGhost" onClick={() => setToDelete(c)}><Trash2 size={13} /></Button>
              </div>
            ) },
        ]}
        emptyIcon={MapPin} emptyTitle="Koi serviceable city nahi"
        emptyDescription="Jahan delivery karte ho wo cities add karo — customer checkout pe check karta hai."
      />

      <SimpleFormModal
        open={!!editing} onClose={() => setEditing(null)} record={editing}
        idKey="id" path="/admin/cities" title="city" onDone={reload} json
        fields={[
          { key: 'city', label: 'City name', required: true },
          { key: 'E_T_D', label: 'Estimated delivery', hint: '2-3 days' },
          { key: 'status', label: 'Active', type: 'select', options: [{ value: '1', label: 'Active' }, { value: '0', label: 'Inactive' }], default: '1' },
        ]}
      />
      <ConfirmDialog
        open={!!toDelete} onClose={() => setToDelete(null)}
        onConfirm={() => del.run(toDelete.id)} loading={del.loading}
        title="Remove city" confirmLabel="Remove"
        message={`"${toDelete?.city}" me delivery band ho jaayegi.`} />
    </>
  );
}

/* =========================================================================
 * Generic CRUD modal — banners/deals/offers/cities sab isse chalte hain
 * ======================================================================= */
export function SimpleFormModal({
  open, onClose, record, idKey, path, title, fields, onDone, fileField, json,
}) {
  const isEdit = !!record?.[idKey];
  const [form, setForm] = useState({});
  const [file, setFile] = useState(null);
  const [lastId, setLastId] = useState(null);

  if (open && lastId !== (record?.[idKey] ?? 'new')) {
    setLastId(record?.[idKey] ?? 'new');
    const init = {};
    fields.forEach((f) => {
      init[f.key] = record?.[f.key] ?? f.default ?? '';
    });
    setForm(init);
    setFile(null);
  }

  const save = useMutation(
    () => {
      if (json && !fileField) {
        return isEdit ? api.put(`${path}/${record[idKey]}`, form) : api.post(path, form);
      }
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v !== '' && v !== null) fd.append(k, v); });
      if (file && fileField) fd.append(fileField, file);
      return isEdit ? api.form(`${path}/${record[idKey]}`, fd, 'PUT') : api.form(path, fd, 'POST');
    },
    {
      success: isEdit ? `${title} update ho gaya` : `${title} add ho gaya`,
      onSuccess: () => { onClose(); onDone(); },
    }
  );

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal
      open={open} onClose={onClose}
      title={`${isEdit ? 'Edit' : 'New'} ${title}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save.run} loading={save.loading}>Save</Button>
        </>
      }
    >
      <div className="space-y-3">
        {fileField && (
          <Field label="Image">
            <div className="flex items-center gap-3">
              {(file || record?.[fileField]) && (
                <img src={file ? URL.createObjectURL(file) : mediaUrl(record[fileField])} alt=""
                  className="w-16 h-16 rounded border border-line object-cover" />
              )}
              <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0])}
                className="py-1.5 text-2xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-paper-sunk file:text-2xs" />
            </div>
          </Field>
        )}

        {fields.map((f) => (
          <Field key={f.key} label={f.label} required={f.required} hint={f.hint}>
            {f.type === 'textarea' ? (
              <Textarea rows={2} value={form[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} />
            ) : f.type === 'select' ? (
              <Select value={form[f.key] ?? ''} options={f.options}
                onChange={(e) => set(f.key, e.target.value)} />
            ) : (
              <Input type={f.type || 'text'} mono={f.mono} value={form[f.key] ?? ''}
                onChange={(e) => set(f.key, e.target.value)} />
            )}
          </Field>
        ))}
      </div>
    </Modal>
  );
}
