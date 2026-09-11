import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import ProductCard from '../components/ProductCard';
import { Card, Loader, SectionTitle } from '../components/ui';
import { colors, radius, shadow } from '../theme';
import { catalogApi, orderApi } from '../api';
import { mediaUrl } from '../api/client';
import { money } from '../utils/format';
import { getRecentViews } from '../utils/recentViews';
import { useAuth } from '../store/AuthContext';
import { useCart } from '../store/CartContext';
import { goTab, TABS } from '../utils/nav';

const { width: SCREEN_W } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastOrder, setLastOrder] = useState(null);
  const [activeBanner, setActiveBanner] = useState(0);
  const [recentViews, setRecentViews] = useState([]);
  const bannerRef = useRef(null);
  const { isLoggedIn, customer } = useAuth();
  const { count } = useCart();

  const load = useCallback(async () => {
    try {
      const home = await catalogApi.home();
      setData(home);
    } catch {
      /* keep whatever we already showed */
    }
    if (isLoggedIn) {
      try {
        const { data: orders } = await orderApi.list({ page: 1, limit: 1 });
        setLastOrder(orders?.[0] || null);
      } catch {
        setLastOrder(null);
      }
    } else {
      setLastOrder(null);
    }
    setLoading(false);
  }, [isLoggedIn]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      getRecentViews().then(setRecentViews);
    }, [])
  );

  useEffect(() => {
    const banners = data?.banners || [];
    if (banners.length < 2) return;
    const id = setInterval(() => {
      setActiveBanner((prev) => {
        const next = (prev + 1) % banners.length;
        bannerRef.current?.scrollToOffset({ offset: next * SCREEN_W, animated: true });
        return next;
      });
    }, 3500);
    return () => clearInterval(id);
  }, [data?.banners]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <Screen>
        <Loader style={{ flex: 1, justifyContent: 'center' }} />
      </Screen>
    );
  }

  const banners = data?.banners || [];
  const categories = data?.categories || [];
  const offers = data?.offers || [];

  const rail = (title, items, tag) =>
    items && items.length ? (
      <View style={styles.block}>
        <View style={{ paddingHorizontal: 18 }}>
          <SectionTitle
            title={title}
            action="See all"
            onAction={() => navigation.navigate('ProductList', { title, tag })}
          />
        </View>
        <FlatList
          horizontal
          data={items}
          keyExtractor={(p) => String(p.product_id)}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 18, gap: 10 }}
          renderItem={({ item }) => <ProductCard product={item} width={158} />}
        />
      </View>
    ) : null;

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.hello}>{isLoggedIn ? 'Hello' : 'Welcome'}</Text>
            <Text style={styles.name}>{customer?.customer_name || data?.settings?.organization || 'Onco Health Mart'}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable style={[styles.iconBtn, shadow]} onPress={() => navigation.navigate('Notifications')}>
              <Ionicons name="notifications-outline" size={18} color={colors.text} />
            </Pressable>
            <Pressable style={[styles.iconBtn, shadow]} onPress={() => goTab(navigation, TABS.cart)}>
              <Ionicons name="cart-outline" size={18} color={colors.text} />
              {count > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{count}</Text>
                </View>
              ) : null}
            </Pressable>
          </View>
        </View>

        {/* Search */}
        <Pressable style={[styles.search, shadow]} onPress={() => goTab(navigation, TABS.search)}>
          <Ionicons name="search" size={16} color={colors.muted} />
          <Text style={styles.searchText}>Search medicines, health products...</Text>
        </Pressable>

        {/* Banners */}
        {banners.length ? (
          <View style={{ marginBottom: 16 }}>
            <FlatList
              ref={bannerRef}
              horizontal
              pagingEnabled
              data={banners}
              keyExtractor={(b) => String(b.banner_id)}
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
                setActiveBanner(Math.max(0, Math.min(idx, banners.length - 1)));
              }}
              renderItem={({ item }) => (
                <View style={{ width: SCREEN_W, paddingHorizontal: 18 }}>
                  <Pressable style={[styles.banner, shadow]}>
                    {item.banner_image ? (
                      <Image source={{ uri: mediaUrl(item.banner_image) }} style={styles.bannerImg} resizeMode="contain" />
                    ) : (
                      <View style={styles.bannerFallback}>
                        <Text style={styles.bannerTitle}>{item.title_top || 'Special offer'}</Text>
                        <Text style={styles.bannerSub}>{item.title_bottom || item.body || ''}</Text>
                      </View>
                    )}
                  </Pressable>
                </View>
              )}
            />
            {banners.length > 1 ? (
              <View style={styles.dots}>
                {banners.map((_, i) => (
                  <View key={i} style={[styles.dot, i === activeBanner && styles.dotActive]} />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Categories */}
        {categories.length ? (
          <View style={styles.block}>
            <View style={{ paddingHorizontal: 18 }}>
              <SectionTitle title="Categories" action="See all" onAction={() => goTab(navigation, TABS.categories)} />
            </View>
            <FlatList
              horizontal
              data={categories.slice(0, 12)}
              keyExtractor={(c) => String(c.id || c.category_id)}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 18, gap: 12 }}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.cat}
                  onPress={() =>
                    navigation.navigate('ProductList', {
                      title: item.name || item.category_name,
                      categoryId: item.id || item.category_id,
                    })
                  }
                >
                
                  <View style={styles.catIcon}>
                    {item.image || item.category_image ? (
                      <Image
                        source={{ uri: mediaUrl(item.image || item.category_image) }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="contain"
                      />
                    ) : (
                      <Ionicons name="grid-outline" size={20} color={colors.primary} />
                    )}
                  </View>
                  <Text style={styles.catText} numberOfLines={2}>
                    {item.name || item.category_name}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        ) : null}

        {rail('Recently viewed', recentViews)}

        {/* Upload prescription */}
        <View style={{ paddingHorizontal: 18 }}>
          <Pressable onPress={() => navigation.navigate('RxUpload')}>
            <Card style={styles.rxCard}>
              <View style={styles.rxIcon}>
                <Ionicons name="document-text-outline" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rxTitle}>Upload Prescription</Text>
                <Text style={styles.rxSub}>Get your medicines delivered fast</Text>
              </View>
              <View style={styles.rxChip}>
                <Text style={styles.rxChipText}>Upload</Text>
              </View>
            </Card>
          </Pressable>
        </View>

        {rail('Deal of the day', data?.deal_of_the_day, 'deals')}
        {rail('Top selling', data?.top_selling, 'top_selling')}
        {rail('New arrivals', data?.latest_products, 'latest')}

        {/* Offers */}
        {offers.length ? (
          <View style={{ paddingHorizontal: 18, paddingBottom: 6 }}>
            <SectionTitle title="Offers for you" action="See all" onAction={() => navigation.navigate('Offers')} />
            {offers.slice(0, 2).map((o) => (
              <Card key={String(o.id || o.CODE)} style={styles.offer}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={styles.offerCode}>{o.CODE}</Text>
                  <Text style={styles.offerValue}>
                    {o.discount_type === 'percent' || o.percenatge_off
                      ? `${o.percenatge_off}% OFF`
                      : `${money(o.maxDiscount || 0)} OFF`}
                  </Text>
                </View>
                <Text style={styles.offerDesc}>{o.title || o.desc_code}</Text>
              </Card>
            ))}
          </View>
        ) : null}

        {/* Reorder */}
        {lastOrder ? (
          <View style={{ paddingHorizontal: 18 }}>
            <SectionTitle title="Reorder" action="My orders" onAction={() => navigation.navigate('Orders')} />
            <Pressable onPress={() => navigation.navigate('OrderDetail', { orderId: lastOrder.order_id })}>
              <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 12, color: colors.text }}>
                  Order #{lastOrder.databaseOrderID} · {money(lastOrder.amount)}
                </Text>
                <View style={styles.rxChip}>
                  <Text style={styles.rxChipText}>Reorder</Text>
                </View>
              </Card>
            </Pressable>
          </View>
        ) : null}

        <View style={{ height: 24 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hello: { fontSize: 11, color: colors.muted },
  name: { fontSize: 15, fontWeight: '700', color: colors.ink, maxWidth: 210 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: colors.accent,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },

  search: {
    marginHorizontal: 18,
    marginBottom: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchText: { fontSize: 13, color: colors.muted },

  banner: { width: '100%', height: 138, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.primary },
  bannerImg: { width: '100%', height: '100%' },
  bannerFallback: { flex: 1, padding: 16, justifyContent: 'center' },
  bannerTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  bannerSub: { color: '#fff', fontSize: 11, opacity: 0.85, marginTop: 2 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.primary, width: 16 },

  block: { paddingBottom: 18 },
  cat: { width: 68, alignItems: 'center' },
  catIcon: {
    width: 54,
    height: 54,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
    overflow: 'hidden',
  },
  catText: { fontSize: 10, color: colors.text, textAlign: 'center' },

  rxCard: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rxIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rxTitle: { fontSize: 12.5, fontWeight: '700', color: colors.text },
  rxSub: { fontSize: 10.5, color: colors.muted, marginTop: 2 },
  rxChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  rxChipText: { fontSize: 11, color: colors.primary, fontWeight: '600' },

  offer: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.primary },
  offerCode: { fontSize: 13, fontWeight: '700', color: colors.text },
  offerValue: { fontSize: 11.5, fontWeight: '700', color: colors.primaryDark },
  offerDesc: { fontSize: 11, color: colors.muted, marginTop: 4 },
});