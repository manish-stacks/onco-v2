import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Screen from '../components/Screen';
import { Field, PrimaryButton } from '../components/ui';
import { colors } from '../theme';
import { authApi } from '../api';
import { cleanMobile } from '../utils/format';
import { useToast } from '../store/ToastContext';
import { useSettings } from '../store/SettingsContext';

export default function LoginScreen({ navigation }) {
  const [mobile, setMobile] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const { settings } = useSettings();

  const submit = async () => {
    const m = cleanMobile(mobile);
    if (m.length !== 10) {
      toast.show('Please enter a valid 10-digit mobile number', 'error');
      return;
    }
    setLoading(true);
    try {
      const data = await authApi.requestOtp(m);
      navigation.navigate('Otp', {
        mobile: m,
        customer_id: data.customer_id,
        is_new_user: data.is_new_user,
        expires_in: data.expires_in,
        dev_otp: data.dev_otp,
      });
    } catch (e) {
      toast.show(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          <Image
            source={require('../../assets/logo/ic_launcher_foreground.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Welcome to {settings?.organization || 'Onco Health Mart'}</Text>
          <Text style={styles.sub}>Log in with your mobile number to continue</Text>

          <View style={{ width: '100%', marginTop: 26 }}>
            <Field
              label="Mobile number"
              placeholder="98765 43210"
              keyboardType="number-pad"
              maxLength={10}
              value={mobile}
              onChangeText={setMobile}
              returnKeyType="done"
              onSubmitEditing={submit}
            />
            <PrimaryButton title="Continue" onPress={submit} loading={loading} />
          </View>

          <Pressable onPress={() => navigation.goBack()} style={{ marginTop: 22 }}>
            <Text style={styles.skip}>Continue browsing</Text>
          </Pressable>

          <Text style={styles.terms}>
            By continuing you agree to our Terms of Service and Privacy Policy.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 26 },
  logo: { width: 96, height: 96, marginBottom: 14 },
  title: { fontSize: 18, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  sub: { fontSize: 12.5, color: colors.muted, marginTop: 6, textAlign: 'center' },
  skip: { fontSize: 12.5, color: colors.primary, fontWeight: '600' },
  terms: { fontSize: 10.5, color: colors.muted, textAlign: 'center', marginTop: 26, lineHeight: 16 },
});
