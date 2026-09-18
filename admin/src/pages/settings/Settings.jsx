import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, Building2, Truck, CreditCard, Share2, Search, Bell, Code2 } from 'lucide-react';
import { useResource, useMutation } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { api, mediaUrl } from '@/lib/api';
import { PERMISSIONS as P } from '@/lib/constants';
import { PageHeader } from '@/components/layout/Layout';
import { Card, Button, Field, Input, Textarea, Checkbox, Select, EmptyState } from '@/components/ui';

/** Small section wrapper so every block reads as its own card with a consistent header.
 *  break-inside-avoid keeps each card intact when flowing through CSS columns. */
function SettingsSection({ icon: Icon, title, hint, children }) {
  return (
    <div className="break-inside-avoid mb-4">
      <Card dense>
        <div className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-md bg-paper-sunk flex items-center justify-center shrink-0">
              <Icon className="w-3.5 h-3.5 text-ink-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ink leading-tight">{title}</h3>
              {hint && <p className="text-2xs text-ink-500 leading-tight">{hint}</p>}
            </div>
          </div>
          <div className="space-y-3">{children}</div>
        </div>
      </Card>
    </div>
  );
}

/**
 * Site-wide settings — business details, shipping rules, tax, social links.
 * Banners/deals/offers/cities now have their own separate pages.
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
      // Always send the toggle fields — otherwise an unchecked (0) value never saves
      ['is_cod', 'is_razorpay', 'is_payu'].forEach((k) => {
        fd.set(k, Number(form[k]) ? 1 : 0);
      });
      ['notify_whatsapp_enabled', 'notify_sms_enabled', 'notify_email_enabled'].forEach((k) => {
        fd.set(k, (form[k] === undefined || form[k] === null ? true : !!Number(form[k])) ? 1 : 0);
      });
      if (logo) fd.append('logo', logo);
      return api.form(`/admin/settings/${data.id}`, fd, 'PUT');
    },
    { success: 'Settings saved', onSuccess: reload }
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
          <EmptyState icon={SettingsIcon} title="Settings row not found"
            description="The settings table should have one row. Check the DB." />
        </Card>
      </>
    );
  }

  const SaveBtn = () => (
    <Button variant="primary" icon={Save} onClick={save.run} loading={save.loading}>
      Save settings
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Site settings"
        subtitle="Business details, shipping rules and social links"
        actions={canManage && <SaveBtn />}
      />

      <div className="columns-1 lg:columns-3 gap-4">
        <SettingsSection icon={Building2} title="Business details">
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
        </SettingsSection>

        <SettingsSection icon={Truck} title="Orders & delivery">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Shipping charge (₹)" hint="Flat charge">
              <Input type="number" value={form.shipping_charge || ''} onChange={(e) => set('shipping_charge', e.target.value)} />
            </Field>
            <Field label="Free shipping above (₹)" hint="Free above this amount">
              <Input type="number" value={form.shipping_threshold || ''} onChange={(e) => set('shipping_threshold', e.target.value)} />
            </Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 items-end">
            <Field label="COD fee (₹)">
              <Input type="number" value={form.cod_fee || ''} onChange={(e) => set('cod_fee', e.target.value)} />
            </Field>
            <Checkbox label="Cash on delivery allowed" checked={!!Number(form.is_cod)}
              onChange={(e) => set('is_cod', e.target.checked ? 1 : 0)} />
          </div>
        </SettingsSection>

        <SettingsSection icon={CreditCard} title="Payment gateways">
          <div className="grid sm:grid-cols-2 gap-3">
            <Checkbox
              label="Razorpay enabled"
              checked={form.is_razorpay === undefined || form.is_razorpay === null
                ? true : !!Number(form.is_razorpay)}
              onChange={(e) => set('is_razorpay', e.target.checked ? 1 : 0)}
            />
            <Checkbox
              label="PayU enabled"
              checked={form.is_payu === undefined || form.is_payu === null
                ? true : !!Number(form.is_payu)}
              onChange={(e) => set('is_payu', e.target.checked ? 1 : 0)}
            />
          </div>
          <p className="text-2xs text-ink-500 bg-paper-sunk rounded-md p-2.5">
            Both are ON by default. A gateway switched off here will not appear at checkout,
            and the backend will reject it too. The gateway API keys must be set in the
            backend .env, otherwise it is hidden automatically.
          </p>
        </SettingsSection>

        <SettingsSection icon={Bell} title="Notifications"
          hint="Off karoge to us channel pe koi order/prescription message nahi jayega">
          <Checkbox
            label="WhatsApp notifications"
            checked={form.notify_whatsapp_enabled === undefined || form.notify_whatsapp_enabled === null
              ? true : !!Number(form.notify_whatsapp_enabled)}
            onChange={(e) => set('notify_whatsapp_enabled', e.target.checked ? 1 : 0)}
          />
          <Checkbox
            label="SMS notifications"
            checked={form.notify_sms_enabled === undefined || form.notify_sms_enabled === null
              ? true : !!Number(form.notify_sms_enabled)}
            onChange={(e) => set('notify_sms_enabled', e.target.checked ? 1 : 0)}
          />
          <Checkbox
            label="Email notifications"
            checked={form.notify_email_enabled === undefined || form.notify_email_enabled === null
              ? true : !!Number(form.notify_email_enabled)}
            onChange={(e) => set('notify_email_enabled', e.target.checked ? 1 : 0)}
          />
          <p className="text-2xs text-ink-500 bg-paper-sunk rounded-md p-2.5">
            Sirf order/prescription update jaisi customer notifications control karta hai —
            login OTP is se affect nahi hota, wo hamesha kaam karega.
          </p>
        </SettingsSection>

        <SettingsSection icon={Code2} title="Header / footer scripts"
          hint="Google Tag Manager, analytics, Meta Pixel jaise scripts — website ke <head> aur </body> se pehle inject honge">
          <Field label="Header script" hint="<head> ke andar jayega">
            <Textarea rows={4} className="font-mono" value={form.header_code || ''}
              onChange={(e) => set('header_code', e.target.value)} placeholder="<script>...</script>" />
          </Field>
          <Field label="Footer script" hint="</body> se pehle jayega">
            <Textarea rows={4} className="font-mono" value={form.footer_code || ''}
              onChange={(e) => set('footer_code', e.target.value)} placeholder="<script>...</script>" />
          </Field>
          <p className="text-2xs text-ink-500 bg-paper-sunk rounded-md p-2.5">
            Yahan jo bhi paste karoge wo seedha website me chalega (trusted admin-only field hai) —
            sirf trusted source (Google, Meta, etc.) ka code hi paste karna.
          </p>
        </SettingsSection>

        <SettingsSection icon={Share2} title="Social links">
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
        </SettingsSection>

        <SettingsSection icon={Search} title="SEO"
          hint="Default meta tags + sitemap.xml/robots.txt (auto-generated, live at the links below)">
          <Field label="Meta title" hint="Shown on Google search results and the browser tab">
            <Input value={form.meta_title || ''} onChange={(e) => set('meta_title', e.target.value)} />
          </Field>
          <Field label="Meta description">
            <Textarea rows={2} value={form.meta_description || ''} onChange={(e) => set('meta_description', e.target.value)} />
          </Field>
          <Field label="Meta keywords" hint="Comma separated">
            <Input value={form.meta_keywords || ''} onChange={(e) => set('meta_keywords', e.target.value)} />
          </Field>
          <Field label="Social share image (OG image) URL">
            <Input value={form.og_image || ''} onChange={(e) => set('og_image', e.target.value)} />
          </Field>
          <Field label="Google site verification"
            hint="Paste just the content= value from Google Search Console, if asked">
            <Input value={form.google_site_verification || ''} onChange={(e) => set('google_site_verification', e.target.value)} />
          </Field>
          <Field label="robots.txt"
            hint="Khaali chhod do to default (sab crawl karne do) use hoga">
            <Textarea rows={4} className="font-mono" value={form.robots_txt || ''} onChange={(e) => set('robots_txt', e.target.value)} />
          </Field>
          <p className="text-2xs text-ink-500 bg-paper-sunk rounded-md p-2.5 space-y-1">
            <span className="block">
              Sitemap: <code className="font-mono">{(import.meta.env.VITE_API_BASE || '').replace(/\/api\/?$/, '')}/sitemap.xml</code>
              {' '}— naya product/category add hote hi khud-ba-khud isme aa jayega, kuch karna nahi padega.
            </span>
            <span className="block">
              robots.txt: <code className="font-mono">{(import.meta.env.VITE_API_BASE || '').replace(/\/api\/?$/, '')}/robots.txt</code>
            </span>
          </p>
        </SettingsSection>
      </div>

      {canManage && (
        <div className="mt-4 max-w-5xl">
          <SaveBtn />
        </div>
      )}
    </>
  );
}