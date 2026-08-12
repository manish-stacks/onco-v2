import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save } from 'lucide-react';
import { useResource, useMutation } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api, mediaUrl } from '@/lib/api';
import { PERMISSIONS as P } from '@/lib/constants';
import { PageHeader } from '@/components/layout/Layout';
import { Card, Button, Field, Input, Textarea, Checkbox, EmptyState } from '@/components/ui';

/**
 * Site-wide settings — business details, shipping rules, social links.
 * Banners/deals/offers/cities ab apne alag pages pe hain.
 */
export default function Settings() {
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

  if (loading) {
    return (
      <>
        <PageHeader title="Site settings" />
        <Card dense><div className="p-6 text-sm text-ink-500">Loading…</div></Card>
      </>
    );
  }
  if (!data) {
    return (
      <>
        <PageHeader title="Site settings" />
        <Card dense>
          <EmptyState icon={SettingsIcon} title="Settings row nahi mili"
            description="settings table me ek row honi chahiye. DB check karo." />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Site settings"
        subtitle="Business details, shipping rules aur social links"
        actions={canManage && (
          <Button variant="primary" icon={Save} onClick={save.run} loading={save.loading}>
            Save settings
          </Button>
        )}
      />

      <Card dense>
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
      </Card>
    </>
  );
}

