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
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import { AppHeader, Card, Field, OutlineButton, PrimaryButton, StickyBottom } from '../components/ui';
import { colors, radius } from '../theme';
import { prescriptionApi } from '../api';
import { cleanMobile } from '../utils/format';
import { useAuth } from '../store/AuthContext';
import { useToast } from '../store/ToastContext';

const MAX = 10;

export default function RxUploadScreen({ navigation }) {
  const [images, setImages] = useState([]);
  const [form, setForm] = useState({
    patient_name: '',
    doctor_name: '',
    hospital_name: '',
  });
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState({});
  const { customer, isLoggedIn } = useAuth();
  const toast = useToast();

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const addAssets = (assets) => {
    const next = assets.map((a) => ({
      uri: a.uri,
      name: a.fileName || `prescription_${Date.now()}.jpg`,
      type: a.mimeType || 'image/jpeg',
    }));
    setImages((prev) => [...prev, ...next].slice(0, MAX));
  };

  const pickGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return toast.show('Gallery permission is required', 'error');
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: MAX - images.length,
      quality: 0.7,
    });
    if (!res.canceled) addAssets(res.assets || []);
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return toast.show('Camera permission is required', 'error');
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!res.canceled) addAssets(res.assets || []);
  };

  const submit = async () => {
    if (!isLoggedIn) {
      toast.show('Please log in to upload a prescription');
      return navigation.navigate('Login');
    }
    if (!images.length) return toast.show('Add at least one prescription image', 'error');

    const nextErrors = {};
    if (!form.patient_name.trim()) nextErrors.patient_name = 'Patient name is required';
    if (!form.doctor_name.trim()) nextErrors.doctor_name = "Doctor's name is required";
    if (!form.hospital_name.trim()) nextErrors.hospital_name = 'Hospital / clinic name is required';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      return toast.show('Please fill in patient, doctor and hospital name', 'error');
    }

    setUploading(true);
    try {
      const body = new FormData();
      images.forEach((img) => body.append('images', { uri: img.uri, name: img.name, type: img.type }));
      Object.entries(form).forEach(([k, v]) => {
        if (v) body.append(k, v);
      });
      if (customer?.mobile) body.append('contact_number', cleanMobile(customer.mobile));

      const result = await prescriptionApi.upload(body);
      toast.show('Prescription submitted for review', 'success');
      navigation.replace('RxManage', { highlight: result?.prescription_id });
    } catch (e) {
      toast.show(e.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Screen>
      <AppHeader title="Upload Prescription" back />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable style={styles.uploadBox} onPress={pickGallery}>
            <Ionicons name="cloud-upload-outline" size={30} color={colors.primaryDark} />
            <Text style={styles.uploadTitle}>Tap to upload your prescription</Text>
            <Text style={styles.uploadSub}>JPG or PNG · up to {MAX} images</Text>
          </Pressable>

          <View style={{ flexDirection: 'row', gap: 10, marginVertical: 14 }}>
            <OutlineButton title="Take Photo" icon="camera-outline" onPress={takePhoto} style={{ flex: 1 }} />
            <OutlineButton title="Gallery" icon="images-outline" onPress={pickGallery} style={{ flex: 1 }} />
          </View>

          {images.length ? (
            <View style={styles.thumbs}>
              {images.map((img, i) => (
                <View key={`${img.uri}-${i}`} style={styles.thumb}>
                  <Image source={{ uri: img.uri }} style={styles.thumbImg} />
                  <Pressable
                    style={styles.thumbRemove}
                    onPress={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    <Ionicons name="close" size={12} color="#fff" />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          <Text style={styles.sectionTitle}>Prescription details</Text>
          <Field
            label="Patient name *"
            value={form.patient_name}
            onChangeText={(v) => { set('patient_name')(v); setErrors((e) => ({ ...e, patient_name: null })); }}
            placeholder="Patient full name"
          />
          {errors.patient_name ? <Text style={styles.errorText}>{errors.patient_name}</Text> : null}
          <Field
            label="Doctor's name *"
            value={form.doctor_name}
            onChangeText={(v) => { set('doctor_name')(v); setErrors((e) => ({ ...e, doctor_name: null })); }}
            placeholder="Dr. Name"
          />
          {errors.doctor_name ? <Text style={styles.errorText}>{errors.doctor_name}</Text> : null}
          <Field
            label="Hospital / Clinic name *"
            value={form.hospital_name}
            onChangeText={(v) => { set('hospital_name')(v); setErrors((e) => ({ ...e, hospital_name: null })); }}
            placeholder="Hospital name"
            style={{ marginBottom: 4 }}
          />
          {errors.hospital_name ? <Text style={styles.errorText}>{errors.hospital_name}</Text> : null}

          <Card style={{ backgroundColor: colors.primaryLight }}>
            <Text style={styles.tipTitle}>Tips for a clear upload</Text>
            <Text style={styles.tipText}>
              Use good lighting, keep the whole page in frame, and make sure the doctor's name, date and signature are
              readable.
            </Text>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
      <StickyBottom>
        <PrimaryButton title="Submit Prescription" onPress={submit} loading={uploading} />
      </StickyBottom>
    </Screen>
  );
}

const styles = StyleSheet.create({
  uploadBox: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 28,
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
  },
  uploadTitle: { fontSize: 12.5, fontWeight: '700', color: colors.primaryDark, marginTop: 8 },
  uploadSub: { fontSize: 10.5, color: colors.primaryDark, marginTop: 4, opacity: 0.8 },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  thumb: { width: 72, height: 72, borderRadius: radius.xs, overflow: 'hidden', position: 'relative' },
  thumbImg: { width: '100%', height: '100%' },
  thumbRemove: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(27,36,48,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 10 },
  errorText: { fontSize: 10.5, color: colors.accent, marginTop: -8, marginBottom: 10 },
  tipTitle: { fontSize: 12, fontWeight: '700', color: colors.primaryDark },
  tipText: { fontSize: 11.5, color: colors.primaryDark, marginTop: 5, lineHeight: 17 },
});
