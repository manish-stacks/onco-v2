import React, { useCallback, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Screen from '../components/Screen';
import {
  AppHeader,
  Card,
  Divider,
  EmptyState,
  Loader,
  PrimaryButton,
  QtyStepper,
  Row,
  StickyBottom,
} from '../components/ui';
import { colors, radius } from '../theme';
import { mediaUrl } from '../api/client';
import { money, num } from '../utils/format';
import { useCart } from '../store/CartContext';
import { useAuth } from '../store/AuthContext';
import { useSettings } from '../store/SettingsContext';
import { useToast } from '../store/ToastContext';
import { goTab, TABS } from '../utils/nav';

export default function CartScreen({ navigation }) {
  const { cart, loading, refresh, updateQty, remove, coupon, setCoupon } = useCart();
  const { isLoggedIn } = useAuth();
  const { settings } = useSettings();
  const toast = useToast();
  const [busyId, setBusyId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (isLoggedIn) refresh();
    }, [isLoggedIn, refresh])
  );

  if (!isLoggedIn) {
    return (
      <Screen>
        <AppHeader title="My Cart" />
        <EmptyState
          icon="cart-outline"
          title="Log in to see your cart"
          subtitle="Your cart is saved to your account so you can pick up where you left off."
          actionTitle="Log in"
          onAction={() => navigation.navigate('Login')}
        />
      </Screen>
    );
  }

  if (loading && !cart.items.length) {
    return (
      <Screen>
        <AppHeader title="My Cart" />
        <Loader />
      </Screen>
    );
  }

  if (!cart.items.length) {
    return (
      <Screen>
        <AppHeader title="My Cart" />
        <EmptyState
          icon="cart-outline"
          title="Your cart is empty"
          subtitle="Browse our catalogue and add the medicines you need."
          actionTitle="Start shopping"
          onAction={() => goTab(navigation, TABS.home)}
        />
      </Screen>
    );
  }

  const summary = cart.summary || {};
  const shippingThreshold = num(settings?.shipping_threshold, 0);
  const shippingCharge = num(settings?.shipping_charge, 0);
  const shipping =
    shippingThreshold && num(summary.subtotal) >= shippingThreshold ? 0 : shippingCharge;
  const discount = num(coupon?.discount, 0);
  const payable = Math.max(num(summary.total) - discount + shipping, 0);
  const totalMrp = cart.items.reduce(
    (s, i) => s + (num(i.product_mrp) || num(i.product_sp)) * num(i.product_quantity, 1),
    0
  );
  const mrpDiscount = Math.max(totalMrp - num(summary.subtotal), 0);
  const totalSaved = mrpDiscount + discount;

  const change = async (item, qty) => {
    setBusyId(item.cart_id);
    try {
      if (qty <= 0) await remove(item.cart_id);
      else await updateQty(item.cart_id, qty);
      if (coupon) setCoupon(null);
    } catch (e) {
      toast.show(e.message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Screen>
      <AppHeader title={`My Cart (${summary.item_count || 0})`} back />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {cart.items.map((item) => (
          <Card key={String(item.cart_id)} style={styles.item}>
            <Pressable
              style={styles.thumb}
              onPress={() => navigation.navigate('Product', { slug: item.slug })}
            >
              {item.image_1 ? (
                <Image source={{ uri: mediaUrl(item.image_1) }} style={styles.thumbImg} resizeMode="contain" />
              ) : (
                <Ionicons name="medkit-outline" size={20} color={colors.primary} />
              )}
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName} numberOfLines={2}>
                {item.product_name}
              </Text>
              <Text style={styles.itemPrice}>
                {money(item.product_sp)} each · {money(item.line_total)}
              </Text>
              {!item.in_stock ? (
                <Text style={styles.oos}>
                  Only {item.available_quantity || 0} left in stock
                </Text>
              ) : null}
              {item.cod_eligible === false ? <Text style={styles.prepaid}>Prepaid only</Text> : null}
            </View>
            <View style={{ alignItems: 'flex-end', gap: 8 }}>
              <QtyStepper
                busy={busyId === item.cart_id}
                value={item.product_quantity}
                onDec={() => change(item, item.product_quantity - 1)}
                onInc={() => change(item, item.product_quantity + 1)}
              />
              <Pressable onPress={() => change(item, 0)} hitSlop={8}>
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            </View>
          </Card>
        ))}

        {/* Coupon */}
        {coupon ? (
          <Card style={styles.couponApplied}>
            <Ionicons name="pricetag" size={16} color={colors.primaryDark} />
            <View style={{ flex: 1 }}>
              <Text style={styles.couponCode}>{coupon.code} applied</Text>
              <Text style={styles.couponSave}>You saved {money(coupon.discount)} on this order</Text>
            </View>
            <Pressable onPress={() => setCoupon(null)} hitSlop={8}>
              <Text style={styles.removeText}>Remove</Text>
            </Pressable>
          </Card>
        ) : (
          <Pressable onPress={() => navigation.navigate('ApplyCoupon')}>
            <Card style={styles.couponRow}>
              <Ionicons name="pricetag-outline" size={16} color={colors.primary} />
              <Text style={styles.couponRowText}>Apply a coupon</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </Card>
          </Pressable>
        )}

        {summary.requires_prescription ? (
          <Card style={styles.rxNote}>
            <Ionicons name="document-text-outline" size={17} color={colors.warn} />
            <Text style={styles.rxNoteText}>
              Your cart has prescription medicines. You will be asked to attach a prescription at checkout.
            </Text>
          </Card>
        ) : null}

        {/* Bill */}
        <Card>
          <Row left="Total MRP" right={money(totalMrp)} />
          {mrpDiscount > 0 ? (
            <Row left="Discount on MRP" right={`- ${money(mrpDiscount)}`} rightColor={colors.primaryDark} />
          ) : null}
          {discount > 0 ? (
            <Row left="Coupon discount" right={`- ${money(discount)}`} rightColor={colors.primaryDark} />
          ) : null}
          <Row left="Delivery" right={shipping > 0 ? money(shipping) : 'Free'} />
          <Divider />
          <Row left="Cart Total" right={money(payable)} bold />
          {totalSaved > 0 ? (
            <Text style={styles.couponSave}>You saved {money(totalSaved)} on this order</Text>
          ) : null}
        </Card>
      </ScrollView>

      <StickyBottom>
        {summary.has_out_of_stock ? (
          <Text style={styles.warn}>
            Remove the out-of-stock items to continue: {(summary.out_of_stock_items || []).join(', ')}
          </Text>
        ) : null}
        <PrimaryButton
          title={`Proceed to Checkout · ${money(payable)}`}
          disabled={!!summary.has_out_of_stock}
          onPress={() => navigation.navigate('AddressList', { mode: 'checkout' })}
        />
      </StickyBottom>
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  thumb: {
    width: 54,
    height: 54,
    borderRadius: radius.xs,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  itemName: { fontSize: 12.5, fontWeight: '600', color: colors.text },
  itemPrice: { fontSize: 10.5, color: colors.muted, marginTop: 3 },
  oos: { fontSize: 10, color: colors.accent, marginTop: 3, fontWeight: '600' },
  prepaid: { fontSize: 10, color: colors.warn, marginTop: 2, fontWeight: '600' },
  removeText: { fontSize: 10.5, color: colors.accent, fontWeight: '700' },

  couponRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  couponRowText: { flex: 1, fontSize: 12.5, color: colors.text, fontWeight: '600' },
  couponApplied: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  couponCode: { fontSize: 12.5, fontWeight: '700', color: colors.text },
  couponSave: { fontSize: 10.5, color: colors.primaryDark, marginTop: 2 },

  rxNote: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: colors.warnLight },
  rxNoteText: { flex: 1, fontSize: 11.5, color: colors.warn, lineHeight: 17 },

  warn: { fontSize: 11, color: colors.accent, marginBottom: 10, textAlign: 'center' },
});
