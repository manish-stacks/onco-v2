import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import { AppHeader, Card, Field, PrimaryButton, SectionTitle } from '../components/ui';
import { colors, radius } from '../theme';
import { cmsApi } from '../api';
import { useAuth } from '../store/AuthContext';
import { useSettings } from '../store/SettingsContext';
import { useToast } from '../store/ToastContext';

export default function HelpScreen({ navigation }) {
  const { settings, pages } = useSettings();
  const { customer } = useAuth();
  const toast = useToast();
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({
    name: customer?.customer_name || '',
    email: customer?.email_id || '',
    phone: customer?.mobile || '',
    message: '',
  });

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const send = async () => {
    if (!form.name.trim()) return toast.show('Please enter your name', 'error');
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return toast.show('Enter a valid email address', 'error');
    if (!form.message.trim()) return toast.show('Please describe your issue', 'error');

    setSending(true);
    try {
      await cmsApi.contact(form);
      toast.show('Thanks — our team will get back to you soon', 'success');
      setForm((f) => ({ ...f, message: '' }));
    } catch (e) {
      toast.show(e.message, 'error');
    } finally {
      setSending(false);
    }
  };

  const quick = [
    { icon: 'cube-outline', label: 'Track my order', onPress: () => navigation.navigate('Orders') },
    { icon: 'document-text-outline', label: 'Prescription issue', onPress: () => navigation.navigate('RxManage') },
    { icon: 'card-outline', label: 'Payment or refund status', onPress: () => navigation.navigate('Orders') },
  ];

  return (
    <Screen>
      <AppHeader title="Help & Support" back />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 30 }}>
        <SectionTitle title="Quick actions" />
        {quick.map((q) => (
          <Pressable key={q.label} onPress={q.onPress}>
            <Card style={styles.row}>
              <Ionicons name={q.icon} size={18} color={colors.text} />
              <Text style={styles.rowText}>{q.label}</Text>
              <Ionicons name="chevron-forward" size={17} color={colors.muted} />
            </Card>
          </Pressable>
        ))}

        <SectionTitle title="Contact us" />
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
          {settings?.contact_phone ? (
            <Pressable
              style={[styles.contactBtn]}
              onPress={() => Linking.openURL(`tel:${settings.contact_phone}`)}
            >
              <Ionicons name="call-outline" size={18} color={colors.primary} />
              <Text style={styles.contactText}>Call us</Text>
            </Pressable>
          ) : null}
          {settings?.contact_email ? (
            <Pressable
              style={[styles.contactBtn]}
              onPress={() => Linking.openURL(`mailto:${settings.contact_email}`)}
            >
              <Ionicons name="mail-outline" size={18} color={colors.primary} />
              <Text style={styles.contactText}>Email us</Text>
            </Pressable>
          ) : null}
        </View>
        {settings?.contact_address ? (
          <Card>
            <Text style={styles.addrTitle}>{settings.organization}</Text>
            <Text style={styles.addr}>{settings.contact_address}</Text>
          </Card>
        ) : null}

        <SectionTitle title="Send us a message" />
        <Field label="Your name" value={form.name} onChangeText={set('name')} placeholder="Full name" />
        <Field
          label="Email"
          value={form.email}
          onChangeText={set('email')}
          placeholder="you@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Field
          label="Phone"
          value={form.phone}
          onChangeText={set('phone')}
          keyboardType="number-pad"
          maxLength={10}
          placeholder="98765 43210"
        />
        <Field
          label="How can we help?"
          value={form.message}
          onChangeText={set('message')}
          placeholder="Describe your issue"
          multiline
          numberOfLines={4}
          style={{ marginBottom: 4 }}
        />
        <PrimaryButton title="Send message" onPress={send} loading={sending} />

        {pages?.length ? (
          <View style={{ marginTop: 22 }}>
            <SectionTitle title="Policies" />
            {pages.map((p) => (
              <Pressable key={p.slug} onPress={() => navigation.navigate('CmsPage', { slug: p.slug, title: p.name })}>
                <Card style={styles.row}>
                  <Ionicons name="document-outline" size={17} color={colors.text} />
                  <Text style={styles.rowText}>{p.name}</Text>
                  <Ionicons name="chevron-forward" size={17} color={colors.muted} />
                </Card>
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  rowText: { flex: 1, fontSize: 12.5, color: colors.text },
  contactBtn: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  contactText: { fontSize: 12.5, color: colors.primary, fontWeight: '700' },
  addrTitle: { fontSize: 12.5, fontWeight: '700', color: colors.text },
  addr: { fontSize: 11.5, color: colors.muted, marginTop: 4, lineHeight: 17 },
});
