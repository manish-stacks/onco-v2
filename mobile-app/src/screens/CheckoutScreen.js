import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import {
  AppHeader,
  Card,
  Divider,
  Field,
  Loader,
  PrimaryButton,
  Row,
  StickyBottom,
} from '../components/ui';
import { colors, radius } from '../theme';
import { orderApi, prescriptionApi } from '../api';
import { money, num } from '../utils/format';
import { useCart } from '../store/CartContext';
import { useAuth } from '../store/AuthContext';
import { useToast } from '../store/ToastContext';

export default function CheckoutScreen({ route, navigation }) {
  const { address, paymentChoice, prescription } = route.params || {};
  const { cart, coupon, refresh } = useCart();
  const { customer } = useAuth();
  const toast = useToast();

  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [choice, setChoice] = useState(paymentChoice || null);
  const [rxFields, setRxFields] = useState({
    patient_name: prescription?.patient_name || '',
    doctor_name: prescription?.doctor_name || '',
    hospital_name: prescription?.hospital_name || '',
  });

  // Whenever the user explicitly picks a method on the Payment screen, it comes
  // back here via route.params — sync it into local state.
  useEffect(() => {
    if (paymentChoice) setChoice(paymentChoice);
  }, [paymentChoice]);

  // Auto-select a default payment method as soon as Checkout opens, so
  // "Place Order" is enabled immediately instead of forcing the user to open
  // the Payment screen first. Mirrors the same default logic PaymentMethodScreen uses.
  useEffect(() => {
    if (choice) return;
    (async () => {
      try {
        const data = await orderApi.gateways();
        const list = data?.available || [];
        const def = data?.default && list.some((g) => g.id === data.default) ? data.default : list[0]?.id;
        if (def) setChoice({ payment_mode: 'online', payment_gateway: def });
        else if (data?.cod_enabled) setChoice({ payment_mode: 'cod' });
      } catch {
        /* leave unset — user can still pick manually */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (prescription) {
      setRxFields({
        patient_name: prescription.patient_name || '',
        doctor_name: prescription.doctor_name || '',
        hospital_name: prescription.hospital_name || '',
      });
    }
  }, [prescription?.prescription_id]);

  const requiresRx = !!cart?.summary?.requires_prescription;

  const loadQuote = useCallback(async () => {
    try {
      const q = await orderApi.quote({
        coupon_code: coupon?.code,
        payment_mode: choice?.payment_mode || 'online',
      });
      setQuote(q);
    } catch (e) {
      toast.show(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [coupon?.code, choice?.payment_mode]);

  useEffect(() => {
    loadQuote();
  }, [loadQuote]);

  const place = async () => {
    if (!address) return toast.show('Please select a delivery address', 'error');
    if (!choice) return toast.show('Please choose a payment method', 'error');
    if (requiresRx) {
      if (!prescription) return toast.show('Please attach a prescription for this order', 'error');
      if (!rxFields.patient_name.trim() || !rxFields.doctor_name.trim() || !rxFields.hospital_name.trim()) {
        return toast.show('Please fill in patient, doctor and hospital name', 'error');
      }
      // Save these onto the prescription itself (not just this order) so the
      // prescription list + dashboard show the complete details from now on —
      // same fix as the website checkout.
      if (!prescription.patient_name || !prescription.doctor_name || !prescription.hospital_name) {
        prescriptionApi
          .update(prescription.prescription_id, {
            patient_name: rxFields.patient_name,
            doctor_name: rxFields.doctor_name,
            hospital_name: rxFields.hospital_name,
          })
          .catch(() => { /* non-critical — the order still carries these details either way */ });
      }
    }

    setPlacing(true);
    try {
      const payload = {
        customer_name: address.full_name || customer?.customer_name,
        customer_phone: address.phone || customer?.mobile,
        customer_email: customer?.email_id || undefined,
        customer_address: [address.house_no, address.stree_address, address.landmark].filter(Boolean).join(', '),
        customer_city: address.city,
        customer_state: address.state,
        customer_pincode: address.pincode,
        customer_country: address.country || 'India',
        shipping_same_as_billing: true,
        payment_mode: choice.payment_mode,
        payment_gateway: choice.payment_gateway,
        coupon_code: coupon?.code,
        prescription_id: prescription?.prescription_id,
        patient_name: rxFields.patient_name || undefined,
        doctor_name: rxFields.doctor_name || undefined,
        hospital_name: rxFields.hospital_name || undefined,
      };

      const result = await orderApi.checkout(payload);
      const order = result?.order;
      const payment = result?.payment;

      // COD without an advance needs no gateway; COD with an advance continues
      // into the same payment gateway screen as an online order.
      if (!payment) {
        await refresh();
        navigation.replace('OrderSuccess', { order });
        return;
      }

      navigation.replace('PaymentGateway', { order, payment });
    } catch (e) {
      toast.show(e.message, 'error');
    } finally {
      setPlacing(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <AppHeader title="Checkout" back />
        <Loader />
      </Screen>
    );
  }

  const total = num(quote?.total, num(cart?.summary?.total));
  const totalMrp = (cart?.items || []).reduce(
    (s, i) => s + (num(i.product_mrp) || num(i.product_sp)) * num(i.product_quantity, 1),
    0
  );
  const mrpDiscount = Math.max(totalMrp - num(quote?.subtotal, num(cart?.summary?.subtotal)), 0);
  const itemNames = (cart?.items || []).map((i) => i.product_name);
  // COD: advance is paid online first, the rest on delivery.
  const codAdvance = choice?.payment_mode === 'cod' ? Math.min(num(quote?.cod_advance), total) : 0;
  const codBalance = Math.max(total - codAdvance, 0);

  return (
    <Screen>
      <AppHeader title="Checkout" back />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 20 }}>
        {/* Address */}
        <Card>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>Deliver to {address?.type || 'this address'}</Text>
            <Pressable onPress={() => navigation.navigate('AddressList', { mode: 'checkout' })} hitSlop={6}>
              <Text style={styles.change}>Change</Text>
            </Pressable>
          </View>
          <Text style={styles.cardBody}>
            {address?.full_name} · {address?.phone}
          </Text>
          <Text style={styles.cardBody}>
            {[address?.house_no, address?.stree_address, address?.city, address?.state]
              .filter(Boolean)
              .join(', ')}{' '}
            - {address?.pincode}
          </Text>
        </Card>

        {/* Items */}
        <Pressable onPress={() => navigation.goBack()}>
          <Card>
            <Text style={styles.cardTitle}>
              {cart?.summary?.item_count || 0} item(s) · {cart?.summary?.total_quantity || 0} units
            </Text>
            <Text style={styles.cardBody} numberOfLines={2}>
              {itemNames.slice(0, 3).join(', ')}
              {itemNames.length > 3 ? ` +${itemNames.length - 3} more` : ''}
            </Text>
          </Card>
        </Pressable>

        {/* Prescription */}
        {requiresRx ? (
          <Card style={styles.rxCard}>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>Prescription</Text>
              <Pressable
                onPress={() => navigation.navigate('RxManage', { pick: true, returnTo: 'Checkout' })}
                hitSlop={6}
              >
                <Text style={styles.change}>{prescription ? 'Change' : 'Attach'}</Text>
              </Pressable>
            </View>
            {prescription ? (
              <Text style={styles.cardBody}>
                {prescription.reference_code || `#${prescription.prescription_id}`} attached
              </Text>
            ) : (
              <Text style={styles.rxWarn}>
                Your cart has prescription medicines. Attach one now, or our pharmacist will contact you after the
                order.
              </Text>
            )}
            {(!prescription?.patient_name || !prescription?.doctor_name || !prescription?.hospital_name) && (
              <>
                <Divider />
                <Field
                  label="Patient name"
                  value={rxFields.patient_name}
                  onChangeText={(v) => setRxFields((f) => ({ ...f, patient_name: v }))}
                  placeholder="Patient full name"
                />
                <Field
                  label="Doctor name"
                  value={rxFields.doctor_name}
                  onChangeText={(v) => setRxFields((f) => ({ ...f, doctor_name: v }))}
                  placeholder="Dr. Name"
                />
                <Field
                  label="Hospital / Clinic"
                  value={rxFields.hospital_name}
                  onChangeText={(v) => setRxFields((f) => ({ ...f, hospital_name: v }))}
                  placeholder="Hospital name"
                  style={{ marginBottom: -12 }}
                />
              </>
            )}
          </Card>
        ) : null}

        {/* Payment */}
        <Pressable
          onPress={() =>
            navigation.navigate('PaymentMethod', {
              amount: total,
              codAllowed: quote?.cod_allowed !== false,
              codAdvance: num(quote?.cod_advance),
              selected: choice,
            })
          }
        >
          <Card>
            <View style={styles.cardHead}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="wallet-outline" size={16} color={colors.text} />
                <Text style={styles.cardTitle}>Payment method</Text>
              </View>
              <Text style={styles.change}>{choice ? 'Change' : 'Select'}</Text>
            </View>
            <Text style={styles.cardBody}>
              {!choice
                ? 'Choose how you want to pay'
                : choice.payment_mode === 'cod'
                  ? codAdvance > 0
                    ? `Cash on Delivery · ${money(codAdvance)} advance now`
                    : 'Cash on Delivery'
                  : `Pay online · ${choice.payment_gateway}`}
            </Text>
          </Card>
        </Pressable>

        {/* Bill */}
        <Card>
          <Row left="Total MRP" right={money(totalMrp)} />
          {mrpDiscount > 0 ? (
            <Row left="Discount on MRP" right={`- ${money(mrpDiscount)}`} rightColor={colors.primaryDark} />
          ) : null}
          {num(quote?.coupon?.discount) > 0 ? (
            <Row
              left={`Coupon (${quote?.coupon?.code})`}
              right={`- ${money(quote?.coupon?.discount)}`}
              rightColor={colors.primaryDark}
            />
          ) : null}
          <Row left="Delivery" right={num(quote?.shipping_charge) > 0 ? money(quote?.shipping_charge) : 'Free'} />
          {num(quote?.cod_fee) > 0 ? <Row left="COD fee" right={money(quote?.cod_fee)} /> : null}
          <Divider />
          <Row left={codAdvance > 0 ? 'Order total' : 'To pay'} right={money(total)} bold />
          {codAdvance > 0 ? (
            <>
              <Row left="Pay now (advance)" right={money(codAdvance)} />
              <Row left="Pay on delivery" right={money(codBalance)} bold />
            </>
          ) : null}
        </Card>
      </ScrollView>

      <StickyBottom>
        <PrimaryButton
          title={codAdvance > 0 ? `Pay ${money(codAdvance)} & Place Order` : `Place Order · ${money(total)}`}
          onPress={place}
          loading={placing}
          disabled={!choice || !address || (requiresRx && !prescription)}
        />
      </StickyBottom>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardTitle: { fontSize: 12.5, fontWeight: '700', color: colors.text },
  cardBody: { fontSize: 11.5, color: colors.muted, marginTop: 3, lineHeight: 17 },
  change: { fontSize: 11.5, color: colors.primary, fontWeight: '700' },
  rxCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm },
  rxWarn: { fontSize: 11.5, color: colors.warn, marginTop: 4, lineHeight: 17 },
});
