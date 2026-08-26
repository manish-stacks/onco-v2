import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, Upload, X, Package } from 'lucide-react';
import { useResource, useMutation } from '@/hooks/useApi';
import { api, mediaUrl } from '@/lib/api';
import { PageHeader } from '@/components/layout/Layout';
import {
  Card, Button, Field, Input, Textarea, Select, Checkbox, Tabs, PageLoader, cx,
} from '@/components/ui';

const TABS = [
  { value: 'basic', label: 'Basic' },
  { value: 'pricing', label: 'Pricing & stock' },
  { value: 'content', label: 'Description' },
  { value: 'media', label: 'Images' },
  { value: 'seo', label: 'SEO' },
];

const IMAGE_FIELDS = ['image_1', 'image_2', 'image_3', 'image_4', 'image_5'];

const EMPTY = {
  product_name: '', sku: '', hsn_code: '', company_name: '', brand_id: '',
  salt: '', weight_quantity: '',
  product_mrp: '', product_sp: '', product_gst: '', stock_quantity: '', low_stock_alert: '10',
  batch_number: '', expiry_date: '', allow_backorder: false,
  short_description: '', long_description: '', about_product: '', key_features: '',
  benifits: '', how_to_use: '', side_effects: '', caution: '', storage: '', specification: '',
  slug: '', meta_title: '', meta_description: '',
  presciption_required: 'No', isCOD: 1, status: 'Active',
  is_featured: '0', deal_of_the_day: '0', top_selling: '0', latest_product: '0',
  categories: [],
};

export default function ProductForm() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const isEdit = !!productId;

  const [tab, setTab] = useState('basic');
  const [form, setForm] = useState(EMPTY);
  const [files, setFiles] = useState({});

  const { data: product, loading } = useResource(isEdit ? `/admin/products/${productId}` : null);
  const { data: categories } = useResource('/admin/categories');
  const { data: brands } = useResource('/admin/brands');

  useEffect(() => {
    if (!product) return;
    setForm({
      ...EMPTY,
      ...Object.fromEntries(Object.entries(product).filter(([, v]) => v !== null)),
      expiry_date: product.expiry_date ? String(product.expiry_date).slice(0, 10) : '',
      categories: (product.categories || []).map((c) => c.category_id),
    });
  }, [product]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation(
    async () => {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (IMAGE_FIELDS.includes(k)) return; // do not resend the old image path
        if (k === 'categories') { fd.append('categories', JSON.stringify(v)); return; }
        if (v === null || v === undefined || v === '') return;
        fd.append(k, typeof v === 'boolean' ? (v ? 1 : 0) : v);
      });
      Object.entries(files).forEach(([k, file]) => { if (file) fd.append(k, file); });

      return isEdit
        ? api.form(`/admin/products/${productId}`, fd, 'PUT')
        : api.form('/admin/products', fd, 'POST');
    },
    {
      success: isEdit ? 'Product updated' : 'Product created',
      onSuccess: () => navigate('/products'),
    }
  );

  if (isEdit && loading) return <PageLoader />;

  const err = save.fieldErrors || {};

  return (
    <>
      <PageHeader
        back="/products" backLabel="Products"
        title={isEdit ? form.product_name || 'Edit product' : 'New product'}
        subtitle={isEdit ? `Product #${productId}` : 'Add a new item to the catalog'}
        actions={
          <>
            <Button onClick={() => navigate('/products')}>Cancel</Button>
            <Button variant="primary" icon={Save} onClick={save.run} loading={save.loading}>
              {isEdit ? 'Save changes' : 'Create product'}
            </Button>
          </>
        }
      />

      <Card dense>
        <Tabs tabs={TABS} value={tab} onChange={setTab} className="px-4 pt-1" />

        <div className="p-4">
          {tab === 'basic' && (
            <div className="grid sm:grid-cols-2 gap-4 max-w-3xl">
              <Field label="Product name" required error={err.product_name} className="sm:col-span-2">
                <Input value={form.product_name} onChange={(e) => set('product_name', e.target.value)}
                  placeholder="Tab. Imatinib 400mg" />
              </Field>
              <Field label="SKU" hint="Internal stock code">
                <Input mono value={form.sku} onChange={(e) => set('sku', e.target.value)} />
              </Field>
              <Field label="HSN code" hint="For GST filing">
                <Input mono value={form.hsn_code} onChange={(e) => set('hsn_code', e.target.value)} />
              </Field>
              <Field
                label="Brand / manufacturer"
                hint={form.company_name && !form.brand_id
                  ? `Old text: "${form.company_name}" — select a brand`
                  : undefined}
              >
                <Select
                  value={form.brand_id || ''} placeholder="— No brand"
                  options={(brands || []).map((b) => ({
                    value: b.id,
                    label: `${b.title} (${b.live_product_count ?? 0})`,
                  }))}
                  onChange={(e) => set('brand_id', e.target.value)}
                />
              </Field>
              <Field label="Salt / composition">
                <Input value={form.salt} onChange={(e) => set('salt', e.target.value)}
                  placeholder="Imatinib Mesylate" />
              </Field>
              <Field label="Pack size">
                <Input value={form.weight_quantity} onChange={(e) => set('weight_quantity', e.target.value)}
                  placeholder="10 tablets" />
              </Field>
              <Field label="Prescription required">
                <Select value={form.presciption_required} options={['No', 'Yes']}
                  onChange={(e) => set('presciption_required', e.target.value)} />
              </Field>

              <Field label="Categories" className="sm:col-span-2">
                <div className="flex flex-wrap gap-1.5 p-3 border border-line rounded bg-paper max-h-44 overflow-y-auto">
                  {(categories || []).map((c) => {
                    const on = form.categories.includes(c.category_id);
                    return (
                      <button
                        key={c.category_id} type="button"
                        onClick={() => set('categories', on
                          ? form.categories.filter((x) => x !== c.category_id)
                          : [...form.categories, c.category_id])}
                        className={cx(
                          'px-2.5 py-1 rounded border text-2xs transition-colors',
                          on ? 'bg-teal text-white border-teal' : 'bg-white border-line text-ink-700 hover:border-line-strong'
                        )}
                      >
                        {c.category_name}
                      </button>
                    );
                  })}
                  {!categories?.length && <p className="text-2xs text-ink-500">Create categories first.</p>}
                </div>
              </Field>

              <Field label="Status">
                <Select value={form.status} options={['Active', 'Inactive']}
                  onChange={(e) => set('status', e.target.value)} />
              </Field>

              <Field label="Flags" className="sm:col-span-2">
                <div className="flex flex-wrap gap-4 pt-1">
                  <Checkbox label="Featured" checked={form.is_featured === '1' || form.is_featured === 1}
                    onChange={(e) => set('is_featured', e.target.checked ? '1' : '0')} />
                  <Checkbox label="Top selling" checked={form.top_selling === '1' || form.top_selling === 1}
                    onChange={(e) => set('top_selling', e.target.checked ? '1' : '0')} />
                  <Checkbox label="Latest product" checked={form.latest_product === '1' || form.latest_product === 1}
                    onChange={(e) => set('latest_product', e.target.checked ? '1' : '0')} />
                  <Checkbox label="Deal of the day" checked={form.deal_of_the_day === '1' || form.deal_of_the_day === 1}
                    onChange={(e) => set('deal_of_the_day', e.target.checked ? '1' : '0')} />
                  <Checkbox label="COD allowed" checked={!!Number(form.isCOD)}
                    onChange={(e) => set('isCOD', e.target.checked ? 1 : 0)} />
                </div>
              </Field>
            </div>
          )}

          {tab === 'pricing' && (
            <div className="grid sm:grid-cols-3 gap-4 max-w-3xl">
              <Field label="MRP" required error={err.product_mrp}>
                <Input type="number" step="0.01" value={form.product_mrp}
                  onChange={(e) => set('product_mrp', e.target.value)} />
              </Field>
              <Field label="Selling price" required error={err.product_sp}
                hint={form.product_mrp && form.product_sp
                  ? `${(((form.product_mrp - form.product_sp) / form.product_mrp) * 100).toFixed(0)}% off`
                  : undefined}>
                <Input type="number" step="0.01" value={form.product_sp}
                  onChange={(e) => set('product_sp', e.target.value)} />
              </Field>
              <Field label="GST %" hint="Leave empty to use the site GST rate from Settings">
                <Input type="number" step="0.01" value={form.product_gst}
                  onChange={(e) => set('product_gst', e.target.value)} placeholder="12" />
              </Field>

              <Field
                label={isEdit ? 'Current stock' : 'Opening stock'}
                hint={isEdit ? 'Use the Inventory page to change it (for the audit trail)' : 'Opening stock'}
              >
                <Input type="number" value={form.stock_quantity} disabled={isEdit}
                  onChange={(e) => set('stock_quantity', e.target.value)} />
              </Field>
              <Field label="Low stock alert" hint="An alert is raised below this">
                <Input type="number" value={form.low_stock_alert}
                  onChange={(e) => set('low_stock_alert', e.target.value)} />
              </Field>
              <Field label="Backorder">
                <div className="pt-2">
                  <Checkbox label="Accept orders even when stock is 0"
                    checked={!!Number(form.allow_backorder)}
                    onChange={(e) => set('allow_backorder', e.target.checked ? 1 : 0)} />
                </div>
              </Field>

              <Field label="Batch number">
                <Input mono value={form.batch_number} onChange={(e) => set('batch_number', e.target.value)} />
              </Field>
              <Field label="Expiry date" hint="The expiry report is built from this">
                <Input type="date" value={form.expiry_date} onChange={(e) => set('expiry_date', e.target.value)} />
              </Field>
              <Field label="Storage">
                <Input value={form.storage} onChange={(e) => set('storage', e.target.value)}
                  placeholder="Store below 25°C" />
              </Field>
            </div>
          )}

          {tab === 'content' && (
            <div className="space-y-4 max-w-3xl">
              <Field label="Short description" hint="Shown on the listing">
                <Textarea rows={2} value={form.short_description}
                  onChange={(e) => set('short_description', e.target.value)} />
              </Field>
              <Field label="Long description" hint="Shown in the Description tab on the product page">
                <Textarea rows={4} value={form.long_description}
                  onChange={(e) => set('long_description', e.target.value)} />
              </Field>
              <Field label="About this product">
                <Textarea rows={4} value={form.about_product}
                  onChange={(e) => set('about_product', e.target.value)} />
              </Field>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Key features">
                  <Textarea rows={3} value={form.key_features} onChange={(e) => set('key_features', e.target.value)} />
                </Field>
                <Field label="Benefits">
                  <Textarea rows={3} value={form.benifits} onChange={(e) => set('benifits', e.target.value)} />
                </Field>
                <Field label="How to use">
                  <Textarea rows={3} value={form.how_to_use} onChange={(e) => set('how_to_use', e.target.value)} />
                </Field>
                <Field label="Specification" hint="Shown in the Specification tab on the product page">
                  <Textarea rows={3} value={form.specification} onChange={(e) => set('specification', e.target.value)} />
                </Field>
                <Field label="Side effects">
                  <Textarea rows={3} value={form.side_effects} onChange={(e) => set('side_effects', e.target.value)} />
                </Field>
              </div>
              <Field label="Caution / warnings">
                <Textarea rows={3} value={form.caution} onChange={(e) => set('caution', e.target.value)} />
              </Field>
            </div>
          )}

          {tab === 'media' && (
            <div>
              <p className="text-2xs text-ink-500 mb-3">
                The first image appears on the listing. JPG, PNG or WebP — up to 5MB.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 max-w-3xl">
                {IMAGE_FIELDS.map((f, i) => (
                  <ImageSlot
                    key={f}
                    label={i === 0 ? 'Main image' : `Image ${i + 1}`}
                    existing={form[f]}
                    file={files[f]}
                    onSelect={(file) => setFiles((s) => ({ ...s, [f]: file }))}
                    onClear={() => setFiles((s) => ({ ...s, [f]: null }))}
                  />
                ))}
              </div>
            </div>
          )}

          {tab === 'seo' && (
            <div className="space-y-4 max-w-2xl">
              <Field label="URL slug" hint={isEdit ? 'Changing this will break existing links' : 'Leave empty to generate it from the name'}>
                <Input mono value={form.slug} onChange={(e) => set('slug', e.target.value)}
                  placeholder="tab-imatinib-400mg" />
              </Field>
              <Field label="Meta title" hint={`${(form.meta_title || '').length}/60 characters`}>
                <Input value={form.meta_title} onChange={(e) => set('meta_title', e.target.value)} />
              </Field>
              <Field label="Meta description" hint={`${(form.meta_description || '').length}/160 characters`}>
                <Textarea rows={3} value={form.meta_description}
                  onChange={(e) => set('meta_description', e.target.value)} />
              </Field>
            </div>
          )}
        </div>
      </Card>
    </>
  );
}

function ImageSlot({ label, existing, file, onSelect, onClear }) {
  const preview = file ? URL.createObjectURL(file) : existing ? mediaUrl(existing) : null;

  return (
    <div>
      <span className="label">{label}</span>
      <label className={cx(
        'relative block aspect-square rounded border-2 border-dashed cursor-pointer transition-colors overflow-hidden',
        preview ? 'border-line bg-paper-sunk' : 'border-line hover:border-teal bg-paper'
      )}>
        <input
          type="file" accept="image/*" className="sr-only"
          onChange={(e) => e.target.files?.[0] && onSelect(e.target.files[0])}
        />
        {preview ? (
          <img src={preview} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-ink-300">
            <Upload size={16} />
            <span className="text-2xs">Upload</span>
          </span>
        )}
      </label>
      {file && (
        <button onClick={onClear}
          className="mt-1 inline-flex items-center gap-1 text-2xs text-signal-danger hover:underline">
          <X size={11} /> Remove
        </button>
      )}
    </div>
  );
}