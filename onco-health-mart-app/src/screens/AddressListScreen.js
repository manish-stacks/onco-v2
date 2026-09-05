import React, { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Screen from '../components/Screen';
import { AppHeader, Card, EmptyState, Loader, OutlineButton, Pill, PrimaryButton, StickyBottom } from '../components/ui';
import { colors } from '../theme';
import { addressApi } from '../api';
import { useToast } from '../store/ToastContext';

export default function AddressListScreen({ route, navigation }) {
  const mode = route.params?.mode || 'manage';
  const [addresses, setAddresses] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const list = (await addressApi.list()) || [];
      setAddresses(list);
      setSelected((prev) => {
        if (prev && list.some((a) => a.ad_id === prev)) return prev;
        const def = list.find((a) => String(a.is_default) === '1');
        return def ? def.ad_id : list[0]?.ad_id || null;
      });
    } catch {
      setAddresses([]);
    } finally {
      setLoading(false);
    }
  }, []);

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

  const removeAddress = (id) =>
    Alert.alert('Delete address', 'Are you sure you want to remove this address?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await addressApi.remove(id);
            toast.show('Address removed', 'success');
            load();
          } catch (e) {
            toast.show(e.message, 'error');
          }
        },
      },
    ]);

  const proceed = () => {
    const address = addresses.find((a) => a.ad_id === selected);
    if (!address) {
      toast.show('Please select a delivery address', 'error');
      return;
    }
    navigation.navigate('Checkout', { address });
  };

  if (loading) {
    return (
      <Screen>
        <AppHeader title={mode === 'checkout' ? 'Select Address' : 'Saved Addresses'} back />
        <Loader />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title={mode === 'checkout' ? 'Select Address' : 'Saved Addresses'} back />

      {addresses.length === 0 ? (
        <EmptyState
          icon="location-outline"
          title="No saved addresses"
          subtitle="Add a delivery address to place your order."
          actionTitle="+ Add new address"
          onAction={() => navigation.navigate('AddAddress')}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 20 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {addresses.map((a) => {
            const active = a.ad_id === selected;
            return (
              <Pressable key={String(a.ad_id)} onPress={() => setSelected(a.ad_id)}>
                <Card style={[styles.card, active && { borderWidth: 1.5, borderColor: colors.primary }]}>
                  <View style={styles.cardTop}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                      <Ionicons
                        name={a.type === 'Office' ? 'briefcase-outline' : 'home-outline'}
                        size={15}
                        color={colors.text}
                      />
                      <Text style={styles.name}>{a.full_name || a.type || 'Address'}</Text>
                    </View>
                    {String(a.is_default) === '1' ? <Pill text="Default" /> : null}
                  </View>
                  <Text style={styles.addr}>
                    {[a.house_no, a.stree_address, a.landmark, a.city, a.state].filter(Boolean).join(', ')} -{' '}
                    {a.pincode}
                  </Text>
                  <Text style={styles.phone}>Phone: {a.phone}</Text>

                  <View style={styles.actions}>
                    <Pressable onPress={() => navigation.navigate('AddAddress', { address: a })} hitSlop={6}>
                      <Text style={styles.action}>Edit</Text>
                    </Pressable>
                    {String(a.is_default) !== '1' ? (
                      <Pressable
                        onPress={async () => {
                          try {
                            await addressApi.setDefault(a.ad_id);
                            load();
                          } catch (e) {
                            toast.show(e.message, 'error');
                          }
                        }}
                        hitSlop={6}
                      >
                        <Text style={styles.action}>Set default</Text>
                      </Pressable>
                    ) : null}
                    <Pressable onPress={() => removeAddress(a.ad_id)} hitSlop={6}>
                      <Text style={[styles.action, { color: colors.accent }]}>Delete</Text>
                    </Pressable>
                  </View>
                </Card>
              </Pressable>
            );
          })}

          <OutlineButton title="+ Add new address" onPress={() => navigation.navigate('AddAddress')} />
        </ScrollView>
      )}

      {mode === 'checkout' && addresses.length > 0 ? (
        <StickyBottom>
          <PrimaryButton title="Deliver here" onPress={proceed} />
        </StickyBottom>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontSize: 13, fontWeight: '700', color: colors.text },
  addr: { fontSize: 11.5, color: colors.muted, marginTop: 6, lineHeight: 17 },
  phone: { fontSize: 11.5, color: colors.muted, marginTop: 3 },
  actions: { flexDirection: 'row', gap: 18, marginTop: 12 },
  action: { fontSize: 11.5, color: colors.primary, fontWeight: '700' },
});
