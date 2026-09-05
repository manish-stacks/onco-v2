import React, { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import ProductCard from '../components/ProductCard';
import { Chip, EmptyState, Loader, SectionTitle } from '../components/ui';
import { colors, radius, shadow } from '../theme';
import { catalogApi } from '../api';

export default function SearchScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [suggest, setSuggest] = useState({ products: [], categories: [] });
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const debounce = useRef(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (query.trim().length < 2) {
      setSuggest({ products: [], categories: [] });
      setResults([]);
      setTotal(0);
      return undefined;
    }
    setLoading(true);
    debounce.current = setTimeout(async () => {
      try {
        const [s, r] = await Promise.all([
          catalogApi.search(query.trim()),
          catalogApi.products({ search: query.trim(), page: 1, limit: 20 }),
        ]);
        setSuggest(s || { products: [], categories: [] });
        setResults(r.data || []);
        setTotal(r.pagination?.total || (r.data || []).length);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => debounce.current && clearTimeout(debounce.current);
  }, [query]);

  return (
    <Screen>
      <View style={[styles.searchBar, shadow]}>
        <Ionicons name="search" size={17} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search medicines, health products..."
          placeholderTextColor={colors.muted}
          style={styles.input}
          autoCorrect={false}
          returnKeyType="search"
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={17} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      {query.trim().length < 2 ? (
        <EmptyState
          icon="search-outline"
          title="Find what you need"
          subtitle="Type at least 2 characters to search our catalogue by medicine, brand or category."
        />
      ) : loading && !results.length ? (
        <Loader />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(p) => String(p.product_id)}
          numColumns={2}
          columnWrapperStyle={{ gap: 10, paddingHorizontal: 18 }}
          contentContainerStyle={{ paddingBottom: 24, gap: 10 }}
          ListHeaderComponent={
            <View>
              {suggest.categories?.length ? (
                <View style={{ paddingHorizontal: 18, paddingBottom: 12 }}>
                  <SectionTitle title="Categories" />
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {suggest.categories.slice(0, 6).map((c) => (
                      <Chip
                        key={String(c.category_id)}
                        text={c.category_name}
                        onPress={() =>
                          navigation.navigate('ProductList', {
                            title: c.category_name,
                            categoryId: c.category_id,
                          })
                        }
                      />
                    ))}
                  </View>
                </View>
              ) : null}
              <View style={{ paddingHorizontal: 18, paddingBottom: 6 }}>
                <SectionTitle title={`Results (${total})`} />
              </View>
            </View>
          }
          renderItem={({ item }) => <ProductCard product={item} style={{ flex: 1 }} />}
          ListEmptyComponent={
            <EmptyState
              icon="sad-outline"
              title="No products found"
              subtitle="Try a different spelling or search by the salt name."
            />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    marginHorizontal: 18,
    marginTop: 12,
    marginBottom: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: { flex: 1, paddingVertical: 12, fontSize: 13.5, color: colors.text },
});
