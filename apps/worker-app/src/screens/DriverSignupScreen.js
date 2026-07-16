import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, StatusBar, ActivityIndicator, Modal, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { sendOTP, uploadImage } from '../services/driverService';

const AREAS = [
  'Addis Ketema', 'Akaky Kaliti', 'Arada', 'Bole', 'Gullele',
  'Kirkos', 'Kolfe Keranio', 'Lideta', 'Nifas Silk-Lafto', 'Yeka',
];
const VEHICLES = ['Motorcycle', 'Bicycle', 'Car', 'Mini Truck', 'On Foot'];

const PRIMARY   = '#006e2f';
const PRIMARY_C = '#22c55e';
const BG        = '#f8f9ff';
const SURFACE   = '#eef4ff';

// ── Dropdown selector ─────────────────────────────────────────────────────────
const SelectField = ({ label, options, value, onChange }) => {
  const [open, setOpen] = useState(false);
  return (
    <View style={f.group}>
      <Text style={f.label}>{label}</Text>
      <TouchableOpacity
        style={[f.input, f.selectBtn]}
        onPress={() => setOpen(!open)}
        activeOpacity={0.8}
      >
        <Text style={[f.inputText, !value && { color: '#9aaa99' }]}>
          {value || `Select ${label}`}
        </Text>
        <MaterialIcons name={open ? 'expand-less' : 'expand-more'} size={22} color="#5c5f60" />
      </TouchableOpacity>
      {open && (
        <View style={f.dropdown}>
          {options.map(opt => (
            <TouchableOpacity
              key={opt}
              style={[f.dropdownItem, value === opt && f.dropdownItemActive]}
              onPress={() => { onChange(opt); setOpen(false); }}
            >
              <Text style={[f.dropdownText, value === opt && f.dropdownTextActive]}>{opt}</Text>
              {value === opt && <MaterialIcons name="check" size={16} color={PRIMARY} />}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function DriverSignupScreen({ navigation }) {
  const [fullName, setFullName]         = useState('');
  const [phone, setPhone]               = useState('');
  const [email, setEmail]               = useState('');
  const [area, setArea]                 = useState('');
  const [vehicle, setVehicle]           = useState('');
  const [idImage, setIdImage]           = useState(null);
  const [faceImage, setFaceImage]       = useState(null);
  const [cameraOpen, setCameraOpen]     = useState(false);
  const [faceCaptured, setFaceCaptured] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  const isValid = fullName.trim() && phone.length >= 9 && area && vehicle;

  const pickIdImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled) setIdImage(result.assets[0].uri);
  };

  const openCamera = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert('Permission needed', 'Camera access is required for face verification.');
        return;
      }
    }
    setCameraOpen(true);
  };

  const captureFace = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      setFaceImage(photo.uri);
      setFaceCaptured(true);
      setCameraOpen(false);
    }
  };

  const handleSubmit = async () => {
    if (!isValid) return;
    setLoading(true);
    try {
      const fullPhone = `+251${phone}`;

      // Pass raw image URIs — upload happens AFTER OTP verification
      const signupData = {
        full_name:    fullName.trim(),
        area,
        vehicle_type: vehicle.toUpperCase().replace(/ /g, '_'),
        email:        email.trim(),
        idImageUri:   idImage   || null,
        faceImageUri: faceImage || null,
      };

      // Send OTP via Supabase
      await sendOTP(fullPhone);

      navigation.navigate('DriverOtp', { phone: fullPhone, signupData });
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <MaterialIcons name="arrow-back" size={22} color="#151c25" />
          </TouchableOpacity>
          <View style={s.logoBox}>
            <MaterialIcons name="local-shipping" size={36} color={PRIMARY} />
          </View>
          <Text style={s.brandName}>Lucky Delivery</Text>
          <Text style={s.title}>Create Driver Account</Text>
          <Text style={s.subtitle}>Join as a driver to start earning with Lucky Delivery</Text>
        </View>

        {/* Form */}
        <View style={s.form}>

          {/* Full Name */}
          <View style={f.group}>
            <Text style={f.label}>Full Name</Text>
            <TextInput
              style={f.input}
              placeholder="Enter your full name"
              placeholderTextColor="#9aaa99"
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
            />
          </View>

          {/* Phone */}
          <View style={f.group}>
            <Text style={f.label}>Phone Number</Text>
            <View style={f.phoneRow}>
              <View style={f.prefix}>
                <Text style={f.prefixText}>+251</Text>
                <View style={f.prefixDivider} />
              </View>
              <TextInput
                style={f.phoneInput}
                placeholder="911 123 456"
                placeholderTextColor="#9aaa99"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                maxLength={10}
              />
            </View>
          </View>

          {/* Email */}
          <View style={f.group}>
            <Text style={f.label}>Email (Optional)</Text>
            <TextInput
              style={f.input}
              placeholder="example@mail.com"
              placeholderTextColor="#9aaa99"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          {/* Area */}
          <SelectField label="Area / Sub-city" options={AREAS} value={area} onChange={setArea} />

          {/* Vehicle */}
          <SelectField label="Vehicle Type" options={VEHICLES} value={vehicle} onChange={setVehicle} />

          {/* ID Upload */}
          <View style={f.group}>
            <Text style={f.label}>Upload ID Card</Text>
            <TouchableOpacity
              style={[f.uploadBox, idImage && f.uploadBoxDone]}
              onPress={pickIdImage}
              activeOpacity={0.7}
            >
              <MaterialIcons
                name={idImage ? 'check-circle' : 'document-scanner'}
                size={32} color={PRIMARY}
              />
              <Text style={f.uploadTitle}>{idImage ? 'ID Uploaded ✓' : 'Tap to upload ID'}</Text>
              <Text style={f.uploadSub}>{idImage ? 'Tap to change' : 'PNG, JPG up to 5MB'}</Text>
            </TouchableOpacity>
          </View>

          {/* Face Scan */}
          <View style={f.group}>
            <Text style={f.label}>Face Verification</Text>
            <Text style={f.sublabel}>Take a live selfie to verify your identity matches your ID</Text>
            <TouchableOpacity
              style={[f.uploadBox, faceCaptured && f.uploadBoxDone]}
              onPress={openCamera}
              activeOpacity={0.7}
            >
              <MaterialIcons
                name={faceCaptured ? 'verified-user' : 'face'}
                size={32} color={PRIMARY}
              />
              <Text style={f.uploadTitle}>{faceCaptured ? 'Face Verified ✓' : 'Scan Your Face'}</Text>
              <Text style={f.uploadSub}>
                {faceCaptured ? 'Tap to retake' : 'Open camera for live verification'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[s.btn, !isValid && s.btnDisabled]}
            onPress={handleSubmit}
            activeOpacity={0.85}
            disabled={!isValid || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={s.btnText}>Create Account & Verify</Text>
                <MaterialIcons name="arrow-forward" size={20} color="#fff" style={{ marginLeft: 8 }} />
              </>
            )}
          </TouchableOpacity>

          {/* Login link */}
          <View style={s.loginRow}>
            <Text style={s.loginText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={s.loginLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Camera Modal for face scan */}
      <Modal visible={cameraOpen} animationType="slide">
        <View style={cam.container}>
          <CameraView ref={cameraRef} style={cam.camera} facing="front">
            <View style={cam.overlay}>
              <Text style={cam.guideText}>Position your face in the circle</Text>
              <View style={cam.faceGuide} />
              <View style={cam.btnRow}>
                <TouchableOpacity style={cam.cancelBtn} onPress={() => setCameraOpen(false)}>
                  <Text style={cam.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={cam.captureBtn} onPress={captureFace}>
                  <MaterialIcons name="camera" size={32} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </CameraView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  scroll: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 48 },

  header: { alignItems: 'center', marginBottom: 32 },
  backBtn: {
    alignSelf: 'flex-start', width: 40, height: 40, borderRadius: 20,
    backgroundColor: SURFACE, alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  logoBox: {
    width: 72, height: 72, borderRadius: 20, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4, marginBottom: 10,
  },
  brandName: { fontSize: 20, fontWeight: '600', color: PRIMARY, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '700', color: '#151c25', marginBottom: 6, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#5c5f60', textAlign: 'center' },

  form: { gap: 16 },

  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: PRIMARY_C, borderRadius: 12, height: 56, marginTop: 8,
    shadowColor: PRIMARY_C, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 20, elevation: 6,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  loginRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  loginText: { fontSize: 14, color: '#5c5f60' },
  loginLink: { fontSize: 14, fontWeight: '700', color: PRIMARY },
});

const f = StyleSheet.create({
  group: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600', color: '#3d4a3d', paddingHorizontal: 4 },
  sublabel: { fontSize: 12, color: '#5c5f60', paddingHorizontal: 4, marginTop: -2 },
  input: {
    height: 56, backgroundColor: SURFACE, borderRadius: 12,
    paddingHorizontal: 16, fontSize: 15, color: '#151c25',
  },
  inputText: { fontSize: 15, color: '#151c25', flex: 1 },
  phoneRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: SURFACE, borderRadius: 12, height: 56, overflow: 'hidden',
  },
  prefix: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 12 },
  prefixText: { fontSize: 15, fontWeight: '700', color: '#151c25' },
  prefixDivider: { width: 1, height: 24, backgroundColor: '#bccbb9', marginLeft: 12 },
  phoneInput: { flex: 1, fontSize: 15, color: '#151c25', paddingHorizontal: 12 },

  selectBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  dropdown: {
    backgroundColor: '#fff', borderRadius: 12, marginTop: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4, overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  dropdownItemActive: { backgroundColor: '#f0fdf4' },
  dropdownText: { fontSize: 15, color: '#151c25' },
  dropdownTextActive: { color: PRIMARY, fontWeight: '600' },

  uploadBox: {
    height: 120, backgroundColor: SURFACE, borderRadius: 12,
    borderWidth: 2, borderColor: '#bccbb9', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  uploadBoxDone: { borderColor: PRIMARY_C, backgroundColor: '#f0fdf4', borderStyle: 'solid' },
  uploadTitle: { fontSize: 14, fontWeight: '600', color: '#151c25' },
  uploadSub: { fontSize: 12, color: '#5c5f60' },
});

const cam = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  overlay: {
    flex: 1, alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 60, backgroundColor: 'rgba(0,0,0,0.3)',
  },
  guideText: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  faceGuide: {
    width: 220, height: 280, borderRadius: 110,
    borderWidth: 3, borderColor: PRIMARY_C, borderStyle: 'dashed',
  },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 32 },
  cancelBtn: {
    paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 24, borderWidth: 2, borderColor: '#fff',
  },
  cancelText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  captureBtn: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: PRIMARY_C, alignItems: 'center', justifyContent: 'center',
    shadowColor: PRIMARY_C, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
});
