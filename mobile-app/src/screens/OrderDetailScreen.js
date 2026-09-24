import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Screen from '../components/Screen';
import {
  AppHeader,
  Card,
  Divider,
  EmptyState,
  Loader,
  OutlineButton,
  PrimaryButton,
  Row,
  SectionTitle,
  StatusPill,
} from '../components/ui';
import { colors, radius } from '../theme';
import { orderApi } from '../api';
import { mediaUrl } from '../api/client';
import { formatDate, money, num } from '../utils/format';
import { useCart } from '../store/CartContext';
import { useToast } from '../store/ToastContext';
import { goTab, TABS } from '../utils/nav';

const CANCELLABLE = ['New', 'Pending', 'Processing', 'Packed'];

// --- Feature flags ---------------------------------------------------------
// Cancel-order is hidden for now. Flip this back to `true` whenever it's
// ready to ship again — no other code needs to change.
const CANCEL_ORDER_ENABLED = false;

// A failed online payment can only be retried within this window (minutes)
// after the order was placed. After it expires, the "Retry payment" button
// disappears and the customer is pointed to reorder instead.
const RETRY_PAYMENT_WINDOW_MINUTES = 30;

export default function OrderDetailScreen({ route, navigation }) {
  const { orderId, reorder: autoReorder } = route.params || {};
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const { refresh } = useCart();
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      setOrder(await orderApi.detail(orderId));
    } catch (e) {
      toast.show(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const cancel = () =>
    Alert.alert('Cancel order', 'Are you sure you want to cancel this order?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, cancel',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await orderApi.cancel(orderId, 'Cancelled from the app');
            toast.show('Order cancelled', 'success');
            load();
          } catch (e) {
            toast.show(e.message, 'error');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);

  const reorder = async () => {
    setBusy(true);
    try {
      const preview = await orderApi.reorder(orderId, false);
      const proceed = async () => {
        const res = await orderApi.reorder(orderId, true);
        await refresh();
        toast.show(res.added_count ? 'Items added to your cart' : 'None of these items are in stock', 'success');
        if (res.added_count) goTab(navigation, TABS.cart);
      };
      if (preview.all_out_of_stock) {
        toast.show('None of these items are in stock right now', 'error');
      } else if (preview.any_out_of_stock) {
        Alert.alert(
          'Some items unavailable',
          preview.items
            .filter((i) => !i.available)
            .map((i) => `${i.name} — ${i.reason}`)
            .join('\n'),
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Add the rest', onPress: proceed },
          ]
        );
      } else {
        await proceed();
      }
    } catch (e) {
      toast.show(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  // Came here from the Orders list "Reorder" chip — fire it once, then clear
  // the param so refocusing this screen later doesn't reorder again.
  useEffect(() => {
    if (autoReorder) {
      navigation.setParams({ reorder: undefined });
      reorder();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoReorder]);

  const retryPayment = async () => {
    setBusy(true);
    try {
      const res = await orderApi.retryPayment(orderId);
      navigation.navigate('PaymentGateway', {
        order,
        payment: { gateway: 'razorpay', razorpay: res.razorpay },
      });
    } catch (e) {
      toast.show(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <AppHeader title="Order" back />
        <Loader />
      </Screen>
    );
  }

  if (!order) {
    return (
      <Screen>
        <AppHeader title="Order" back />
        <EmptyState icon="alert-circle-outline" title="Order not found" />
      </Screen>
    );
  }

  const hasCodAdvance = String(order.payment_mode).toLowerCase() === 'cod' && num(order.cod_advance_amount) > 0;
  const codAdvancePaid = hasCodAdvance && Number(order.cod_advance_paid) === 1;
  const unpaid = order.payment_status !== 'Paid'
    && (String(order.payment_mode).toLowerCase() !== 'cod' || (hasCodAdvance && !codAdvancePaid));
  const minutesSinceOrder = order.order_date ? (Date.now() - new Date(order.order_date).getTime()) / 60000 : Infinity;
  const canRetryPayment = unpaid && minutesSinceOrder <= RETRY_PAYMENT_WINDOW_MINUTES;
  const retryExpired = unpaid && !canRetryPayment;

  return (
    <Screen>
      <AppHeader title={`#${order.databaseOrderID || order.order_id}`} back />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 24 }}>
        <Card>
          <View style={styles.top}>
            <Text style={styles.title}>Order status</Text>
            <StatusPill status={order.status} />
          </View>
          <Text style={styles.meta}>Placed on {formatDate(order.order_date, true)}</Text>
          <Text style={styles.meta}>
            Payment: {order.payment_mode?.toUpperCase()} · {order.payment_status}
          </Text>
          {order.awb_number ? (
            <Text style={styles.meta}>
              {order.courier_name} · AWB {order.awb_number}
            </Text>
          ) : null}
        </Card>

        <SectionTitle title={`Items (${order.items?.length || 0})`} />
        {(order.items || []).map((item) => (
          <Card key={String(item.item_id || item.product_id)} style={styles.item}>
            <View style={styles.thumb}>
              {item.product_image ? (
                <Image source={{ uri: mediaUrl(item.product_image) }} style={styles.thumbImg} resizeMode="contain" />
              ) : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName} numberOfLines={2}>
                {item.product_name}
              </Text>
              <Text style={styles.itemMeta}>
                {item.unit_quantity} × {money(item.unit_price)}
              </Text>
            </View>
            <Text style={styles.itemTotal}>{money(item.line_total)}</Text>
          </Card>
        ))}

        <SectionTitle title="Delivery address" />
        <Card>
          <Text style={styles.addrName}>{order.customer_shipping_name || order.customer_name}</Text>
          <Text style={styles.meta}>
            {order.customer_shipping_address || order.customer_address}
            {'\n'}
            {[
              order.customer_shipping_city || order.customer_city,
              order.customer_shipping_state || order.customer_state,
              order.customer_shipping_pincode || order.customer_pincode,
            ]
              .filter(Boolean)
              .join(', ')}
          </Text>
          <Text style={styles.meta}>Phone: {order.customer_shipping_phone || order.customer_phone}</Text>
        </Card>

        <SectionTitle title="Bill details" />
        <Card>
          <Row left="Item total" right={money(order.subtotal)} />
          <Row left="GST" right={money(order.order_gst)} />
          {num(order.coupon_discount) > 0 ? (
            <Row
              left={`Coupon (${order.coupon_code})`}
              right={`- ${money(order.coupon_discount)}`}
              rightColor={colors.primaryDark}
            />
          ) : null}
          <Row left="Delivery" right={num(order.shipping_charge) > 0 ? money(order.shipping_charge) : 'Free'} />
          {num(order.additional_charge) > 0 ? <Row left="COD fee" right={money(order.additional_charge)} /> : null}
          <Divider />
          <Row left="Total" right={money(order.amount)} bold />
          {hasCodAdvance ? (
            <>
              <Row left={codAdvancePaid ? 'Advance paid online' : 'Advance (payment pending)'} right={money(order.cod_advance_amount)} />
              {codAdvancePaid ? <Row left="Pay on delivery" right={money(order.cod_balance_due ?? 0)} bold /> : null}
            </>
          ) : null}
        </Card>

        <View style={{ gap: 10, marginTop: 6 }}>
          {canRetryPayment ? <PrimaryButton title="Retry payment" onPress={retryPayment} loading={busy} /> : null}
          {retryExpired ? (
            <Text style={styles.retryExpired}>
              The window to retry this payment has closed. Please reorder these items instead.
            </Text>
          ) : null}
          <OutlineButton title="Track order" onPress={() => navigation.navigate('Tracking', { orderId })} />
          <OutlineButton title="Reorder these items" onPress={reorder} disabled={busy} />
          {CANCEL_ORDER_ENABLED && CANCELLABLE.includes(order.status) ? (
            <OutlineButton
              title="Cancel order"
              onPress={cancel}
              style={{ borderColor: colors.accent }}
              textStyle={{ color: colors.accent }}
            />
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  retryExpired: { fontSize: 11.5, color: colors.muted, textAlign: 'center', paddingHorizontal: 6 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 13, fontWeight: '700', color: colors.text },
  meta: { fontSize: 11.5, color: colors.muted, marginTop: 4, lineHeight: 17 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thumb: {
    width: 46,
    height: 46,
    borderRadius: radius.xs,
    backgroundColor: colors.primaryLight,
    overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  itemName: { fontSize: 12, fontWeight: '600', color: colors.text },
  itemMeta: { fontSize: 10.5, color: colors.muted, marginTop: 3 },
  itemTotal: { fontSize: 12, fontWeight: '700', color: colors.text },
  addrName: { fontSize: 12.5, fontWeight: '700', color: colors.text },
});
