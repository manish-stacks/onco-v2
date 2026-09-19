import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import ProductCard from '../components/ProductCard';
import {
  Card,
  Divider,
  EmptyState,
  Loader,
  Pill,
  PrimaryButton,
  QtyStepper,
  SectionTitle,
  StickyBottom,
} from '../components/ui';
import { colors, radius, shadow } from '../theme';
import { catalogApi } from '../api';
import { mediaUrl } from '../api/client';
import { discountPercent, inStock, isRx, money, num, plain } from '../utils/format';
import { addRecentView } from '../utils/recentViews';
import { useCart } from '../store/CartContext';
import { useAuth } from '../store/AuthContext';
import { useToast } from '../store/ToastContext';
import { goTab, TABS } from '../utils/nav';

const { width: SCREEN_W } = Dimensions.get('window');

const INFO_FIELDS = [
  ['Description', 'long_description'],
  ['Key features', 'key_features'],
  ['Benefits', 'benifits'],
  ['How to use', 'how_to_use'],
  ['Specification', 'specification'],
  ['Side effects', 'side_effects'],
  ['Caution', 'caution'],
  ['Storage', 'storage'],
];

export default function ProductScreen({ route, navigation }) {
  const { slug } = route.params || {};
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [imgIndex, setImgIndex] = useState(0);
  const [reviews, setReviews] = useState([]);

  const { add, updateQty, findLine, toggleWishlist, isWishlisted, count } = useCart();
  const { isLoggedIn } = useAuth();
  const toast = useToast();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const p = await catalogApi.product(slug);
        if (!alive) return;
        setProduct(p);
        addRecentView(p);
        try {
          const r = await catalogApi.reviews(p.product_id, { limit: 5 });
          if (alive) setReviews(r.data || []);
        } catch {
          /* reviews are optional */
        }
      } catch (e) {
        toast.show(e.message, 'error');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [slug]);

  if (loading) {
    return (
      <Screen>
        <Loader style={{ flex: 1, justifyContent: 'center' }} />
      </Screen>
    );
  }

  if (!product) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" title="Product not found" actionTitle="Go back" onAction={() => navigation.goBack()} />
      </Screen>
    );
  }

  const images = [product.image_1, product.image_2, product.image_3, product.image_4, product.image_5]
    .filter(Boolean)
    .map((i) => mediaUrl(i));

  const line = findLine(product.product_id);
  const off = discountPercent(product.product_mrp, product.product_sp);
  const available = inStock(product);
  const wished = isWishlisted(product.product_id);

  const requireLogin = () => {
    toast.show('Please log in to continue');
    navigation.navigate('Login');
  };

  const onAdd = async () => {
    if (!isLoggedIn) return requireLogin();
    setBusy(true);
    try {
      await add(product.product_id, 1);
      toast.show('Added to the cart', 'success');
    } catch (e) {
      toast.show(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const change = async (qty) => {
    setBusy(true);
    try {
      await updateQty(line.cart_id, qty);
    } catch (e) {
      toast.show(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const onWish = async () => {
    if (!isLoggedIn) return requireLogin();
    try {
      const res = await toggleWishlist(product.product_id);
      toast.show(res?.added ? 'Added to your wishlist' : 'Removed from your wishlist', 'success');
    } catch (e) {
      toast.show(e.message, 'error');
    }
  };

  return (
    <Screen edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable style={[styles.iconBtn, shadow]} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={19} color={colors.text} />
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable style={[styles.iconBtn, shadow]} onPress={onWish}>
              <Ionicons name={wished ? 'heart' : 'heart-outline'} size={18} color={wished ? colors.accent : colors.text} />
            </Pressable>
            <Pressable style={[styles.iconBtn, shadow]} onPress={() => goTab(navigation, TABS.cart)}>
              <Ionicons name="cart-outline" size={18} color={colors.text} />
              {count > 0 ? (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{count > 99 ? '99+' : count}</Text>
                </View>
              ) : null}
            </Pressable>
          </View>
        </View>

        {/* Gallery */}
        <View style={styles.gallery}>
          {images.length ? (
            <FlatList
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              data={images}
              keyExtractor={(u, i) => `${u}-${i}`}
              onMomentumScrollEnd={(e) =>
                setImgIndex(Math.round(e.nativeEvent.contentOffset.x / (SCREEN_W - 36)))
              }
              renderItem={({ item }) => (
                <Image source={{ uri: item }} style={{ width: SCREEN_W - 36, height: 200 }} resizeMode="contain" />
              )}
            />
          ) : (
            <Ionicons name="medkit-outline" size={54} color={colors.primary} />
          )}
        </View>
        {images.length > 1 ? (
          <View style={styles.dots}>
            {images.map((u, i) => (
              <View key={u} style={[styles.dot, i === imgIndex && styles.dotActive]} />
            ))}
          </View>
        ) : null}

        <View style={{ paddingHorizontal: 18, paddingTop: 14 }}>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
            {isRx(product) ? <Pill text="Rx Required" tone="warn" /> : null}
            {String(product.isCOD) === '0' ? <Pill text="Prepaid only" tone="danger" /> : null}
            {!available ? <Pill text="Out of stock" tone="danger" /> : null}
          </View>

          <Text style={styles.title}>{product.product_name}</Text>
          <Text style={styles.meta}>
            {[product.brand_name, product.weight_quantity].filter(Boolean).join(' · ') || 'Onco Health Mart'}
          </Text>

          <View style={styles.priceRow}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
              <Text style={styles.price}>{money(product.product_sp)}</Text>
              {num(product.product_mrp) > num(product.product_sp) ? (
                <Text style={styles.mrp}>{money(product.product_mrp)}</Text>
              ) : null}
              {off > 0 ? <Text style={styles.off}>{off}% off</Text> : null}
            </View>
            {line ? (
              <QtyStepper
                busy={busy}
                value={line.product_quantity}
                onDec={() => change(line.product_quantity - 1)}
                onInc={() => change(line.product_quantity + 1)}
              />
            ) : null}
          </View>

          {product.salt ? (
            <Card style={{ marginTop: 12 }}>
              <Text style={styles.saltLabel}>Composition</Text>
              <Text style={styles.saltValue}>{plain(product.salt)}</Text>
            </Card>
          ) : null}

          {isRx(product) ? (
            <Card style={styles.rxNote}>
              <Ionicons name="document-text-outline" size={18} color={colors.warn} />
              <Text style={styles.rxNoteText}>
                This medicine needs a valid prescription. You can upload it during checkout.
              </Text>
            </Card>
          ) : null}

          <Divider />

          {INFO_FIELDS.map(([label, key]) => {
            const value = plain(product[key]);
            if (!value) return null;
            return (
              <View key={key} style={{ marginBottom: 14 }}>
                <Text style={styles.infoTitle}>{label}</Text>
                <Text style={styles.infoText}>{value}</Text>
              </View>
            );
          })}

          {reviews.length ? (
            <View style={{ marginTop: 4 }}>
              <SectionTitle title={`Reviews (${product.review_count || reviews.length})`} />
              {reviews.map((r) => (
                <Card key={String(r.review_id || r.id)}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={styles.reviewName}>{r.name || r.customer_name || 'Customer'}</Text>
                    <View style={{ flexDirection: 'row' }}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Ionicons
                          key={i}
                          name={i < num(r.stars || r.rating) ? 'star' : 'star-outline'}
                          size={12}
                          color={colors.primary}
                        />
                      ))}
                    </View>
                  </View>
                  <Text style={styles.reviewText}>{plain(r.review || r.comment)}</Text>
                </Card>
              ))}
            </View>
          ) : null}
        </View>

        {product.related?.length ? (
          <View style={{ paddingTop: 8, paddingBottom: 20 }}>
            <View style={{ paddingHorizontal: 18 }}>
              <SectionTitle title="You may also need" />
            </View>
            <FlatList
              horizontal
              data={product.related}
              keyExtractor={(p) => String(p.product_id)}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 18, gap: 10 }}
              renderItem={({ item }) => <ProductCard product={item} width={158} />}
            />
          </View>
        ) : null}

        <View style={{ height: 20 }} />
      </ScrollView>

      <StickyBottom>
        {!available ? (
          <PrimaryButton title="Out of stock" disabled />
        ) : line ? (
          <PrimaryButton title="Go to cart" onPress={() => goTab(navigation, TABS.cart)} />
        ) : (
          <PrimaryButton
            title={busy ? 'Adding...' : `Add to Cart · ${money(product.product_sp)}`}
            onPress={onAdd}
            loading={busy}
          />
        )}
      </StickyBottom>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: colors.accent || '#e53935',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  gallery: {
    marginHorizontal: 18,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  dots: { flexDirection: 'row', gap: 5, justifyContent: 'center', marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { width: 18, backgroundColor: colors.primary },

  title: { fontSize: 17, fontWeight: '700', color: colors.ink, lineHeight: 23 },
  meta: { fontSize: 11.5, color: colors.muted, marginTop: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  price: { fontSize: 20, fontWeight: '700', color: colors.ink },
  mrp: { fontSize: 13, color: colors.muted, textDecorationLine: 'line-through', marginBottom: 2 },
  off: { fontSize: 12, color: colors.primaryDark, fontWeight: '700', marginBottom: 3 },

  saltLabel: { fontSize: 10.5, color: colors.muted },
  saltValue: { fontSize: 12.5, color: colors.text, fontWeight: '600', marginTop: 3 },

  rxNote: {
    marginTop: 12,
    backgroundColor: colors.warnLight,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  rxNoteText: { flex: 1, fontSize: 11.5, color: colors.warn, lineHeight: 17 },

  infoTitle: { fontSize: 13.5, fontWeight: '700', color: colors.text, marginBottom: 5 },
  infoText: { fontSize: 12.5, color: colors.muted, lineHeight: 19 },

  reviewName: { fontSize: 12.5, fontWeight: '700', color: colors.text },
  reviewText: { fontSize: 12, color: colors.muted, marginTop: 5, lineHeight: 18 },
});