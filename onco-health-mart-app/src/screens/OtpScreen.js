import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Screen from '../components/Screen';
import { AppHeader, PrimaryButton } from '../components/ui';
import { colors, radius } from '../theme';
import { authApi } from '../api';
import { useAuth } from '../store/AuthContext';
import { useToast } from '../store/ToastContext';
import { getPushToken } from '../utils/push';

const LENGTH = 6;

export default function OtpScreen({ route, navigation }) {
  const { mobile, customer_id, dev_otp } = route.params || {};
  const [code, setCode] = useState(dev_otp ? String(dev_otp) : '');
  const [loading, setLoading] = useState(false);
  const [seconds, setSeconds] = useState(30);
  const inputRef = useRef(null);
  const { signIn } = useAuth();
  const toast = useToast();

  useEffect(() => {
    if (seconds <= 0) return undefined;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(t);
  }, []);

  const verify = async (value) => {
    const otp = value || code;
    if (otp.length < 4) {
      toast.show('Please enter the code we sent you', 'error');
      return;
    }
    setLoading(true);
    try {
      const fcm = await getPushToken();
      const data = await authApi.verifyOtp({
        customer_id,
        otp,
        fcm_token: fcm || undefined,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
      });
      await signIn(data);
      navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
    } catch (e) {
      toast.show(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    try {
      const data = await authApi.requestOtp(mobile);
      setSeconds(30);
      if (data?.dev_otp) setCode(String(data.dev_otp));
      toast.show('A new code has been sent', 'success');
    } catch (e) {
      toast.show(e.message, 'error');
    }
  };

  const boxes = Array.from({ length: LENGTH });

  return (
    <Screen>
      <AppHeader title="Verify your number" back />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          <Text style={styles.sub}>Code sent to +91 {mobile}</Text>

          <Pressable style={styles.boxRow} onPress={() => inputRef.current?.focus()}>
            {boxes.map((_, i) => (
              <View key={i} style={[styles.box, code.length === i && styles.boxActive]}>
                <Text style={styles.boxText}>{code[i] || ''}</Text>
              </View>
            ))}
          </Pressable>

          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={(t) => {
              const v = t.replace(/\D/g, '').slice(0, LENGTH);
              setCode(v);
              if (v.length === LENGTH) verify(v);
            }}
            keyboardType="number-pad"
            maxLength={LENGTH}
            style={styles.hidden}
            autoFocus
          />

          <PrimaryButton title="Verify" onPress={() => verify()} loading={loading} style={{ width: '100%' }} />

          {seconds > 0 ? (
            <Text style={styles.resendMuted}>Resend code in 00:{String(seconds).padStart(2, '0')}</Text>
          ) : (
            <Pressable onPress={resend} style={{ marginTop: 14 }}>
              <Text style={styles.resend}>Resend code</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 26 },
  sub: { fontSize: 12.5, color: colors.muted, marginBottom: 20 },
  boxRow: { flexDirection: 'row', gap: 8, marginBottom: 26 },
  box: {
    width: 44,
    height: 50,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: { borderColor: colors.primary },
  boxText: { fontSize: 19, fontWeight: '700', color: colors.text },
  hidden: { position: 'absolute', opacity: 0, height: 1, width: 1 },
  resendMuted: { fontSize: 11.5, color: colors.muted, marginTop: 14 },
  resend: { fontSize: 12.5, color: colors.primary, fontWeight: '700' },
});
