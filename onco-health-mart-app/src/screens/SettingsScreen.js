import React, { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import Screen from '../components/Screen';
import { AppHeader, Card, SectionTitle } from '../components/ui';
import { colors } from '../theme';
import { authApi } from '../api';
import { getPushToken } from '../utils/push';
import { useAuth } from '../store/AuthContext';
import { useSettings } from '../store/SettingsContext';
import { useToast } from '../store/ToastContext';

const PUSH_KEY = 'ohm_push_enabled';

export default function SettingsScreen({ navigation }) {
  const [push, setPush] = useState(true);
  const { isLoggedIn, logout } = useAuth();
  const { settings } = useSettings();
  const toast = useToast();

  useEffect(() => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem(PUSH_KEY);
        setPush(v !== '0');
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const togglePush = async (value) => {
    setPush(value);
    try {
      await AsyncStorage.setItem(PUSH_KEY, value ? '1' : '0');
      const token = await getPushToken();
      if (!token) return;
      if (value) await authApi.registerDevice(token);
      else await authApi.unregisterDevice(token);
    } catch (e) {
      toast.show(e.message, 'error');
    }
  };

  const deleteAccount = () =>
    Alert.alert(
      'Delete account',
      'Account deletion is handled by our support team so we can settle any open orders. Contact us to proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Contact support',
          onPress: () => {
            if (settings?.contact_email) Linking.openURL(`mailto:${settings.contact_email}?subject=Delete my account`);
            else navigation.navigate('Help');
          },
        },
      ]
    );

  return (
    <Screen>
      <AppHeader title="Settings" back />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 30 }}>
        <SectionTitle title="Notifications" />
        <Card style={styles.row}>
          <Text style={styles.rowText}>Push notifications</Text>
          <Switch
            value={push}
            onValueChange={togglePush}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor="#fff"
          />
        </Card>

        <SectionTitle title="Account" />
        {isLoggedIn ? (
          <>
            <Pressable onPress={() => navigation.navigate('EditProfile')}>
              <Card style={styles.row}>
                <Text style={styles.rowText}>Edit profile</Text>
                <Text style={styles.link}>Open</Text>
              </Card>
            </Pressable>
            <Pressable onPress={() => navigation.navigate('AddressList')}>
              <Card style={styles.row}>
                <Text style={styles.rowText}>Saved addresses</Text>
                <Text style={styles.link}>Open</Text>
              </Card>
            </Pressable>
            <Pressable onPress={logout}>
              <Card style={styles.row}>
                <Text style={[styles.rowText, { color: colors.accent }]}>Log out</Text>
              </Card>
            </Pressable>
            <Pressable onPress={deleteAccount}>
              <Card style={styles.row}>
                <Text style={[styles.rowText, { color: colors.accent }]}>Delete account</Text>
              </Card>
            </Pressable>
          </>
        ) : (
          <Pressable onPress={() => navigation.navigate('Login')}>
            <Card style={styles.row}>
              <Text style={styles.rowText}>Log in</Text>
              <Text style={styles.link}>Open</Text>
            </Card>
          </Pressable>
        )}

        <SectionTitle title="About" />
        <Card>
          <Text style={styles.about}>
            {settings?.organization || 'Onco Health Mart'}
            {'\n'}App version {Constants?.expoConfig?.version || '1.0.4'}
          </Text>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  rowText: { fontSize: 13, color: colors.text },
  link: { fontSize: 12, color: colors.primary, fontWeight: '700' },
  about: { fontSize: 12, color: colors.muted, lineHeight: 19 },
});
