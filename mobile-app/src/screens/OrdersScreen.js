import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Screen from '../components/Screen';
import { AppHeader, Card, Chip, EmptyState, Loader, StatusPill } from '../components/ui';
import { colors } from '../theme';
import { orderApi } from '../api';
import { formatDate, money, orderRef } from '../utils/format';
import { useAuth } from '../store/AuthContext';
import { goTab, TABS } from '../utils/nav';

const FILTERS = ['All', 'New', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

export default function OrdersScreen({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('All');
  const { isLoggedIn } = useAuth();

  const load = useCallback(async () => {
    if (!isLoggedIn) {
      setLoading(false);
      return;
    }
    try {
      const res = await orderApi.list({ page: 1, limit: 30, status: filter === 'All' ? undefined : filter });
      setOrders(res.data || []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [filter, isLoggedIn]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (!isLoggedIn) {
    return (
      <Screen>
        <AppHeader title="My Orders" back />
        <EmptyState
          icon="receipt-outline"
          title="Log in to see your orders"
          actionTitle="Log in"
          onAction={() => navigation.navigate('Login')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title="My Orders" back />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
        style={{ flexGrow: 0 }}
      >
        {FILTERS.map((f) => (
          <Chip key={f} text={f} active={filter === f} onPress={() => setFilter(f)} />
        ))}
      </ScrollView>

      {loading ? (
        <Loader />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => String(o.order_id)}
          contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <EmptyState
              icon="receipt-outline"
              title="No orders yet"
              subtitle="Once you place an order it will appear here."
              actionTitle="Start shopping"
              onAction={() => goTab(navigation, TABS.home)}
            />
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => navigation.navigate('OrderDetail', { orderId: item.order_id })}>
              <Card>
                <View style={styles.top}>
                  <Text style={styles.ref}>#{orderRef(item)}</Text>
                  <StatusPill status={item.status} />
                </View>
                <Text style={styles.meta}>
                  {money(item.amount)} · {formatDate(item.order_date)} · {item.payment_mode?.toUpperCase()}
                </Text>
                <View style={styles.actions}>
                  <Pressable
                    style={styles.chip}
                    onPress={() => navigation.navigate('Tracking', { orderId: item.order_id })}
                  >
                    <Text style={styles.chipText}>Track</Text>
                  </Pressable>
                  <Pressable
                    style={styles.chip}
                    onPress={() => navigation.navigate('OrderDetail', { orderId: item.order_id, reorder: true })}
                  >
                    <Text style={styles.chipText}>Reorder</Text>
                  </Pressable>
                </View>
              </Card>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { paddingHorizontal: 18, paddingBottom: 12, gap: 8, height: 45 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ref: { fontSize: 12.5, fontWeight: '700', color: colors.text },
  meta: { fontSize: 11, color: colors.muted, marginTop: 5 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  chipText: { fontSize: 11, color: colors.primary, fontWeight: '600' },
});
