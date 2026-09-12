import React, { useEffect, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState, Loader, PrimaryButton, SectionTitle } from '../components/ui';
import { colors, radius, shadow } from '../theme';
import { cartApi } from '../api';
import { money, num, formatDate } from '../utils/format';
import { useCart } from '../store/CartContext';
import { useToast } from '../store/ToastContext';

// Rendered as a `transparentModal` screen (see RootNavigator) so it slides in
// from the right as a partial-width sidebar over the cart/checkout screen
// beneath, instead of covering the whole page.
const PANEL_WIDTH = Math.min(Dimensions.get('window').width * 0.86, 380);

export default function ApplyCouponScreen({ navigation }) {
  const [code, setCode] = useState('');
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(null);
  const { cart, coupon, setCoupon } = useCart();
  const toast = useToast();

  useEffect(() => {
    (async () => {
      try {
        setCoupons((await cartApi.coupons()) || []);
      } catch {
        setCoupons([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const apply = async (value) => {
    const c = String(value || code).trim().toUpperCase();
    if (!c) {
      toast.show('Enter a coupon code', 'error');
      return;
    }
    setApplying(c);
    try {
      const res = await cartApi.applyCoupon(c);
      setCoupon({ code: res.coupon_code, discount: num(res.discount) });
      toast.show(`Coupon applied — you saved ${money(res.discount)}`, 'success');
      navigation.goBack();
    } catch (e) {
      toast.show(e.message, 'error');
    } finally {
      setApplying(null);
    }
  };

  const subtotal = num(cart?.summary?.subtotal, 0);

  const describe = (c) => {
    if (c.discount_type === 'percentage' || num(c.discount_percentage) > 0) {
      const max = num(c.max_discount_amount) ? ` · Max ${money(c.max_discount_amount)}` : '';
      return `Flat ${num(c.discount_percentage)}% off${max}`;
    }
    return `Flat ${money(c.discount_amount)} off on this order`;
  };

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={() => navigation.goBack()} />
      <SafeAreaView edges={['top', 'bottom']} style={[styles.panel, { width: PANEL_WIDTH }, shadow]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Apply Coupon</Text>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.inputRow}>
          <TextInput
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            placeholder="Enter coupon code"
            placeholderTextColor={colors.muted}
            autoCapitalize="characters"
            style={styles.input}
          />
          <PrimaryButton
            title="Apply"
            onPress={() => apply()}
            loading={applying === code.trim().toUpperCase()}
            style={{ paddingHorizontal: 18 }}
          />
        </View>

        {loading ? (
          <Loader />
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
            <SectionTitle title={`Available coupons (${coupons.length})`} />
            {coupons.length === 0 ? (
              <EmptyState icon="pricetags-outline" title="No coupons right now" subtitle="Check back soon for new offers." />
            ) : (
              coupons.map((c) => {
                const min = num(c.minimum_amount, 0);
                const eligible = subtotal >= min;
                const isApplied = coupon?.code === c.coupon_code;
                return (
                  <View key={String(c.coupon_id)} style={[styles.card, !eligible && { opacity: 0.55 }]}>
                    <View style={styles.cardTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.code}>{c.coupon_code}</Text>
                        <Text style={styles.save}>{describe(c)}</Text>
                      </View>
                      <Pressable
                        disabled={!eligible || isApplied}
                        onPress={() => apply(c.coupon_code)}
                        style={isApplied ? styles.appliedBtn : null}
                      >
                        <Text
                          style={[
                            styles.applyText,
                            isApplied && { color: '#fff' },
                            !eligible && { color: colors.muted },
                          ]}
                        >
                          {isApplied ? 'Applied' : eligible ? 'Apply' : 'Not eligible'}
                        </Text>
                      </Pressable>
                    </View>
                    <View style={styles.cut} />
                    <Text style={[styles.terms, !eligible && { color: colors.muted }]}>
                      {eligible
                        ? `On orders above ${money(min)}${c.expiry_date ? ` · Valid till ${formatDate(c.expiry_date)}` : ''}`
                        : `Add ${money(min - subtotal)} more to unlock`}
                    </Text>
                  </View>
                );
              })
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, flexDirection: 'row' },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,32,0.45)' },
  panel: { backgroundColor: colors.bg, height: '100%' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  inputRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 14, alignItems: 'flex-start' },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 13.5,
    color: colors.text,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 12,
    marginBottom: 10,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  code: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryDark,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  save: { fontSize: 11, color: colors.muted, marginTop: 6 },
  applyText: { fontSize: 12.5, color: colors.primary, fontWeight: '700' },
  appliedBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  cut: { borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.border, marginVertical: 10 },
  terms: { fontSize: 10.5, color: colors.primary },
});
