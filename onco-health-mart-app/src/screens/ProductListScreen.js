import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Screen from '../components/Screen';
import ProductCard from '../components/ProductCard';
import { AppHeader, Chip, EmptyState, Loader } from '../components/ui';
import { colors } from '../theme';
import { catalogApi } from '../api';

const SORTS = [
  { key: 'popular', label: 'Popular', params: { sort: 'total_sold', order: 'desc' } },
  { key: 'new', label: 'Newest', params: { sort: 'product_id', order: 'desc' } },
  { key: 'low', label: 'Price: low', params: { sort: 'product_sp', order: 'asc' } },
  { key: 'high', label: 'Price: high', params: { sort: 'product_sp', order: 'desc' } },
];

const TAG_PARAMS = {
  deals: { deals: 1 },
  top_selling: { top_selling: 1 },
  latest: { latest: 1 },
};

export default function ProductListScreen({ route, navigation }) {
  const { title = 'Products', categoryId, brandId, tag, search } = route.params || {};
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [more, setMore] = useState(false);
  const [sort, setSort] = useState('popular');
  const [rxOnly, setRxOnly] = useState(false);

  const fetchPage = useCallback(
    async (p, replace) => {
      const sortDef = SORTS.find((s) => s.key === sort) || SORTS[0];
      const params = {
        page: p,
        limit: 20,
        category_id: categoryId,
        brand_id: brandId,
        search,
        in_stock: true,
        ...(tag ? TAG_PARAMS[tag] : {}),
        ...sortDef.params,
        ...(rxOnly ? { prescription_required: 'Yes' } : {}),
      };
      const res = await catalogApi.products(params);
      setHasNext(!!res.pagination?.hasNext);
      setItems((prev) => (replace ? res.data : [...prev, ...res.data]));
    },
    [categoryId, brandId, tag, search, sort, rxOnly]
  );

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setPage(1);
    (async () => {
      try {
        await fetchPage(1, true);
      } catch {
        if (alive) setItems([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [fetchPage]);

  const loadMore = async () => {
    if (!hasNext || more || loading) return;
    setMore(true);
    try {
      const next = page + 1;
      await fetchPage(next, false);
      setPage(next);
    } catch {
      /* ignore */
    } finally {
      setMore(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchPage(1, true);
      setPage(1);
    } catch {
      /* ignore */
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Screen>
      <AppHeader title={title} back />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
        style={{ flexGrow: 0 }}
      >
        {SORTS.map((s) => (
          <Chip key={s.key} text={s.label} active={sort === s.key} onPress={() => setSort(s.key)} />
        ))}
        <Chip text="Rx only" active={rxOnly} onPress={() => setRxOnly(!rxOnly)} />
      </ScrollView>

      {loading ? (
        <Loader />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(p, i) => `${p.product_id}-${i}`}
          numColumns={2}
          columnWrapperStyle={{ gap: 10, paddingHorizontal: 18 }}
          contentContainerStyle={{ paddingBottom: 24, gap: 10, paddingTop: 4 }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListFooterComponent={more ? <Loader style={{ paddingVertical: 20 }} /> : null}
          renderItem={({ item }) => <ProductCard product={item} style={{ flex: 1 }} />}
          ListEmptyComponent={
            <EmptyState
              icon="cube-outline"
              title="Nothing here yet"
              subtitle="No products matched this selection. Try another filter."
            />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { paddingHorizontal: 18, paddingBottom: 12, gap: 8 },
});
