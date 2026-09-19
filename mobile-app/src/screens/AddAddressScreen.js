import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Screen from '../components/Screen';
import { AppHeader, Chip, Field, PrimaryButton, StickyBottom } from '../components/ui';
import { colors } from '../theme';
import { addressApi } from '../api';
import { cleanMobile } from '../utils/format';
import { useAuth } from '../store/AuthContext';
import { useToast } from '../store/ToastContext';

const TYPES = ['Home', 'Office', 'Other'];

export default function AddAddressScreen({ route, navigation }) {
  const editing = route.params?.address || null;
  const { customer } = useAuth();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    full_name: editing?.full_name || customer?.customer_name || '',
    phone: editing?.phone || customer?.mobile || '',
    pincode: editing?.pincode || '',
    house_no: editing?.house_no || '',
    stree_address: editing?.stree_address || '',
    landmark: editing?.landmark || '',
    city: editing?.city || '',
    state: editing?.state || '',
    type: editing?.type || 'Home',
  });

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  // Auto-fill City/State from the PIN code — India Post's free public API, no
  // key needed. Fires once the user has typed a full 6-digit PIN, and re-fills
  // City/State every time the PIN changes.
  const [pinLookup, setPinLookup] = useState('idle'); // idle | loading | done | error

  useEffect(() => {
    const pin = form.pincode;
    if (!/^\d{6}$/.test(pin)) {
      setPinLookup('idle');
      return;
    }
    let cancelled = false;
    setPinLookup('loading');
    const timer = setTimeout(() => {
      fetch(`https://api.postalpincode.in/pincode/${pin}`)
        .then((res) => res.json())
        .then((data) => {
          if (cancelled) return;
          const office = data?.[0]?.Status === 'Success' ? data[0].PostOffice?.[0] : null;
          if (office) {
            setForm((prev) =>
              prev.pincode !== pin ? prev : { ...prev, city: office.District, state: office.State }
            );
            setPinLookup('done');
          } else {
            setPinLookup('error');
          }
        })
        .catch(() => {
          if (!cancelled) setPinLookup('error');
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form.pincode]);

  const save = async () => {
    const payload = { ...form, phone: cleanMobile(form.phone) };

    if (!payload.full_name || payload.full_name.trim().length < 3)
      return toast.show('Please enter the full name', 'error');
    if (payload.phone.length !== 10) return toast.show('Enter a valid 10-digit mobile number', 'error');
    if (!payload.house_no) return toast.show('House / Flat number is required', 'error');
    if (!payload.stree_address || payload.stree_address.length < 3)
      return toast.show('Please enter the street address', 'error');
    if (!payload.city) return toast.show('City is required', 'error');
    if (!payload.state) return toast.show('State is required', 'error');
    if (!/^\d{6}$/.test(payload.pincode)) return toast.show('Enter a valid 6-digit PIN code', 'error');

    setSaving(true);
    try {
      if (editing) {
        await addressApi.update(editing.ad_id, payload);
        toast.show('Address updated', 'success');
      } else {
        await addressApi.create(payload);
        toast.show('Address saved', 'success');
      }
      navigation.goBack();
    } catch (e) {
      toast.show(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <AppHeader title={editing ? 'Edit Address' : 'Add Address'} back />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <Field label="Full name" value={form.full_name} onChangeText={set('full_name')} placeholder="Full name" />
          <Field
            label="Phone number"
            value={form.phone}
            onChangeText={set('phone')}
            keyboardType="number-pad"
            maxLength={10}
            placeholder="98765 43210"
          />
          <View>
            <Field
              label="Pincode"
              value={form.pincode}
              onChangeText={set('pincode')}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="110085"
            />
            {pinLookup === 'loading' ? (
              <View style={styles.pinHint}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.pinHintText}>Finding city & state...</Text>
              </View>
            ) : null}
            {pinLookup === 'error' ? (
              <Text style={[styles.pinHintText, { color: colors.danger || '#d33', marginBottom: 6 }]}>
                Couldn't find this PIN code — please enter city & state manually.
              </Text>
            ) : null}
          </View>
          <Field
            label="House / Flat number"
            value={form.house_no}
            onChangeText={set('house_no')}
            placeholder="221B"
          />
          <Field
            label="Street address"
            value={form.stree_address}
            onChangeText={set('stree_address')}
            placeholder="Sector 12, Rohini"
          />
          <Field
            label="Landmark (optional)"
            value={form.landmark}
            onChangeText={set('landmark')}
            placeholder="Near City Park"
          />
          <Field label="City" value={form.city} onChangeText={set('city')} placeholder="Delhi" />
          <Field label="State" value={form.state} onChangeText={set('state')} placeholder="Delhi" />

          <Text style={styles.label}>Save as</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {TYPES.map((t) => (
              <Chip key={t} text={t} active={form.type === t} onPress={() => set('type')(t)} />
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <StickyBottom>
        <PrimaryButton title={editing ? 'Update address' : 'Save address'} onPress={save} loading={saving} />
      </StickyBottom>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 11, color: colors.muted, marginBottom: 6, marginTop: 4 },
  pinHint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, marginTop: -6 },
  pinHintText: { fontSize: 10.5, color: colors.muted },
});
