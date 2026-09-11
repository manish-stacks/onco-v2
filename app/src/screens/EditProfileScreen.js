import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import { AppHeader, Field, PrimaryButton, StickyBottom } from '../components/ui';
import { colors } from '../theme';
import { authApi } from '../api';
import { useAuth } from '../store/AuthContext';
import { useToast } from '../store/ToastContext';

export default function EditProfileScreen({ navigation }) {
  const { customer, setCustomer } = useAuth();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    customer_name: customer?.customer_name || '',
    email_id: customer?.email_id || '',
  });

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    if (!form.customer_name.trim()) return toast.show('Name cannot be empty', 'error');
    if (form.email_id && !/^\S+@\S+\.\S+$/.test(form.email_id))
      return toast.show('Enter a valid email address', 'error');

    setSaving(true);
    try {
      const updated = await authApi.updateProfile({
        customer_name: form.customer_name.trim(),
        email_id: form.email_id.trim() || null,
      });
      setCustomer(updated);
      toast.show('Profile updated', 'success');
      navigation.goBack();
    } catch (e) {
      toast.show(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <AppHeader title="Edit Profile" back />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.head}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={26} color={colors.primary} />
            </View>
          </View>

          <Field
            label="Full name"
            value={form.customer_name}
            onChangeText={set('customer_name')}
            placeholder="Your full name"
          />
          <Field
            label="Email"
            value={form.email_id}
            onChangeText={set('email_id')}
            placeholder="you@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Field
            label="Mobile number"
            value={customer?.mobile || ''}
            editable={false}
            style={{ opacity: 0.65 }}
          />
          <Text style={styles.note}>
            Your mobile number is used to log in and cannot be changed here. Contact support if you need it updated.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
      <StickyBottom>
        <PrimaryButton title="Save changes" onPress={save} loading={saving} />
      </StickyBottom>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', paddingBottom: 18 },
  avatar: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: { fontSize: 11, color: colors.muted, lineHeight: 17 },
});
