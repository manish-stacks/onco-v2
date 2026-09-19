import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Screen from '../components/Screen';
import { AppHeader, Card, EmptyState, Loader, StatusPill } from '../components/ui';
import { colors, radius } from '../theme';
import { prescriptionApi } from '../api';
import { mediaUrl } from '../api/client';
import { formatDate } from '../utils/format';
import { useAuth } from '../store/AuthContext';
import { useToast } from '../store/ToastContext';

export default function RxManageScreen({ route, navigation }) {
  const pick = route.params?.pick;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { isLoggedIn } = useAuth();
  const toast = useToast();

  const load = useCallback(async () => {
    if (!isLoggedIn) {
      setLoading(false);
      return;
    }
    try {
      const res = await prescriptionApi.list({ page: 1, limit: 30 });
      setItems(res.data || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn]);

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

  const remove = (item) =>
    Alert.alert('Delete prescription', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await prescriptionApi.cancel(item.prescription_id);
            toast.show('Prescription deleted', 'success');
            load();
          } catch (e) {
            toast.show(e.message, 'error');
          }
        },
      },
    ]);

  const choose = (item) => {
    if (pick) {
      navigation.navigate({ name: 'Checkout', params: { prescription: item }, merge: true });
    } else {
      navigation.navigate('RxDetail', { id: item.prescription_id });
    }
  };

  if (!isLoggedIn) {
    return (
      <Screen>
        <AppHeader title="My Prescriptions" back />
        <EmptyState
          icon="document-text-outline"
          title="Log in to manage prescriptions"
          actionTitle="Log in"
          onAction={() => navigation.navigate('Login')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader
        title={pick ? 'Select Prescription' : 'My Prescriptions'}
        back
        rightIcon="add"
        onRightPress={() => navigation.navigate('RxUpload')}
      />
      {loading ? (
        <Loader />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(p) => String(p.prescription_id)}
          contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <EmptyState
              icon="document-text-outline"
              title="No prescriptions yet"
              subtitle="Upload one and our pharmacist will verify it for you."
              actionTitle="Upload prescription"
              onAction={() => navigation.navigate('RxUpload')}
            />
          }
          renderItem={({ item }) => {
            const images = Array.isArray(item.images) ? item.images : [];
            return (
              <Pressable onPress={() => choose(item)}>
                <Card style={styles.card}>
                  <View style={styles.thumb}>
                    {images[0] ? (
                      <Image source={{ uri: mediaUrl(images[0]) }} style={styles.thumbImg} resizeMode="cover" />
                    ) : (
                      <Ionicons name="document-text-outline" size={20} color={colors.primary} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ref}>{item.reference_code || `#${item.prescription_id}`}</Text>
                    <Text style={styles.meta}>
                      {images.length} image(s) · {formatDate(item.created_at)}
                    </Text>
                    {item.patient_name ? <Text style={styles.meta}>Patient: {item.patient_name}</Text> : null}
                    {item.rejection_reason ? (
                      <Text style={styles.reject}>{item.rejection_reason}</Text>
                    ) : null}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 8 }}>
                    <StatusPill status={item.status} />
                    {!pick ? (
                      <Pressable onPress={() => remove(item)} hitSlop={8}>
                        <Text style={styles.delete}>Delete</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </Card>
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: radius.xs,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  ref: { fontSize: 12.5, fontWeight: '700', color: colors.text },
  meta: { fontSize: 10.5, color: colors.muted, marginTop: 3 },
  reject: { fontSize: 10.5, color: colors.accent, marginTop: 3 },
  delete: { fontSize: 10.5, color: colors.accent, fontWeight: '700' },
});
