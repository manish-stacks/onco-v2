import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Search, Plus, Minus, Trash2, ShoppingCart, PackageSearch, PhoneCall, CheckCircle2,
  BadgePercent,
} from 'lucide-react';
import { useMutation, useDebounced } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { api, mediaUrl } from '@/lib/api';
import { PERMISSIONS as P } from '@/lib/constants';
import { inr } from '@/lib/format';
import { PageHeader } from '@/components/layout/Layout';
import { Card, Button, Field, Input, Textarea, Select, Checkbox, EmptyState, Spinner } from '@/components/ui';

/**
 * POS — lets an admin create a custom order (counter / phone order).
 *
 * NOTE: customer lookup and product search use the existing admin endpoints
 * (`/admin/customers`, `/admin/products`), so no new route is needed for them.
 * Only order creation needs `/admin/pos/orders`.
 */

const PAYMENT_METHODS = [
  { value: 'Cash', label: 'Cash' },
  { value: 'UPI', label: 'UPI' },
  { value: 'Card', label: 'Card (swipe machine)' },
  { value: 'Bank Transfer', label: 'Bank transfer' },
  { value: 'COD', label: 'Cash on delivery (collect later)' },
];

const DISCOUNT_TYPES = [
  { value: 'flat', label: '₹ Flat amount' },
  { value: 'percent', label: '% Percentage' },
];

const EMPTY = {
  patient_name: '', doctor_name: '', hospital_name: '',
  customer_name: '', mobile: '', email_id: '',
  address: '', state: '', city: '', pincode: '',
  payment_method_label: '', comment: '',
  coupon_code: '', discount_type: 'flat', discount_value: '',
};

const only10 = (v) => String(v || '').replace(/\D/g, '').slice(-10);

export default function Pos() {
  const { can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY);
  const [items, setItems] = useState([]);
  const [errors, setErrors] = useState({});
  const [markPaid, setMarkPaid] = useState(true);
  const [foundCustomerId, setFoundCustomerId] = useState(null);
  const [prescriptionFiles, setPrescriptionFiles] = useState([]);

  const [search, setSearch] = useState('');
  const debounced = useDebounced(search, 350);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);


  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: '' }));
  };

  const canManage = can(P.ORDERS_MANAGE);

  // ------------------------------------------------------------ product search
  // Existing /admin/products endpoint — search by name or SKU.
  useEffect(() => {
    const q = debounced.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    let alive = true;
    setSearching(true);
    api.get('/admin/products', { search: q, status: 'Active', limit: 25, page: 1 })
      .then((res) => { if (alive) setResults(res?.data || []); })
      .catch((err) => {
        if (!alive) return;
        setResults([]);
        if (err.status !== 401) toast.error(err.message);
      })
      .finally(() => { if (alive) setSearching(false); });
    return () => { alive = false; };
  }, [debounced, toast]);

  function addItem(p) {
    setItems((list) => {
      const found = list.find((i) => i.product_id === p.product_id);
      if (found) {
        return list.map((i) => i.product_id === p.product_id
          ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...list, {
        product_id: p.product_id,
        product_name: p.product_name,
        sku: p.sku,
        image_1: p.image_1,
        product_sp: p.product_sp,
        product_gst: p.product_gst,
        stock_quantity: p.stock_quantity,
        presciption_required: p.presciption_required,
        quantity: 1,
      }];
    });
    setErrors((e) => ({ ...e, items: '' }));
    setSearch('');
    setResults([]);
  }

  function setQty(productId, qty) {
    if (qty < 1) return;
    setItems((list) => list.map((i) => i.product_id === productId ? { ...i, quantity: qty } : i));
  }

  function removeItem(productId) {
    setItems((list) => list.filter((i) => i.product_id !== productId));
  }

  // Estimate only — final pricing and discount are always computed on the server.
  // Product price is GST-inclusive, so nothing is added on top.
  const estimate = useMemo(() => {
    const subtotal = items.reduce((s, i) => s + (Number(i.product_sp) || 0) * i.quantity, 0);
    const dv = parseFloat(form.discount_value) || 0;
    const discount = form.discount_type === 'percent'
      ? Math.min((subtotal * dv) / 100, subtotal)
      : Math.min(dv, subtotal);
    return {
      subtotal,
      discount,
      total: Math.max(subtotal - discount, 0),
    };
  }, [items, form.discount_type, form.discount_value]);

  const needsPrescription = items.some((i) => i.presciption_required === 'Yes');

  // ------------------------------------------------------------ customer lookup
  // /admin/customers?search=<mobile> — find the exact number match,
  // then pull the saved address from /admin/customers/:id.
  const lookup = useMutation(
    async () => {
      const mobile = only10(form.mobile);
      if (mobile.length !== 10) {
        setErrors((e) => ({ ...e, mobile: 'Please enter a valid 10-digit mobile number' }));
        return null;
      }

      const res = await api.get('/admin/customers', { search: mobile, limit: 10, page: 1 });
      const match = (res?.data || []).find((c) => only10(c.mobile) === mobile);
      if (!match) return { found: false };

      let profile = null;
      try {
        const d = await api.get(`/admin/customers/${match.customer_id}`);
        profile = d?.data || null;
      } catch {
        /* if the profile fails we still fill in the basic details */
      }
      return { found: true, customer: match, profile };
    },
    {
      onSuccess: (res) => {
        if (!res) return;
        if (!res.found) {
          setFoundCustomerId(null);
          toast.success('New customer — an account will be created with this order');
          return;
        }

        const c = res.customer;
        const p = res.profile;
        const a = p?.addresses?.find((x) => Number(x.is_default)) || p?.addresses?.[0] || null;

        setFoundCustomerId(c.customer_id);
        setForm((f) => ({
          ...f,
          customer_name: f.customer_name || c.customer_name || '',
          email_id: f.email_id || c.email_id || '',
          address: f.address
            || (a ? [a.house_no, a.stree_address, a.landmark].filter(Boolean).join(', ') : p?.address || ''),
          city: f.city || a?.city || c.city || '',
          state: f.state || a?.state || c.state || '',
          pincode: f.pincode || a?.pincode || c.pincode || '',
        }));
        toast.success(`Customer found — ${c.order_count || 0} previous orders`);
      },
    }
  );

  // ------------------------------------------------------------------- submit
  const create = useMutation(
    () => {
      const fd = new FormData();
      if (foundCustomerId) fd.append('customer_id', foundCustomerId);
      fd.append('customer', JSON.stringify({
        mobile: only10(form.mobile),
        customer_name: form.customer_name,
        email_id: form.email_id || null,
      }));
      fd.append('patient_name', form.patient_name || form.customer_name);
      if (form.doctor_name) fd.append('doctor_name', form.doctor_name);
      if (form.hospital_name) fd.append('hospital_name', form.hospital_name);
      fd.append('address', form.address);
      fd.append('city', form.city);
      fd.append('state', form.state);
      fd.append('pincode', form.pincode);
      fd.append('items', JSON.stringify(items.map((i) => ({ product_id: i.product_id, quantity: i.quantity }))));
      if (form.coupon_code) fd.append('coupon_code', form.coupon_code);
      fd.append('discount_type', form.discount_type);
      fd.append('discount_value', parseFloat(form.discount_value) || 0);
      fd.append('payment_mode', form.payment_method_label === 'COD' ? 'cod' : 'online');
      fd.append('payment_method_label', form.payment_method_label || 'Cash');
      fd.append('mark_paid', form.payment_method_label === 'COD' ? false : markPaid);
      if (form.comment) fd.append('comment', form.comment);
      prescriptionFiles.forEach((f) => fd.append('prescription_images', f));
      return api.form('/admin/pos/orders', fd, 'POST');
    },
    {
      success: 'POS order created',
      onSuccess: (res) => {
        const id = res?.data?.order?.order_id;
        setForm(EMPTY);
        setItems([]);
        setFoundCustomerId(null);
        setPrescriptionFiles([]);
        if (id) navigate(`/orders/${id}`);
      },
      onError: (err) => {
        if (err.errors) setErrors(err.errors);
        if (err.status === 404) {
          toast.error('POS route not found on the backend — deploy the backend and restart PM2');
        }
      },
    }
  );

  function validate() {
    const e = {};
    if (!/^[6-9]\d{9}$/.test(only10(form.mobile))) {
      e.mobile = 'Please enter a valid 10-digit mobile number';
    }
    if (!form.customer_name.trim()) e.customer_name = 'Customer name is required';
    if (!form.address.trim()) e.address = 'Address is required';
    if (!form.city.trim()) e.city = 'City is required';
    if (!form.state.trim()) e.state = 'State is required';
    if (!/^\d{6}$/.test(String(form.pincode || ''))) e.pincode = 'Please enter a valid 6-digit PIN code';
    if (!items.length) e.items = 'Add at least one product';
    if (!form.payment_method_label) e.payment_method_label = 'Select a payment method';
    if (needsPrescription && !form.patient_name.trim()) {
      e.patient_name = 'Patient name is required for prescription medicines';
    }
    const dv = parseFloat(form.discount_value);
    if (form.discount_value !== '' && (Number.isNaN(dv) || dv < 0)) {
      e.discount_value = 'Discount cannot be negative';
    }
    if (form.discount_type === 'percent' && dv > 100) {
      e.discount_value = 'Percentage cannot be more than 100';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function submit() {
    if (!validate()) {
      toast.error('Please fix the highlighted fields');
      return;
    }
    create.run();
  }

  if (!canManage) {
    return (
      <>
        <PageHeader title="POS" />
        <Card dense>
          <EmptyState icon={ShoppingCart} title="Not allowed"
            description="You need the orders.manage permission to create POS orders." />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={<span className="flex items-center gap-2"><User size={20} className="text-teal" /> Add order</span>}
        subtitle="Counter / phone order — linked to the customer's number, so they can see it after logging in"
        actions={(
          <Button variant="primary" icon={CheckCircle2} loading={create.loading} onClick={submit}>
            Create order
          </Button>
        )}
      />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Customer + patient details */}
          <Card title="Customer & patient details" dense>
            <div className="p-4 space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Phone Number" error={errors.mobile} required>
                  <div className="flex gap-2">
                    <Input
                      value={form.mobile}
                      onChange={(e) => { set('mobile', e.target.value); setFoundCustomerId(null); }}
                      placeholder="10-digit mobile"
                      inputMode="numeric"
                    />
                    <Button icon={PhoneCall} loading={lookup.loading} onClick={() => lookup.run()}>
                      Find
                    </Button>
                  </div>
                </Field>
                <Field label="Customer Name" error={errors.customer_name} required>
                  <Input value={form.customer_name} onChange={(e) => set('customer_name', e.target.value)} />
                </Field>
              </div>

              {foundCustomerId && (
                <p className="text-2xs text-ink-500">
                  Existing customer #{foundCustomerId} — the order will be linked to this account.
                </p>
              )}

              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Patient Name" error={errors.patient_name}
                  hint={needsPrescription ? 'Required — the cart has prescription medicine' : undefined}>
                  <Input value={form.patient_name} onChange={(e) => set('patient_name', e.target.value)} />
                </Field>
                <Field label="Doctor Name">
                  <Input value={form.doctor_name} onChange={(e) => set('doctor_name', e.target.value)} />
                </Field>
                <Field label="Hospital Name">
                  <Input value={form.hospital_name} onChange={(e) => set('hospital_name', e.target.value)} />
                </Field>
                <Field label="Email">
                  <Input type="email" value={form.email_id} onChange={(e) => set('email_id', e.target.value)} />
                </Field>
              </div>

              <Field
                label="Prescription"
                hint={needsPrescription
                  ? "Required — the cart has prescription medicine. It's auto-approved since it's verified in person"
                  : "Optional — photo of the prescription, if the customer has one"}
              >
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  onChange={(e) => setPrescriptionFiles(Array.from(e.target.files || []))}
                  className="block w-full text-xs text-ink-500 file:mr-3 file:rounded-md file:border-0 file:bg-paper-sunk file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-teal"
                />
                {prescriptionFiles.length > 0 && (
                  <p className="mt-1 text-2xs text-ink-500">{prescriptionFiles.length} file(s) selected</p>
                )}
              </Field>

              <Field label="Address" error={errors.address} required>
                <Textarea rows={3} value={form.address} onChange={(e) => set('address', e.target.value)} />
              </Field>

              <div className="grid sm:grid-cols-3 gap-3">
                <Field label="State" error={errors.state} required>
                  <Input value={form.state} onChange={(e) => set('state', e.target.value)} />
                </Field>
                <Field label="City" error={errors.city} required>
                  <Input value={form.city} onChange={(e) => set('city', e.target.value)} />
                </Field>
                <Field label="PIN Code" error={errors.pincode} required>
                  <Input value={form.pincode} onChange={(e) => set('pincode', e.target.value)} inputMode="numeric" />
                </Field>
              </div>
            </div>
          </Card>

          {/* Products */}
          <Card title="Products" subtitle="Search by name or SKU (at least 2 characters)" dense>
            <div className="p-4">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search products…"
                  className="w-full h-10 pl-9 pr-9 text-sm rounded-md border border-line outline-none focus:border-teal"
                />
                {searching && <Spinner size={14} className="absolute right-3 top-1/2 -translate-y-1/2" />}
              </div>

              {!searching && debounced.trim().length >= 2 && results.length === 0 && (
                <p className="mt-2 text-2xs text-ink-500">
                  No active product found for “{debounced.trim()}”.
                </p>
              )}

              {results.length > 0 && (
                <div className="mt-2 max-h-64 overflow-y-auto rounded-md border border-line divide-y divide-line">
                  {results.map((p) => (
                    <button
                      key={p.product_id}
                      type="button"
                      onClick={() => addItem(p)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-paper-sunk"
                    >
                      {p.image_1 && (
                        <img src={mediaUrl(p.image_1)} alt="" className="h-9 w-9 rounded object-cover border border-line" />
                      )}
                      <span className="flex-1 min-w-0">
                        <span className="block truncate text-[0.8125rem] text-ink">{p.product_name}</span>
                        <span className="block text-2xs text-ink-500">
                          {p.sku || '—'} · stock {p.stock_quantity ?? 0}
                          {p.presciption_required === 'Yes' && ' · Rx'}
                        </span>
                      </span>
                      <span className="text-[0.8125rem] tabular-nums font-semibold">{inr(p.product_sp)}</span>
                      <Plus size={14} className="text-teal" />
                    </button>
                  ))}
                </div>
              )}

              {errors.items && <p className="mt-2 text-2xs text-signal-danger">{errors.items}</p>}

              {items.length === 0 ? (
                <div className="mt-4">
                  <EmptyState icon={PackageSearch} title="No product added yet"
                    description="Search above and click a product to add it to this order." />
                </div>
              ) : (
                <table className="mt-4 w-full text-[0.8125rem]">
                  <thead>
                    <tr className="text-left text-2xs uppercase text-ink-500 border-b border-line">
                      <th className="py-2">Product</th>
                      <th className="py-2 w-32">Qty</th>
                      <th className="py-2 text-right w-28">Price</th>
                      <th className="py-2 text-right w-28">Line</th>
                      <th className="py-2 w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {items.map((i) => (
                      <tr key={i.product_id}>
                        <td className="py-2 pr-2">
                          <span className="block text-ink">{i.product_name}</span>
                          <span className="block text-2xs text-ink-500">{i.sku || '—'}</span>
                        </td>
                        <td className="py-2">
                          <div className="inline-flex items-center gap-1 rounded-md border border-line">
                            <button type="button" className="px-2 py-1 text-ink-500 hover:text-ink"
                              onClick={() => setQty(i.product_id, i.quantity - 1)}>
                              <Minus size={12} />
                            </button>
                            <span className="w-8 text-center tabular-nums">{i.quantity}</span>
                            <button type="button" className="px-2 py-1 text-ink-500 hover:text-ink"
                              onClick={() => setQty(i.product_id, i.quantity + 1)}>
                              <Plus size={12} />
                            </button>
                          </div>
                        </td>
                        <td className="py-2 text-right tabular-nums">{inr(i.product_sp)}</td>
                        <td className="py-2 text-right tabular-nums font-semibold">
                          {inr((Number(i.product_sp) || 0) * i.quantity)}
                        </td>
                        <td className="py-2 text-right">
                          <button type="button" onClick={() => removeItem(i.product_id)}
                            className="text-ink-300 hover:text-signal-danger">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Discount */}
          <Card
            title={<span className="flex items-center gap-2"><BadgePercent size={15} className="text-teal" /> Discount</span>}
            subtitle="Manual discount or coupon code"
            dense
          >
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Type">
                  <Select
                    value={form.discount_type}
                    onChange={(e) => set('discount_type', e.target.value)}
                    options={DISCOUNT_TYPES}
                  />
                </Field>
                <Field label={form.discount_type === 'percent' ? 'Percent (%)' : 'Amount (₹)'}
                  error={errors.discount_value}>
                  <Input
                    type="number"
                    min="0"
                    step={form.discount_type === 'percent' ? '0.5' : '1'}
                    value={form.discount_value}
                    onChange={(e) => set('discount_value', e.target.value)}
                    placeholder="0"
                  />
                </Field>
              </div>

              <Field label="Coupon code" hint="Optional — validated on the server">
                <Input
                  value={form.coupon_code}
                  onChange={(e) => set('coupon_code', e.target.value.toUpperCase())}
                  placeholder="e.g. WELCOME10"
                  mono
                />
              </Field>

              {estimate.discount > 0 && (
                <p className="text-2xs text-signal-ok">
                  {form.discount_type === 'percent'
                    ? `${parseFloat(form.discount_value) || 0}% = ${inr(estimate.discount)} off`
                    : `${inr(estimate.discount)} off`}
                </p>
              )}
            </div>
          </Card>

          <Card title="Payment" dense>
            <div className="p-4 space-y-3">
              <Field label="Payment Method" error={errors.payment_method_label} required>
                <Select
                  value={form.payment_method_label}
                  onChange={(e) => set('payment_method_label', e.target.value)}
                  options={PAYMENT_METHODS}
                  placeholder="Select Payment Method"
                />
              </Field>

              {form.payment_method_label && form.payment_method_label !== 'COD' && (
                <Checkbox
                  label="Payment received — mark this order as Paid"
                  checked={markPaid}
                  onChange={(e) => setMarkPaid(e.target.checked)}
                />
              )}
              {form.payment_method_label === 'COD' && (
                <p className="text-2xs text-ink-500">
                  The order stays Unpaid — update the payment after delivery.
                </p>
              )}

              <Field label="Internal note">
                <Textarea rows={2} value={form.comment} onChange={(e) => set('comment', e.target.value)}
                  placeholder="Optional — who placed the order and how" />
              </Field>
            </div>
          </Card>

          <Card title="Estimate" subtitle="The final amount is calculated on the server" dense>
            <div className="p-4 space-y-2 text-[0.8125rem]">
              <div className="flex justify-between text-ink-500">
                <span>Subtotal</span><span className="tabular-nums">{inr(estimate.subtotal)}</span>
              </div>
              {estimate.discount > 0 && (
                <div className="flex justify-between text-signal-ok">
                  <span>Discount</span><span className="tabular-nums">− {inr(estimate.discount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-line pt-2 font-semibold text-ink">
                <span>Total</span><span className="tabular-nums">{inr(estimate.total)}</span>
              </div>
              <p className="pt-1 text-2xs text-ink-500">
                Shipping, COD fee and coupon are added on the server to produce the final amount.
              </p>

              <Button variant="primary" className="w-full mt-3" icon={CheckCircle2}
                loading={create.loading} onClick={submit}>
                Create order
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
