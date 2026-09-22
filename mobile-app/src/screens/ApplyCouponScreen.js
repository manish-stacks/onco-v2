import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import {
  EmptyState,
  Loader,
  PrimaryButton,
  SectionTitle,
} from '../components/ui';

import { colors, radius, shadow } from '../theme';
import { cartApi } from '../api';
import { money, num, formatDate } from '../utils/format';
import { useCart } from '../store/CartContext';
import { useToast } from '../store/ToastContext';

const SCREEN_WIDTH = Dimensions.get('window').width;

const PANEL_WIDTH = Math.min(
  SCREEN_WIDTH * 0.86,
  380
);

export default function ApplyCouponScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [code, setCode] = useState('');
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(null);

  const { cart, coupon, setCoupon } = useCart();
  const toast = useToast();

  useEffect(() => {
    const loadCoupons = async () => {
      try {
        const response = await cartApi.coupons();
        setCoupons(response || []);
      } catch (error) {
        setCoupons([]);
      } finally {
        setLoading(false);
      }
    };

    loadCoupons();
  }, []);

  const apply = async (value) => {
    const couponCode = String(value || code)
      .trim()
      .toUpperCase();

    if (!couponCode) {
      toast.show('Enter a coupon code', 'error');
      return;
    }

    setApplying(couponCode);

    try {
      const res = await cartApi.applyCoupon(couponCode);

      setCoupon({
        code: res.coupon_code,
        discount: num(res.discount),
      });

      toast.show(
        `Coupon applied — you saved ${money(res.discount)}`,
        'success'
      );

      navigation.goBack();
    } catch (error) {
      toast.show(
        error?.message || 'Unable to apply coupon',
        'error'
      );
    } finally {
      setApplying(null);
    }
  };

  const subtotal = num(
    cart?.summary?.subtotal,
    0
  );

  const describe = (couponItem) => {
    if (
      couponItem.discount_type === 'percentage' ||
      num(couponItem.discount_percentage) > 0
    ) {
      const maxDiscount = num(
        couponItem.max_discount_amount
      );

      const maxText = maxDiscount
        ? ` · Max ${money(maxDiscount)}`
        : '';

      return `Flat ${num(
        couponItem.discount_percentage
      )}% off${maxText}`;
    }

    return `Flat ${money(
      couponItem.discount_amount
    )} off on this order`;
  };

  return (
    <View style={styles.container}>
      {/* Dark backdrop */}
      <Pressable
        style={styles.backdrop}
        onPress={() => navigation.goBack()}
      />

      {/* Coupon drawer */}
      <View
        style={[
          styles.panel,
          shadow,
          {
            width: PANEL_WIDTH,

            // IMPORTANT:
            // poora drawer status bar ke neeche start hoga
            top: insets.top,

            // bottom gesture/navigation bar safe
            bottom: insets.bottom,
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            Apply Coupon
          </Text>

          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12}
            style={styles.closeButton}
          >
            <Ionicons
              name="close"
              size={22}
              color={colors.text}
            />
          </Pressable>
        </View>

        {/* Coupon input */}
        <View style={styles.inputRow}>
          <TextInput
            value={code}
            onChangeText={(text) =>
              setCode(text.toUpperCase())
            }
            placeholder="Enter coupon code"
            placeholderTextColor={colors.muted}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={() => apply()}
            style={styles.input}
          />

          <PrimaryButton
            title="Apply"
            onPress={() => apply()}
            loading={
              applying ===
              code.trim().toUpperCase()
            }
            style={styles.applyButton}
          />
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.loaderContainer}>
            <Loader />
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={
              styles.scrollContent
            }
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <SectionTitle
              title={`Available coupons (${coupons.length})`}
            />

            {coupons.length === 0 ? (
              <View style={styles.emptyContainer}>
                <EmptyState
                  icon="pricetags-outline"
                  title="No coupons right now"
                  subtitle="Check back soon for new offers."
                />
              </View>
            ) : (
              coupons.map((couponItem) => {
                const minimumAmount = num(
                  couponItem.minimum_amount,
                  0
                );

                const eligible =
                  subtotal >= minimumAmount;

                const isApplied =
                  coupon?.code ===
                  couponItem.coupon_code;

                return (
                  <View
                    key={String(
                      couponItem.coupon_id
                    )}
                    style={[
                      styles.card,
                      !eligible &&
                        styles.disabledCard,
                    ]}
                  >
                    <View style={styles.cardTop}>
                      <View style={styles.cardContent}>
                        <Text style={styles.code}>
                          {
                            couponItem.coupon_code
                          }
                        </Text>

                        <Text style={styles.save}>
                          {describe(couponItem)}
                        </Text>
                      </View>

                      <Pressable
                        disabled={
                          !eligible || isApplied
                        }
                        onPress={() =>
                          apply(
                            couponItem.coupon_code
                          )
                        }
                        style={[
                          styles.couponApplyButton,
                          isApplied &&
                            styles.appliedButton,
                        ]}
                      >
                        <Text
                          style={[
                            styles.applyText,

                            isApplied &&
                              styles.appliedText,

                            !eligible &&
                              styles.disabledText,
                          ]}
                        >
                          {isApplied
                            ? 'Applied'
                            : eligible
                            ? 'Apply'
                            : 'Not eligible'}
                        </Text>
                      </Pressable>
                    </View>

                    <View style={styles.cut} />

                    <Text
                      style={[
                        styles.terms,
                        !eligible &&
                          styles.disabledText,
                      ]}
                    >
                      {eligible
                        ? `On orders above ${money(
                            minimumAmount
                          )}${
                            couponItem.expiry_date
                              ? ` · Valid till ${formatDate(
                                  couponItem.expiry_date
                                )}`
                              : ''
                          }`
                        : `Add ${money(
                            Math.max(
                              minimumAmount -
                                subtotal,
                              0
                            )
                          )} more to unlock`}
                    </Text>
                  </View>
                );
              })
            )}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },

  /*
   * Backdrop poori screen cover karega,
   * including status bar area.
   */
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 32, 0.45)',
  },

  /*
   * IMPORTANT FIX:
   *
   * height: '100%' nahi hai.
   *
   * top aur bottom runtime par
   * safe-area insets se set ho rahe hain.
   */
  panel: {
    position: 'absolute',

    right: 0,

    backgroundColor: colors.bg,

    overflow: 'hidden',

    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },

  header: {
    height: 58,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    paddingHorizontal: 16,

    borderBottomWidth:
      StyleSheet.hairlineWidth,

    borderBottomColor: colors.border,
  },

  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },

  closeButton: {
    width: 38,
    height: 38,

    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: 19,
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',

    gap: 8,

    paddingHorizontal: 16,

    paddingTop: 14,
    paddingBottom: 10,
  },

  input: {
    flex: 1,

    height: 46,

    backgroundColor: colors.card,

    borderWidth: 1,
    borderColor: colors.border,

    borderRadius: radius.sm,

    paddingHorizontal: 14,

    fontSize: 13.5,
    color: colors.text,
  },

  applyButton: {
    minHeight: 46,
    paddingHorizontal: 18,
  },

  loaderContainer: {
    flex: 1,

    alignItems: 'center',
    justifyContent: 'center',
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,

    paddingHorizontal: 16,
    paddingBottom: 24,
  },

  emptyContainer: {
    flex: 1,

    justifyContent: 'center',

    paddingBottom: 80,
  },

  card: {
    backgroundColor: colors.card,

    borderWidth: 1,
    borderColor: colors.border,

    borderRadius: radius.sm,

    padding: 12,

    marginBottom: 10,
  },

  disabledCard: {
    opacity: 0.55,
  },

  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',

    gap: 10,
  },

  cardContent: {
    flex: 1,
  },

  code: {
    fontSize: 13,

    fontWeight: '700',

    color: colors.primaryDark,

    borderWidth: 1,

    borderStyle: 'dashed',

    borderColor: colors.primary,

    borderRadius: 6,

    paddingHorizontal: 8,
    paddingVertical: 4,

    alignSelf: 'flex-start',
  },

  save: {
    fontSize: 11,

    lineHeight: 16,

    color: colors.muted,

    marginTop: 6,
  },

  couponApplyButton: {
    minHeight: 32,

    paddingHorizontal: 8,

    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: 8,
  },

  applyText: {
    fontSize: 12.5,

    fontWeight: '700',

    color: colors.primary,
  },

  appliedButton: {
    backgroundColor: colors.primary,

    paddingHorizontal: 12,
  },

  appliedText: {
    color: '#FFFFFF',
  },

  disabledText: {
    color: colors.muted,
  },

  cut: {
    borderTopWidth: 1,

    borderStyle: 'dashed',

    borderColor: colors.border,

    marginVertical: 10,
  },

  terms: {
    fontSize: 10.5,

    lineHeight: 15,

    color: colors.primary,
  },
});