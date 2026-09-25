import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Screen from '../components/Screen';
import { AppHeader, Card, EmptyState, Loader } from '../components/ui';
import { colors, radius } from '../theme';
import { orderApi, prescriptionApi } from '../api';
import { formatDate, money, orderRef } from '../utils/format';
import { useAuth } from '../store/AuthContext';

/**
 * There is no dedicated notifications endpoint yet, so the feed is built from
 * the customer's real order and prescription activity — everything shown here
 * comes straight from the backend.
 */
export default function NotificationsScreen({ navigation }) {
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { isLoggedIn } = useAuth();

  const load = useCallback(async () => {
    if (!isLoggedIn) {
      setLoading(false);
      return;
    }
    try {
      const [orders, rx] = await Promise.all([
        orderApi.list({ page: 1, limit: 10 }),
        prescriptionApi.list({ page: 1, limit: 10 }),
      ]);

      const items = [
        ...(orders.data || []).map((o) => ({
          id: `order-${o.order_id}`,
          icon: o.status === 'Delivered' ? 'checkmark-done-outline' : 'cube-outline',
          title: `Order #${orderRef(o)} · ${o.status}`,
          body: `${money(o.amount)} · ${o.payment_status}`,
          at: o.updated_at || o.order_date,
          onPress: () => navigation.navigate('OrderDetail', { orderId: o.order_id }),
        })),
        ...(rx.data || []).map((p) => ({
          id: `rx-${p.prescription_id}`,
          icon: 'document-text-outline',
          title: `Prescription ${p.reference_code || `#${p.prescription_id}`} · ${p.status}`,
          body: p.rejection_reason || 'Tap to view the details',
          at: p.updated_at || p.created_at,
          onPress: () => navigation.navigate('RxDetail', { id: p.prescription_id }),
        })),
      ].sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));

      setFeed(items);
    } catch {
      setFeed([]);
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn, navigation]);

  useFocusEffect(
    useCallback(() => {
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
        <AppHeader title="Notifications" back />
        <EmptyState
          icon="notifications-outline"
          title="Log in to see your updates"
          actionTitle="Log in"
          onAction={() => navigation.navigate('Login')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title="Notifications" back />
      {loading ? (
        <Loader />
      ) : (
        <FlatList
          data={feed}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <EmptyState
              icon="notifications-outline"
              title="Nothing here yet"
              subtitle="Order and prescription updates will show up here."
            />
          }
          renderItem={({ item }) => (
            <Pressable onPress={item.onPress}>
              <Card style={styles.row}>
                <View style={styles.icon}>
                  <Ionicons name={item.icon} size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{item.title}</Text>
                  <Text style={styles.body}>{item.body}</Text>
                  <Text style={styles.time}>{formatDate(item.at, true)}</Text>
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
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  icon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 12.5, fontWeight: '700', color: colors.text },
  body: { fontSize: 11, color: colors.muted, marginTop: 3 },
  time: { fontSize: 10, color: colors.muted, marginTop: 4 },
});
