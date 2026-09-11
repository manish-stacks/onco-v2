import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import { AppHeader, EmptyState, Loader } from '../components/ui';
import { colors, radius, shadow } from '../theme';
import { catalogApi } from '../api';
import { mediaUrl } from '../api/client';
import { goTab, TABS } from '../utils/nav';

export default function CategoriesScreen({ navigation }) {
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failedImg, setFailedImg] = useState({});

  const load = useCallback(async () => {
    try {
      setTree((await catalogApi.categoryTree()) || []);
    } catch {
      setTree([]);
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const open = (node) =>
    navigation.navigate('ProductList', {
      title: node.name || node.category_name,
      categoryId: node.id || node.category_id,
    });

  return (
    <Screen>
      <AppHeader title="Categories" />
      <Pressable style={[styles.search, shadow]} onPress={() => goTab(navigation, TABS.search)}>
        <Ionicons name="search" size={16} color={colors.muted} />
        <Text style={styles.searchText}>Search medicines, health products...</Text>
      </Pressable>
      {loading ? (
        <Loader />
      ) : (
        <FlatList
          data={tree}
          keyExtractor={(c) => String(c.id || c.category_id)}
          contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState icon="grid-outline" title="No categories yet" />}
          renderItem={({ item }) => {
            const key = String(item.id || item.category_id);
            const imgSrc = item.image || item.category_image;
            const showImg = imgSrc && !failedImg[key];
            return (
            <View style={styles.group}>
              <Pressable style={[styles.parent, shadow]} onPress={() => open(item)}>
                <View style={styles.parentIcon}>
                  {showImg ? (
                    <Image
                      source={{ uri: mediaUrl(imgSrc) }}
                      style={styles.parentImg}
                      resizeMode="contain"
                      onError={() => setFailedImg((prev) => ({ ...prev, [key]: true }))}
                    />
                  ) : (
                    <Ionicons name="medkit-outline" size={20} color={colors.primary} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.parentName}>{item.name || item.category_name}</Text>
                  {item.productCount ? (
                    <Text style={styles.parentCount}>{item.productCount} products</Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={17} color={colors.muted} />
              </Pressable>

              {item.children?.length ? (
                <View style={styles.childWrap}>
                  {item.children.map((child) => (
                    <Pressable key={String(child.id)} style={styles.child} onPress={() => open(child)}>
                      <Text style={styles.childText} numberOfLines={1}>
                        {child.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  group: { marginBottom: 14 },
  parent: {
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  parentIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  parentImg: { width: '100%', height: '100%' },
  parentName: { fontSize: 13, fontWeight: '700', color: colors.text },
  parentCount: { fontSize: 10.5, color: colors.muted, marginTop: 2 },
  childWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, paddingLeft: 4 },
  child: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  childText: { fontSize: 11.5, color: colors.text, maxWidth: 150 },
});