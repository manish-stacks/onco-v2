import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import { AppHeader, Card, PrimaryButton } from '../components/ui';
import { colors, radius } from '../theme';
import { useAuth } from '../store/AuthContext';
import { useSettings } from '../store/SettingsContext';
import { useToast } from '../store/ToastContext';

const MENU = [
  { key: 'Orders', icon: 'cube-outline', label: 'My Orders' },
  { key: 'RxManage', icon: 'document-text-outline', label: 'Prescriptions' },
  { key: 'AddressList', icon: 'location-outline', label: 'Saved Addresses' },
  { key: 'Wishlist', icon: 'heart-outline', label: 'Wishlist' },
  { key: 'Offers', icon: 'pricetags-outline', label: 'Offers & Coupons' },
  { key: 'Notifications', icon: 'notifications-outline', label: 'Notifications' },
  { key: 'Help', icon: 'headset-outline', label: 'Help & Support' },
];

export default function ProfileScreen({ navigation }) {
  const { customer, isLoggedIn, logout, deleteAccount } = useAuth();
  const { settings } = useSettings();
  const toast = useToast();

  const confirmLogout = () =>
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: logout },
    ]);

  const confirmDeleteAccount = () =>
    Alert.alert(
      'Delete account',
      'This permanently deletes your account and personal data. Your order history is kept for legal/accounting records, but you will not be able to log back in with this number. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Are you sure?', 'This is permanent and cannot be reversed.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Yes, delete my account',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await deleteAccount();
                    toast.show('Your account has been deleted');
                  } catch (e) {
                    toast.show(e?.message || 'Could not delete account, please try again', 'error');
                  }
                },
              },
            ]),
        },
      ]
    );

  return (
    <Screen>
      <AppHeader
        title="Profile"
        rightIcon="settings-outline"
        onRightPress={() => navigation.navigate('Settings')}
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 30 }}>
        <View style={styles.head}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={28} color={colors.primary} />
          </View>
          {isLoggedIn ? (
            <>
              <Text style={styles.name}>{customer?.customer_name || 'Customer'}</Text>
              <Text style={styles.contact}>+91 {customer?.mobile}</Text>
              {customer?.email_id ? <Text style={styles.contact}>{customer.email_id}</Text> : null}
              <Pressable onPress={() => navigation.navigate('EditProfile')} style={{ marginTop: 8 }}>
                <Text style={styles.edit}>Edit profile</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.name}>Welcome</Text>
              <Text style={styles.contact}>Log in to manage your orders and prescriptions</Text>
              <PrimaryButton
                title="Log in"
                onPress={() => navigation.navigate('Login')}
                style={{ marginTop: 16, width: 200 }}
              />
            </>
          )}
        </View>

        {MENU.map((m) => (
          <Pressable key={m.key} onPress={() => navigation.navigate(m.key)}>
            <Card style={styles.row}>
              <Ionicons name={m.icon} size={18} color={colors.text} />
              <Text style={styles.rowText}>{m.label}</Text>
              <Ionicons name="chevron-forward" size={17} color={colors.muted} />
            </Card>
          </Pressable>
        ))}

        {isLoggedIn ? (
          <>
            <Pressable onPress={confirmLogout}>
              <Card style={styles.row}>
                <Ionicons name="log-out-outline" size={18} color={colors.accent} />
                <Text style={[styles.rowText, { color: colors.accent }]}>Log out</Text>
              </Card>
            </Pressable>
            <Pressable onPress={confirmDeleteAccount}>
              <Card style={styles.row}>
                <Ionicons name="trash-outline" size={18} color={colors.accent} />
                <Text style={[styles.rowText, { color: colors.accent }]}>Delete account</Text>
              </Card>
            </Pressable>
          </>
        ) : null}

        <Text style={styles.footer}>
          {settings?.organization || 'Onco Health Mart'}
          {settings?.contact_phone ? `\n${settings.contact_phone}` : ''}
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', paddingVertical: 10, paddingBottom: 22 },
  avatar: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  contact: { fontSize: 11.5, color: colors.muted, marginTop: 3, textAlign: 'center' },
  edit: { fontSize: 12, color: colors.primary, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  rowText: { flex: 1, fontSize: 13, color: colors.text },
  footer: { fontSize: 10.5, color: colors.muted, textAlign: 'center', marginTop: 20, lineHeight: 16 },
});
